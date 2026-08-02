/**
 * agent-manager commands/export — /agent-export 和 /agent-unexport 命令
 *
 * P2 阶段实现：将项目级 agent 导出到全局（软链接管理）。
 * 当前为骨架，仅注册命令占位。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerExportCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent-export", {
    description: "Export agent to global (P2 — not yet implemented)",
    handler: async (_args, ctx) => {
      ctx.ui.notify("agent-export: coming in P2", "info");
    },
  });
}

export function registerUnexportCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent-unexport", {
    description: "Remove agent from global (P2 — not yet implemented)",
    handler: async (_args, ctx) => {
      ctx.ui.notify("agent-unexport: coming in P2", "info");
    },
  });
}
