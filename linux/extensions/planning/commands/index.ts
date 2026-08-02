/**
 * Planning Plugin — /plan 命令注册
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SectionKey } from "../types";
import { SECTIONS } from "../types";
import { TEMPLATES } from "../prompts/templates";
import { resolveSection, toggleSection, type ToggleStore } from "./toggle";
import { applyTemplate, type TemplateStore } from "./template";
import { formatExportMarkdown } from "./export";
export { registerPlanstageCommand, type PlanstageStore } from "./planstage";

export interface CommandStore extends ToggleStore, TemplateStore {
  getTasks(): import("../types").Task[];
  setTasks(t: import("../types").Task[]): void;
  getCollapsed(): Set<SectionKey>;
  setCollapsed(s: Set<SectionKey>): void;
  refreshUI(ctx: ExtensionContext): void;
}

export function registerPlanCommand(pi: ExtensionAPI, store: CommandStore): void {
  pi.registerCommand("plan", {
    description: "查看/管理任务计划",
    getArgumentCompletions: (prefix: string) => {
      const subs = ["toggle", "expand-all", "collapse-all", "template", "export", "reset"];
      const filtered = subs.filter((s) => s.startsWith(prefix)).map((s) => ({ value: s, label: s }));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parts = (args?.trim() ?? "").split(/\s+/);
      const sub = parts[0];
      const target = parts.slice(1).join("");

      if (sub === "toggle") {
        if (target) {
          const key = resolveSection(target);
          if (key) { toggleSection(key, store, ctx); return; }
          ctx.ui.notify(`未知分区：${target}。可用：${SECTIONS.map((s) => s.label).join("/")}`, "warning");
          return;
        }
        const all: SectionKey[] = ["in_progress", "pending", "done", "cancelled"];
        const collapsed = store.getCollapsed();
        for (const key of all) {
          if (collapsed.has(key)) {
            collapsed.delete(key);
            store.refreshOverlay();
            ctx.ui.notify(`展开「${SECTIONS.find((s) => s.key === key)?.label}」`, "info");
            return;
          }
        }
        collapsed.add("done");
        store.refreshOverlay();
        ctx.ui.notify("折叠「已完成」", "info");
        return;
      }

      if (sub === "expand-all") {
        store.setCollapsed(new Set());
        store.refreshOverlay();
        ctx.ui.notify("全部展开", "info");
        return;
      }
      if (sub === "collapse-all") {
        store.setCollapsed(new Set(["in_progress", "pending", "done", "cancelled"]));
        store.refreshOverlay();
        ctx.ui.notify("全部折叠", "info");
        return;
      }

      if (sub === "template") {
        if (!target) {
          ctx.ui.notify(`可用模板：${Object.keys(TEMPLATES).join(", ")}\n用法：/plan template <名称>`, "info");
          return;
        }
        const err = applyTemplate(target, store, ctx);
        if (err) { ctx.ui.notify(err, "warning"); }
        else { ctx.ui.notify(`已加载「${TEMPLATES[target]?.name ?? target}」模板`, "info"); }
        return;
      }

      if (sub === "export") {
        const tasks = store.getTasks();
        if (tasks.length === 0) { ctx.ui.notify("当前没有任务计划，无法导出", "warning"); return; }
        const md = formatExportMarkdown(tasks);
        const filePath = target || "/tmp/plan-export.md";
        try {
          await pi.exec("tee", [filePath], { input: md });
          ctx.ui.notify(`计划已导出到 ${filePath}`, "info");
        } catch {
          await pi.exec("tee", ["/tmp/plan-export.md"], { input: md });
          ctx.ui.notify("已导出到 /tmp/plan-export.md", "info");
        }
        return;
      }

      if (sub === "reset") {
        store.setTasks([]);
        store.refreshUI(ctx);
        store.refreshOverlay();
        ctx.ui.notify("计划已清空", "warning");
        return;
      }

      // 默认：弹窗显示计划
      const tasks = store.getTasks();
      if (tasks.length === 0) { ctx.ui.notify("当前没有任务计划。", "info"); return; }

      const lines: string[] = [`📋 任务计划（${tasks.length} 条）`, ""];
      for (const s of SECTIONS) {
        const st = tasks.filter((t) =>
          s.key === "done" ? t.status === "completed"
          : s.key === "cancelled" ? t.status === "cancelled"
          : s.key === "in_progress" ? t.status === "in_progress"
          : t.status === "pending" || t.status === "paused"
        );
        if (st.length > 0) {
          lines.push(`${s.label}：`);
          for (const t of st) {
            const prereq = t.prerequisites.length > 0 ? ` 前置：[${t.prerequisites.join(",")}]` : "";
            lines.push(`  ${t.id}. ${t.name}${prereq}`);
          }
          lines.push("");
        }
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
