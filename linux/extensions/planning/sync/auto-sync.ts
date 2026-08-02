/**
 * Planning Plugin — 内联标记自动同步
 *
 * 解析 LLM 回复中的状态标记并自动更新计划。
 * 作为 plan_tasks 工具的补充（LLM 忘记调工具时的 fallback）。
 *
 * 支持标记：
 *   [√:ID]  → completed
 *   [ing..:ID]  → in_progress
 *   [=:ID]  → paused
 *   [x:ID]  → cancelled
 *
 * 例如 LLM 回复中写 "已完成重构 [√:3]" → 任务 #3 自动标记为 completed。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentMessage, AssistantMessage, TextContent } from "@earendil-works/pi-agent-core";
import type { Task, TaskStatus } from "../types";
import { applyStatusChange } from "../core/validator";

export interface AutoSyncStore {
  getTasks(): Task[];
  refreshUI(ctx: ExtensionContext): void;
}

/** 标记 → 状态映射 */
const MARKER_MAP: Record<string, TaskStatus> = {
  "√": "completed",
  "ing..": "in_progress",
  "=": "paused",
  "x": "cancelled",
};

/** 匹配 [标记:数字] 的正则 */
const MARKER_RE = /\[(√|ing\.\.|✓|=|x):(\d+)\]/g;

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === "assistant" && Array.isArray(m.content);
}

function getTextContent(msg: AssistantMessage): string {
  return (msg.content as TextContent[])
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** 从文本中提取标记变更，去重（每个任务取最后出现的状态） */
function extractChanges(text: string): Map<number, TaskStatus> {
  const changes = new Map<number, TaskStatus>();
  let match: RegExpExecArray | null;

  // 重置 lastIndex
  MARKER_RE.lastIndex = 0;
  while ((match = MARKER_RE.exec(text)) !== null) {
    const marker = match[1]!;
    const id = parseInt(match[2]!, 10);
    const status = MARKER_MAP[marker];
    if (status && !isNaN(id)) {
      changes.set(id, status); // 重复时后者覆盖前者
    }
  }

  return changes;
}

export function registerAutoSync(
  pi: ExtensionAPI,
  store: AutoSyncStore,
): void {
  pi.on("agent_end", async (event, ctx) => {
    const tasks = store.getTasks();
    if (tasks.length === 0) return;

    // 收集本轮所有 assistant 消息的文本
    const texts: string[] = [];
    for (const msg of event.messages) {
      if (isAssistantMessage(msg as AgentMessage)) {
        texts.push(getTextContent(msg as AgentMessage));
      }
    }
    const combined = texts.join("\n");
    if (!combined) return;

    const changes = extractChanges(combined);
    if (changes.size === 0) return;

    let applied = 0;
    for (const [id, status] of changes) {
      const result = applyStatusChange(tasks, id, status);
      if (result.success) applied++;
    }

    if (applied > 0) {
      store.refreshUI(ctx);
    }
  });
}
