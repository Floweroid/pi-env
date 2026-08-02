/**
 * Planning Plugin — plan_tasks handler
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Task, TaskStatus } from "../types";
import { formatTaskLine } from "../core/format";
import { applyStatusChange } from "../core/validator";

export interface HandlerStore {
  getTasks(): Task[];
  setTasks(t: Task[]): void;
  refreshUI(ctx: ExtensionContext): void;
}

export function handleAdd(
  store: HandlerStore,
  ctx: ExtensionContext,
  raw: any[],
) {
  const tasks = store.getTasks();
  const added: Task[] = [];
  const upserted: Task[] = [];

  for (const t of raw) {
    const existing = tasks.find((x) => x.id === t.id);
    if (existing) {
      existing.name = t.name;
      existing.prerequisites = t.prerequisites ?? [];
      if (t.note !== undefined) existing.note = t.note;
      upserted.push(existing);
      continue;
    }
    tasks.push({
      id: t.id, name: t.name, status: "pending" as TaskStatus,
      prerequisites: t.prerequisites ?? [], note: t.note,
      createdAt: new Date().toISOString(),
    });
    added.push(tasks[tasks.length - 1]);
  }

  store.refreshUI(ctx);
  const msgs: string[] = [];
  if (added.length > 0) msgs.push(`已追加 ${added.length} 条任务`);
  if (upserted.length > 0) msgs.push(`已更新 ${upserted.length} 条已有任务`);
  if (msgs.length === 0) return { content: [{ type: "text", text: "无新增或更新的任务。" }], details: { tasks } };

  return {
    content: [{
      type: "text",
      text: `${msgs.join("；")}：\n`
        + added.map((t) => `  + ${formatTaskLine(t)}`).join("\n")
        + (upserted.length > 0 ? "\n" + upserted.map((t) => `  ~ ${formatTaskLine(t)}`).join("\n") : "")
        + `\n\n当前共 ${tasks.length} 条。`,
    }],
    details: { added, upserted, tasks },
  };
}

export function handleUpdate(
  store: HandlerStore,
  ctx: ExtensionContext,
  changes: { id: number; status: TaskStatus }[],
) {
  const tasks = store.getTasks();

  if (changes.length === 0) {
    const summary = tasks.length === 0 ? "当前无计划。" : tasks.map(formatTaskLine).join("\n");
    return { content: [{ type: "text", text: summary }], details: { tasks } };
  }

  const results: string[] = [];
  let hasError = false;
  for (const ch of changes) {
    const r = applyStatusChange(tasks, ch.id, ch.status);
    const task = tasks.find((t) => t.id === ch.id);
    if (task && r.success) {
      task.updatedAt = new Date().toISOString();
      task.entrySeq = ctx.sessionManager.getEntries().length;
    }
    results.push(r.message);
    if (!r.success) hasError = true;
    if (r.cascadedPauses.length > 0) results.push(`  ⚠ 级联暂停：[${r.cascadedPauses.join(",")}]`);
  }

  store.refreshUI(ctx);
  return {
    content: [{
      type: "text",
      text: (hasError ? "部分失败：\n" : "已更新：\n")
        + results.map((r) => `  ${r}`).join("\n")
        + "\n\n当前计划：\n" + tasks.map(formatTaskLine).join("\n"),
    }],
    details: { tasks, results },
  };
}

export function handleView(store: HandlerStore) {
  const tasks = store.getTasks();
  const summary = tasks.length === 0
    ? "当前没有任务计划。使用 action='add' 创建。"
    : `当前计划（${tasks.length} 条）：\n\n` + tasks.map(formatTaskLine).join("\n");
  return { content: [{ type: "text", text: summary }], details: { tasks } };
}
