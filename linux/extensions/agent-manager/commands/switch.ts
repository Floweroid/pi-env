/**
 * agent-manager commands/switch — /agent 命令 + Alt+A 快捷键
 *
 * 统一命令入口：
 *   /agent list                → 列出 agent
 *   /agent <name>              → 切换 agent
 *   /agent none                → 恢复默认
 *   /agent tools               → 显示当前工具列表
 *   /agent export <name>       → 导出到全局（P2 骨架）
 *   /agent unexport <name>     → 取消导出（P2 骨架）
 *   /agent                     → 交互选择器
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import * as store from "../core/store";
import { loadAgentContext, clearContext, setPendingSwitchInfo } from "../core/injector";
import { buildSwitchEntry, buildSwitchNotify } from "../render/switch-notify";

// ── widget API（由 index.ts 注入） ────────────────────────────────────

interface WidgetAPI {
  updateWidget(ctx: ExtensionContext, name: string | null): void;
  showAgentSelector(
    ctx: ExtensionContext,
    currentName: string | null,
  ): Promise<string | null>;
}

let widgetApi: WidgetAPI | null = null;

export function setWidgetApi(api: WidgetAPI): void {
  widgetApi = api;
}

// ── 工具白名单 ────────────────────────────────────────────────────────

function applyAgentTools(pi: ExtensionAPI, name: string | null): void {
  const allTools = pi.getAllTools().map((t) => t.name);

  if (!name) {
    pi.setActiveTools(allTools);
    return;
  }

  const agent = store.getAgent(name);
  pi.setActiveTools(agent?.tools ?? allTools);
}

// ── model 解析 ────────────────────────────────────────────────────────

/**
 * 将 model string 解析为 Model 对象。
 * 支持 "provider:modelId" 和裸 "modelId" 两种格式。
 */
export function resolveModel(
  modelStr: string | undefined,
  registry: ExtensionContext["modelRegistry"],
): Model<Api> | undefined {
  if (!modelStr) return undefined;

  if (modelStr.includes(":")) {
    const [provider, ...rest] = modelStr.split(":");
    return registry.find(provider, rest.join(":"));
  }

  return registry.getAll().find((m) => m.id === modelStr);
}

// ── 切换 agent ────────────────────────────────────────────────────────

async function switchToAgent(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  name: string | null,
): Promise<void> {
  const oldName = store.getActiveAgent();

  if (!name) {
    store.setActiveAgent(null);
    applyAgentTools(pi, null);
    clearContext();
    store.persistState(pi);
    widgetApi?.updateWidget(ctx, null);
    const data = buildSwitchEntry(oldName, null, null);
    pi.appendEntry("agent-switch", data);
    ctx.ui.notify(buildSwitchNotify(null, data), "info");
    setPendingSwitchInfo({ from: oldName, to: "(none)", description: "已恢复默认" });
    return;
  }

  const agent = store.getAgent(name);
  if (!agent) {
    ctx.ui.notify(`Unknown agent "${name}"`, "error");
    return;
  }

  store.setActiveAgent(name);

  // 切换模型
  if (agent.model) {
    const model = resolveModel(agent.model, ctx.modelRegistry);
    if (model) {
      await pi.setModel(model);
    } else {
      ctx.ui.notify(`Model "${agent.model}" not found, keeping current model`, "warning");
    }
  }

  applyAgentTools(pi, name);
  if (agent.hasContext) {
    loadAgentContext(agent.dir);
  } else {
    clearContext();
  }
  store.persistState(pi);
  widgetApi?.updateWidget(ctx, name);
  const data = buildSwitchEntry(oldName, name, agent.dir);
  pi.appendEntry("agent-switch", data);
  ctx.ui.notify(buildSwitchNotify(name, data), "info");
  setPendingSwitchInfo({ from: oldName, to: name, description: agent.description });
}

// ── 循环切换（Alt+A） ────────────────────────────────────────────────

function buildCycleList(): string[] {
  return ["(none)", ...store.getAllAgents().map((a) => a.name)];
}

function nextInCycle(current: string | null): string {
  const list = buildCycleList();
  if (list.length === 0) return "(none)";
  const idx = current ? list.indexOf(current) : 0;
  return list[(idx + 1) % list.length];
}

// ── 子命令 handler ────────────────────────────────────────────────────

