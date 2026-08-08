/**
 * Tool Result Guard — tool_result 丢失检测与交互式修复
 *
 * 在 `before_provider_request` 中校验所有 assistant 消息的 tool_calls
 * 是否都有对应的 tool 消息。如果发现缺失，先尝试静默修复，失败后弹出交互选框。
 */

import { type PiMessage, findMissingToolResults, findOrphanToolResults } from "./detect";
import { silentRepair, removeMissingCalls, removeOrphanMessages, insertPrecedingToolCall, collectCallInfo } from "./repair";
import { handleMissingDialog, orphanLogInfo } from "./dialog";
import { forceSessionReload } from "./session";
import { appendLog, type MissingToolInfo } from "./logger";
import * as os from "node:os";
import * as path from "node:path";

// ── 类型 ────────────────────────────────────────────────────────────────

interface MessagesPayload {
  messages: PiMessage[];
}

// ── 主入口 ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", async (event, ctx) => {
    const payload = event.payload as MessagesPayload | undefined;
    let msgs = payload?.messages;
    if (!msgs || msgs.length === 0) return;

    const sessionId = ctx.sessionManager?.getSessionId() || "unknown";

    const missingIds = findMissingToolResults(msgs);
    const orphanResult = findOrphanToolResults(msgs);
    const hasOrphans = orphanResult.indices.length > 0;

    // ── 静默修复：尝试从 session 实时状态补全 ──
    if (missingIds.length > 0 || hasOrphans) {
      const repaired = silentRepair(msgs, ctx.sessionManager);
      if (repaired) {
        msgs = repaired;
        return { ...payload, messages: msgs };
      }
    }

    // ── 没有需要处理的问题 → 放行 ──
    if (missingIds.length === 0 && !hasOrphans) return;

    // ── 检测到问题，写日志 ──
    appendLog({
      timestamp: new Date().toISOString(),
      sessionId,
      missing: [
        ...missingIds.map((id: string) => ({ name: "missing", id, position: "" })),
        ...orphanLogInfo(msgs, orphanResult).map((m) => ({ ...m, position: "" })),
      ],
      choice: "detected",
    });

    // ── 孤儿结果处理 ──
    if (hasOrphans) {
      const orphanIds = orphanResult.ids.map((id: string) => id.slice(-12));
      const orphanIdxSet = new Set(orphanResult.indices);

      if (!ctx.hasUI) {
        appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: "auto-delete-orphan (no UI)" });
        msgs = removeOrphanMessages(msgs, ctx.sessionManager?.getSessionFile(), orphanResult.indices);
        forceSessionReload(ctx);
      } else {
        const choice = await ctx.ui.select(
          `检测到 ${orphanResult.indices.length} 个孤儿工具结果:\n  ${orphanIds.join(", ")}\n\n请选择处理方式：`,
          ["删除孤儿工具结果", "插入前置 tool_call（默认）", "插入前置 tool_call（自定义）", "放行（发送到 API）", "保留"],
        );

        if (choice === "删除孤儿工具结果") {
          appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: "delete-orphan" });
          msgs = removeOrphanMessages(msgs, ctx.sessionManager?.getSessionFile(), orphanResult.indices);
          forceSessionReload(ctx);
        } else if (choice === "插入前置 tool_call（默认）") {
          msgs = insertPrecedingToolCall(msgs, orphanIdxSet, (_id) => "unknown");
          appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: "insert-toolcall" });
        } else if (choice === "插入前置 tool_call（自定义）") {
          const customName = await ctx.ui.input("为工具命名：", "unknown");
          msgs = insertPrecedingToolCall(msgs, orphanIdxSet, () => customName || "unknown");
          appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: `insert-toolcall-custom: ${customName}` });
        } else if (choice === "放行（发送到 API）") {
          appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: "pass-through-orphan" });
          return { ...payload, messages: msgs };
        } else {
          appendLog({ timestamp: new Date().toISOString(), sessionId, missing: orphanLogInfo(msgs, orphanResult), choice: "keep-orphan" });
        }
      }

      // 如果只有孤儿没有缺失 → 返回
      if (missingIds.length === 0) {
        return { ...payload, messages: msgs };
      }
      // 孤儿+缺失 → 继续处理 missing
    }

    if (missingIds.length === 0) return;

    // DEBUG: 记录触发时的消息格式
    try {
      const debugInfo = msgs.map((m: any, i: number) => ({
        i, r: m.role,
        tc: m.tool_calls?.map((t: any) => t.id?.slice(-12)) || [],
        tr: (m.tool_call_id || m.toolCallId || "").slice(-12),
      }));
      require("fs").appendFileSync(
        path.join(os.tmpdir(), "tool-result-guard-debug.log"),
        JSON.stringify({ t: new Date().toISOString(), miss: missingIds.map((id: string) => id.slice(-12)), n: debugInfo.length, msgs: debugInfo }) + "\n",
      );
    } catch {}

    // ── 准备缺失信息 ──
    const missingInfo: MissingToolInfo[] = missingIds.map((id: string) => {
      const info = collectCallInfo(msgs, id);
      return { id, ...info };
    });

    // ── 无 UI：自动删除 ──
    if (!ctx.hasUI) {
      appendLog({ timestamp: new Date().toISOString(), sessionId, missing: missingInfo, choice: "auto-delete (no UI)" });
      const fixed = removeMissingCalls(msgs, ctx.sessionManager?.getSessionFile(), missingIds);
      return { ...payload, messages: fixed };
    }

    // ── 有 UI：交互选择 ──
    const result = await handleMissingDialog(msgs, missingIds, missingInfo, sessionId, ctx);
    return { ...payload, messages: result.messages };
  });
}
