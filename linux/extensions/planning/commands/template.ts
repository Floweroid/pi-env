/**
 * Planning Plugin — /plan template
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Task, TaskStatus } from "../types";
import { TEMPLATES } from "../prompts/templates";

export interface TemplateStore {
  setTasks(t: Task[]): void;
  refreshUI(ctx: ExtensionContext): void;
}

export function applyTemplate(
  name: string,
  store: TemplateStore,
  ctx: ExtensionContext,
): string | null {
  const tpl = TEMPLATES[name];
  if (!tpl) return `未知模板：${name}。可用：${Object.keys(TEMPLATES).join(", ")}`;

  store.setTasks(tpl.tasks.map((t, i) => ({
    id: i + 1, name: t.name, status: "pending" as TaskStatus,
    prerequisites: t.prerequisites ?? [], note: t.note,
  })));
  store.refreshUI(ctx);
  return null;
}
