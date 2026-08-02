/**
 * Planning Plugin — plan_tasks 工具注册
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { GUIDELINES } from "../prompts/guidelines";
import type { HandlerStore } from "./handlers";
import { handleAdd, handleUpdate, handleView } from "./handlers";

const TaskItemSchema = Type.Object({
  id: Type.Integer(),
  name: Type.String(),
  prerequisites: Type.Optional(Type.Array(Type.Integer())),
  note: Type.Optional(Type.String()),
});

export function registerPlanTasksTool(pi: ExtensionAPI, store: HandlerStore): void {
  pi.registerTool({
    name: "plan_tasks",
    label: "Plan Tasks",
    description:
      "管理当前任务计划。add=追加任务 | update=更新状态 | view=查看计划。",
    promptSnippet: "追加/更新/查看任务计划（add/update/view）",
    promptGuidelines: GUIDELINES,
    parameters: Type.Object({
      action: StringEnum(["add", "update", "view"] as const),
      tasks: Type.Optional(Type.Array(TaskItemSchema)),
      changes: Type.Optional(Type.Array(Type.Object({
        id: Type.Integer(),
        status: StringEnum(["pending", "paused", "in_progress", "completed", "cancelled"] as const),
      }))),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const action = params.action as "add" | "update" | "view";
      switch (action) {
        case "add": return handleAdd(store, ctx, (params.tasks ?? []) as any[]);
        case "update": return handleUpdate(store, ctx, (params.changes ?? []) as any[]);
        case "view": return handleView(store);
        default: return { content: [{ type: "text", text: `未知操作：${action}` }], details: {} };
      }
    },
  });
}
