/**
 * Planning Plugin — 工具屏蔽
 *
 * 计划阶段仅允许 plan_tasks，其余工具全部 block。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerToolGate(pi: ExtensionAPI, isPlanPhase: () => boolean): void {
  pi.on("tool_call", async (event) => {
    if (isPlanPhase() && event.toolName !== "plan_tasks") {
      return {
        block: true,
        reason: "计划阶段仅允许 plan_tasks，其他工具请在执行阶段使用",
      };
    }
  });
}