function handleList(ctx: ExtensionContext): void {
  const agents = store.getAllAgents();
  if (agents.length === 0) {
    ctx.ui.notify("No agents found", "warning");
    return;
  }
  const current = store.getActiveAgent();
  const lines = agents.map(
    (a) =>
      `  ${a.name}${a.name === current ? " (active)" : ""}` +
      ` — ${a.description || "(no description)"}`,
  );
  ctx.ui.notify(`Available agents:\n${lines.join("\n")}`, "info");
}

function handleTools(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const active = pi.getActiveTools();
  const name = store.getActiveAgent();
  ctx.ui.notify(
    `[${name || "(none)"}] 可见工具 (${active.length}):\n  ${active.join(", ")}`,
    "info",
  );
}

function handleExport(ctx: ExtensionContext, name: string | undefined): void {
  if (!name) {
    ctx.ui.notify("Usage: /agent export <name>", "info");
    return;
  }
  ctx.ui.notify("agent export: coming in P2", "info");
}

function handleUnexport(ctx: ExtensionContext, name: string | undefined): void {
  if (!name) {
    ctx.ui.notify("Usage: /agent unexport <name>", "info");
    return;
  }
  ctx.ui.notify("agent unexport: coming in P2", "info");
}

// ── 交互选择器 ────────────────────────────────────────────────────────

async function showSelector(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const agents = store.getAllAgents();
  if (agents.length === 0) {
    ctx.ui.notify("No agent files found", "warning");
    return;
  }
  if (!widgetApi) {
    ctx.ui.notify("Selector not available", "error");
    return;
  }
  const choice = await widgetApi.showAgentSelector(ctx, store.getActiveAgent());
  if (choice === null) return;
  switchToAgent(pi, ctx, choice === "(none)" ? null : choice);
}

// ── 注册 /agent 命令 ──────────────────────────────────────────────────

export function registerSwitchCommand(pi: ExtensionAPI): void {
  pi.registerCommand("agent", {
    description: "Agent management — /agent [switch|list|tools|export|unexport]",

    getArgumentCompletions: (prefix: string) => {
      const agents = store.getAllAgents();
      const parts = prefix.split(/\s+/);

      // 第一个词：显示子命令列表
      if (parts.length === 1 && !prefix.endsWith(" ")) {
        const subcommands = [
          { value: "switch ", label: "switch <name> — 切换 agent" },
          { value: "list", label: "list — 列出所有 agent" },
          { value: "tools", label: "tools — 显示当前工具列表" },
          { value: "export ", label: "export <name> — 导出到全局" },
          { value: "unexport ", label: "unexport <name> — 取消导出" },
        ];
        if (!prefix) return subcommands;
        return subcommands.filter((item) =>
          item.value.startsWith(prefix.toLowerCase()),
        );
      }

      // 已输入子命令 → 只补全 agent 名
      const sub = parts[0].toLowerCase();
      if (sub === "switch" || sub === "export" || sub === "unexport") {
        const second = parts[1] ?? "";
        const agentItems = agents.map((a) => ({
          value: `${sub} ${a.name}`,
          label: `${a.name} — ${a.description || "无描述"}`,
        }));
        if (!second) return agentItems;
        const searchPrefix = `${sub} ${second}`.toLowerCase();
        return agentItems.filter((item) =>
          item.value.toLowerCase().startsWith(searchPrefix),
        );
      }

      return [];
    },

    handler: async (args, ctx) => {
      const trimmed = args?.trim();
      if (!trimmed) {
        await showSelector(pi, ctx);
        return;
      }

      // 解析第一个单词作为子命令
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case "switch":
          // /agent switch <name> 或 /agent switch none
          switchToAgent(pi, ctx, parts[1] === "none" ? null : parts[1] ?? null);
          return;

        case "list":
          handleList(ctx);
          return;

        case "tools":
          handleTools(pi, ctx);
          return;

        case "export":
          handleExport(ctx, parts[1]);
          return;

        case "unexport":
          handleUnexport(ctx, parts[1]);
          return;

        default:
          ctx.ui.notify(`Unknown subcommand "${cmd}". Use: /agent switch <name>`, "info");
      }
    },
  });
}

// ── 注册 Alt+A 快捷键 ──────────────────────────────────────────────

export function registerCycleShortcut(pi: ExtensionAPI): void {
  pi.registerShortcut("alt+a", {
    description: "Cycle to next agent",
    handler: async (ctx) => {
      const agents = store.getAllAgents();
      if (agents.length === 0) {
        ctx.ui.notify("No agent files found", "warning");
        return;
      }
      const next = nextInCycle(store.getActiveAgent());
      switchToAgent(pi, ctx, next === "(none)" ? null : next);
    },
  });
}
