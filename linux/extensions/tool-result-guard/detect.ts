/**
 * Tool Result Guard — 检测模块
 *
 * 分析消息列表，检测缺失的工具结果和孤儿工具结果。
 */

// ── 类型 ────────────────────────────────────────────────────────────────

/** 单条消息的通用结构 */
export interface PiMessage {
  role: string;
  content?: any;
  tool_calls?: Array<{ id: string; name?: string; function?: { name: string; arguments?: string }; arguments?: any; input?: any }>;
  tool_call_id?: string;
  toolCallId?: string;
  toolName?: string;
  stop_reason?: string;
  [key: string]: unknown;
}

// ── 缺失检测 ────────────────────────────────────────────────────────────

/**
 * 分析 messages，返回缺失 tool_result 的 tool_call_id 列表。
 */
export function findMissingToolResults(msgs: PiMessage[]): string[] {
  const callIds: string[] = [];
  const resultIds: string[] = [];

  for (const m of msgs) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (tc.id) callIds.push(tc.id);
      }
    }
    if (m.role === "user" && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          resultIds.push(block.tool_use_id);
        }
      }
    }
    if (m.role === "tool" && m.tool_call_id) {
      resultIds.push(m.tool_call_id);
    }
  }

  return callIds.filter((id) => !resultIds.includes(id));
}

// ── 孤儿检测 ────────────────────────────────────────────────────────────

/**
 * 反向检测：找出有 tool_result 但没有对应 tool_call 的孤儿结果。
 */
export function findOrphanToolResults(msgs: PiMessage[]): {
  ids: string[];
  indices: number[];
} {
  const callIds: string[] = [];
  const orphanIndices: number[] = [];

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];

    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (tc.id) callIds.push(tc.id);
      }
    }
    if (m.role === "user" && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_use" && block.id) {
          callIds.push(block.id);
        }
      }
    }

    let resultId: string | null = null;
    if (m.role === "tool" && m.tool_call_id) {
      resultId = m.tool_call_id;
    } else if (m.role === "toolResult" && m.toolCallId) {
      resultId = m.toolCallId;
    } else if (m.role === "user" && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          resultId = block.tool_use_id;
          break;
        }
      }
    }

    if (resultId && !callIds.includes(resultId)) {
      orphanIndices.push(i);
    }
  }

  return {
    ids: orphanIndices.map((i) => {
      const m = msgs[i];
      return m.tool_call_id || m.toolCallId || "";
    }),
    indices: orphanIndices,
  };
}
