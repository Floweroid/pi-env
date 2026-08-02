/**
 * Planning Plugin — 上下文格式化（给 LLM 看）
 */

import type { Task } from "../types";
import { STATUS_LABEL, PLAN_MARKER } from "../types";

/** 单条任务 → LLM 文本行 */
export function formatTaskLine(task: Task): string {
  const statusLabel = STATUS_LABEL[task.status];
  const prereq =
    task.prerequisites.length > 0
      ? ` 前置：[${task.prerequisites.join(",")}]`
      : "";
  return `[${statusLabel}]-#${task.id}.${task.name}${prereq}`;
}

/** 全量计划 → 上下文注入块 */
export function formatPlanContext(tasks: Task[]): string {
  if (tasks.length === 0) return "";

  const lines: string[] = [];
  lines.push(`[当前任务计划 — 共 ${tasks.length} 条]`);
  lines.push("");

  for (const task of tasks) {
    lines.push(formatTaskLine(task));
    if (task.note) {
      lines.push(`  ps. ${task.note}`);
    }
  }

  lines.push("");
  lines.push(
    "状态：[-]未开始 [=]暂停 [ing..]进行中 [√]已完成 [x]取消",
  );
  lines.push(
    "规则：进入[进行中]需前置[已完成]或[暂停]（不可[未开始]）；前置暂停/取消→依赖任务自动暂停",
  );

  return PLAN_MARKER + "\n" + lines.join("\n");
}
