/**
 * Tool Result Guard — 对话框模块
 *
 * 与用户交互，选择如何处理缺失/孤儿工具结果。
 */

import { type PiMessage, findMissingToolResults, findOrphanToolResults } from "./detect";
import { removeMissingCalls, insertToolResults, collectCallInfo, silentRepair } from "./repair";
import { appendLog, type MissingToolInfo } from "./logger";
import { forceSessionReload } from "./session";

// ── 常量 ────────────────────────────────────────────────────────────────

const RETRY_WAIT_MS = 2000;

// ── 孤儿日志信息 ────────────────────────────────────────────────────────

export function orphanLogInfo(msgs: PiMessage[], orphanResult: ReturnType<typeof findOrphanToolResults>): MissingToolInfo[] {
  return orphanResult.indices.map((i: number) => ({
    name: "orphan",
    id: msgs[i]?.tool_call_id || msgs[i]?.toolCallId || "",
    position: `messages[${i}]`,
  }));
}

// ── 缺失对话框 ──────────────────────────────────────────────────────────

export async function handleMissingDialog(
  msgs: PiMessage[],
  missingIds: string[],
  missingInfo: MissingToolInfo[],
  sessionId: string,
  ctx: any,
): Promise<{ messages: PiMessage[] }> {
  const summary = missingInfo.map((info) => `  ${info.name} (${info.id.slice(0, 12)}...)`).join("\n");

  const choice = await ctx.ui.select(
    `⚠️ 检测到 ${missingIds.length} 个工具调用缺少返回结果:\n\n${summary}\n\n请选择处理方式：`,
    ["删除工具调用信息", "填入默认返回结果", "填入自定义文本", "重试（等待结果就绪）", "放行（发送到 API）"],
  );

  appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice });

  if (choice === "删除工具调用信息") {
    forceSessionReload(ctx);
    return { messages: removeMissingCalls(msgs, ctx.sessionManager?.getSessionFile(), missingIds) };
  }

  if (choice === "填入默认返回结果") {
    return { messages: insertToolResults(msgs, new Set(missingIds), (_id, name) => `工具调用 "${name}" 结果丢失，请重试`) };
  }

  if (choice === "填入自定义文本") {
    const customText = await ctx.ui.input(`为 ${missingIds.length} 个缺失的工具结果填入返回文本：`, "工具调用结果丢失，请重试");
    const text = customText || "工具调用结果丢失，请重试";
    return { messages: insertToolResults(msgs, new Set(missingIds), () => text) };
  }

  if (choice === "重试（等待结果就绪）") {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
      if (findMissingToolResults(msgs).length === 0) {
        appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice: "retry -> resolved" });
        return { messages: msgs };
      }
      appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice: `retry (attempt ${attempt})` });
    }
    // 重试耗尽 → 重新弹出对话框，不再静默删除
    appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice: "retry exhausted -> re-prompt" });
    return handleMissingDialog(msgs, missingIds, missingInfo, sessionId, ctx);
  }

  if (choice === "放行（发送到 API）") {
    appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice: "pass-through" });
    return { messages: msgs };
  }

  // 关闭弹窗 → 删除兜底
  forceSessionReload(ctx);
  return { messages: removeMissingCalls(msgs, ctx.sessionManager?.getSessionFile(), missingIds) };
}
