/**
 * Tool Result Guard — 修复模块
 *
 * 修改 payload 消息列表：删除/插入 tool_calls 和 tool_results。
 */

import { PiMessage } from "./detect";
import { removeToolCallFromSession } from "./session";

// ── 常量 ────────────────────────────────────────────────────────────────

const RETRY_WAIT_MS = 2000;

// ── Session 清理（共享） ────────────────────────────────────────────────

function cleanSessionByIds(sessionFile: string | undefined, ids: string[], mode: "missing" | "orphan" = "missing"): void {
  if (!sessionFile || ids.length === 0) return;
  for (const id of ids) {
    removeToolCallFromSession(sessionFile, id, mode === "orphan" ? "orphan" : "assistant");
  }
}

// ── 统一删除入口 ────────────────────────────────────────────────────────

export function removeMissingCalls(msgs: PiMessage[], sessionFile: string | undefined, ids: string[]): PiMessage[] {
  cleanSessionByIds(sessionFile, ids);
  return removeMissingToolCalls(msgs, new Set(ids));
}

export function removeOrphanMessages(msgs: PiMessage[], sessionFile: string | undefined, indices: number[]): PiMessage[] {
  const ids = indices.map((i) => msgs[i]?.tool_call_id || msgs[i]?.toolCallId || "").filter(Boolean);
  cleanSessionByIds(sessionFile, ids, "orphan");
  return removeOrphanToolResults(msgs, new Set(indices));
}

// ── 内部实现 ────────────────────────────────────────────────────────────

function removeOrphanToolResults(msgs: PiMessage[], orphanIndices: Set<number>): PiMessage[] {
  return msgs.filter((_, i) => !orphanIndices.has(i));
}

function removeMissingToolCalls(msgs: PiMessage[], missingIds: Set<string>): PiMessage[] {
  return msgs.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) return m;
    const kept = m.tool_calls.filter((tc: any) => !missingIds.has(tc.id));
    if (kept.length === m.tool_calls.length) return m;
    if (kept.length === 0) {
      const { tool_calls, ...rest } = m;
      return { ...rest, stop_reason: "stop" };
    }
    return { ...m, tool_calls: kept };
  });
}

// ── 插入 ────────────────────────────────────────────────────────────────

export function insertToolResults(
  msgs: PiMessage[],
  missingIds: Set<string>,
  getContent: (id: string, name: string) => string,
): PiMessage[] {
  const result: PiMessage[] = [];
  for (const m of msgs) {
    result.push(m);
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    const missingFromThis = m.tool_calls.filter((tc: any) => missingIds.has(tc.id));
    if (missingFromThis.length === 0) continue;
    for (const tc of missingFromThis) {
      const name = tc.function?.name || tc.name || "unknown";
      result.push({ role: "tool", tool_call_id: tc.id, content: getContent(tc.id, name) });
    }
  }
  return result;
}

export function insertPrecedingToolCall(
  msgs: PiMessage[],
  orphanIndices: Set<number>,
  getName: (id: string) => string,
): PiMessage[] {
  const result: PiMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (orphanIndices.has(i)) {
      const m = msgs[i];
      const toolCallId = m.tool_call_id || m.toolCallId || "";
      const name = getName(toolCallId);
      result.push({
        role: "assistant",
        content: `正在调用工具: ${name}`,
        tool_calls: [{ id: toolCallId, type: "function", function: { name, arguments: "{}" } }],
      });
    }
    result.push(msgs[i]);
  }
  return result;
}

// ── 信息收集 ────────────────────────────────────────────────────────────

export function collectCallInfo(msgs: PiMessage[], targetId: string): { name: string; position: string; args: string } {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    for (let j = 0; j < m.tool_calls.length; j++) {
      const tc = m.tool_calls[j];
      if (tc.id === targetId) {
        const args = tc.function?.arguments || tc.input || tc.arguments;
        return {
          name: tc.function?.name || tc.name || "unknown",
          position: `messages[${i}].tool_calls[${j}]`,
          args: typeof args === "string" ? args : JSON.stringify(args),
        };
      }
    }
  }
  return { name: "unknown", position: "", args: "" };
}

// ── 静默修复 ────────────────────────────────────────────────────────────

import { findMissingToolResults, findOrphanToolResults } from "./detect";
import type { ReadonlySessionManager } from "@earendil-works/pi-coding-agent";

/**
 * 从 session 实时状态补全缺失的工具结果。
 * 当 payload 快照缺了结果但 session entries 中已有时，从 entries 捞回。
 * @returns 补全后的消息列表，或 null（无法补全，需弹框）
 */
export function silentRepair(
  msgs: PiMessage[],
  sessionManager: ReadonlySessionManager | undefined,
): PiMessage[] | null {
  if (!sessionManager) return null;
  const liveContext = sessionManager.buildSessionContext();
  const liveMsgs = liveContext.messages;

  const missingIds = findMissingToolResults(msgs);
  const orphanResult = findOrphanToolResults(msgs);

  let repaired = [...msgs];
  let changed = false;

  // 补缺失结果
  if (missingIds.length > 0) {
    const stillMissing = findMissingToolResults(liveMsgs);
    const recovered = missingIds.filter((id) => !stillMissing.includes(id));
    if (recovered.length === 0) return null;

    for (const id of recovered) {
      const liveResult = liveMsgs.find(
        (m: any) =>
          (m.role === "tool" || m.role === "toolResult") &&
          (m.tool_call_id === id || m.toolCallId === id),
      );
      if (!liveResult) continue;
      const idx = repaired.findIndex(
        (m) => Array.isArray(m.tool_calls) && m.tool_calls.some((tc: any) => tc.id === id),
      );
      if (idx !== -1) {
        repaired.splice(idx + 1, 0, {
          role: "tool",
          tool_call_id: liveResult.tool_call_id || liveResult.toolCallId || "",
          content: liveResult.content || "",
        });
        changed = true;
      }
    }
  }

  // 补孤儿 assistant
  if (orphanResult.indices.length > 0) {
    const liveOrphan = findOrphanToolResults(liveMsgs);
    if (liveOrphan.indices.length > 0) return null;

    for (const id of orphanResult.ids) {
      const liveAssistant = liveMsgs.find(
        (m: any) => Array.isArray(m.tool_calls) && m.tool_calls.some((tc: any) => tc.id === id),
      );
      if (liveAssistant) {
        repaired.splice(orphanResult.indices[0], 0, liveAssistant);
        changed = true;
        break;
      }
    }
  }

  return changed ? repaired : null;
}
