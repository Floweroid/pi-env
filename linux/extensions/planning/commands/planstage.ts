/**
 * Planning Plugin — /planstage 顶层命令
 *
 * 控制两阶段同步的开启/关闭。
 *
 * 用法：
 *   /planstage      → 显示当前状态
 *   /planstage ?    → 显示当前状态
 *   /planstage on   → 开启两阶段
 *   /planstage off  → 关闭两阶段
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface PlanstageStore {
  getTwoPhaseEnabled(): boolean;
  setTwoPhaseEnabled(v: boolean): void;
}

export function registerPlanstageCommand(
  pi: ExtensionAPI,
  store: PlanstageStore,
): void {
  pi.registerCommand("planstage", {
    description: "控制两阶段同步的开启/关闭",
    getArgumentCompletions: (prefix: string) => {
      const subs = ["on", "off", "?"];
      return subs.filter((s) => s.startsWith(prefix)).map((s) => ({ value: s, label: s }));
    },
    handler: async (args, ctx) => {
      const sub = (args?.trim() ?? "").split(/\s+/)[0];

      if (sub === "on") {
        store.setTwoPhaseEnabled(true);
        ctx.ui.notify("两阶段同步已开启 ✓", "info");
        return;
      }

      if (sub === "off") {
        store.setTwoPhaseEnabled(false);
        ctx.ui.notify("两阶段同步已关闭 ✗", "info");
        return;
      }

      // 无参 或 "?" → 显示当前状态
      const status = store.getTwoPhaseEnabled() ? "开启 (on)" : "关闭 (off)";
      ctx.ui.notify(
        `两阶段同步当前：${status}\n` +
        `/planstage on  开启\n` +
        `/planstage off 关闭`,
        "info",
      );
    },
  });
}
