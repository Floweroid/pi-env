/**
 * agent-manager — 合并 selectable-agents + context-loader
 *
 * /agent 切换 agent + context 按 agent 注入
 *
 * 三来源发现：
 *   1. .pi/agents/*.agent/（项目级，最高优先）
 *   2. ~/.pi/agent/agents/*.agent/（全局级）
 *   3. agent-manager/agents/*.agent/（内建，默认）
 *
 * 开发路径：pi-exp/.pi/extensions/agent-manager/
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir, CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";

// ═══ core ═══
import { discoverAgents } from "./core/scanner";
import * as store from "./core/store";
import { loadAgentContext, clearContext, createInjectorHandler } from "./core/injector";
import { WIDGET_ID, type SwitchData } from "./core/types";

// ═══ commands ═══
import { registerSwitchCommand, registerCycleShortcut, setWidgetApi, resolveModel } from "./commands/switch";

// ═══ ui ═══
import { updateWidget, clearWidget } from "./ui/widget";
import { showAgentSelector } from "./ui/selector";

// ═══ render ═══
import { createAgentSwitchRenderer } from "./render/entry-renderer";

// ── 路径常量 ──────────────────────────────────────────────────────────

/** 内建 agent 目录（插件自身携带） */
const BUILTIN_DIR = path.join(__dirname, "agents");
/** 全局 agent 目录 */
const GLOBAL_DIR = path.join(getAgentDir(), "agents");

// ── context 注入器（单例） ────────────────────────────────────────────

const injector = createInjectorHandler();

// ── 主入口 ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── 初始化 widget API（供 commands/switch 调用） ──
  setWidgetApi({ updateWidget, showAgentSelector });

  // ── 注册命令 + 快捷键 ──
  registerSwitchCommand(pi);
  registerCycleShortcut(pi);

  // ── 注册 entry renderer ──
  pi.registerEntryRenderer<SwitchData>("agent-switch", createAgentSwitchRenderer());

  // ═══════════════════════════════════════════════════════════════════
  // 事件处理
  // ═══════════════════════════════════════════════════════════════════

  // ── session_start：扫描 agent + 恢复状态 ──
  pi.on("session_start", async (_event, ctx) => {
    const projectDir = path.join(ctx.cwd, CONFIG_DIR_NAME, "agents");
    const agents = discoverAgents(ctx.cwd, BUILTIN_DIR, GLOBAL_DIR);
    store.setAgentRegistry(agents);

    // ── 子代理模式：环境变量指定目标 agent，跳过 session 恢复 ──
    const envAgent = process.env.PI_ACTIVE_AGENT;
    if (envAgent) {
      const agent = store.getAgent(envAgent);
      if (agent) {
        store.setActiveAgent(envAgent);
        if (agent.model) {
          const model = resolveModel(agent.model, ctx.modelRegistry);
          if (model) await pi.setModel(model);
        }
        const allTools = pi.getAllTools().map((t) => t.name);
        pi.setActiveTools(agent.tools ?? allTools);
        if (agent.hasContext) {
          loadAgentContext(agent.dir);
        } else {
          clearContext();
        }
        updateWidget(ctx, store.getActiveAgent());
        return; // 跳过 session 恢复 + 默认 fallback
      }
    }

    // 从 session entries 恢复
    const restored = store.restoreState(ctx);
    if (restored) {
      const agent = store.getAgent(restored);
      if (agent) {
        store.setActiveAgent(restored);
        // 恢复模型
        if (agent.model) {
          const model = resolveModel(agent.model, ctx.modelRegistry);
          if (model) await pi.setModel(model);
        }
        // 恢复工具白名单
        const allTools = pi.getAllTools().map((t) => t.name);
        pi.setActiveTools(agent.tools ?? allTools);
        if (agent.hasContext) {
          loadAgentContext(agent.dir);
        } else {
          clearContext();
        }
      }
    } else {
      // 无历史状态 → 默认 ops
      const defaultAgent = store.getAgent("ops");
      if (defaultAgent) {
        store.setActiveAgent("ops");
        if (defaultAgent.model) {
          const model = resolveModel(defaultAgent.model, ctx.modelRegistry);
          if (model) await pi.setModel(model);
        }
        const allTools = pi.getAllTools().map((t) => t.name);
        pi.setActiveTools(defaultAgent.tools ?? allTools);
        if (defaultAgent.hasContext) {
          loadAgentContext(defaultAgent.dir);
        } else {
          clearContext();
        }
      }
    }

    updateWidget(ctx, store.getActiveAgent());

    if (agents.length === 0) {
      ctx.ui.notify("agent-manager: no agents found", "warning");
    }
  });

  // ── before_agent_start：替换 system prompt ──
  pi.on("before_agent_start", async (event) => {
    const activeName = store.getActiveAgent();
    if (!activeName) return;

    const agent = store.getAgent(activeName);
    if (!agent) return;

    return {
      systemPrompt: agent.systemPrompt,
    };
  });

  // ── before_provider_request：注入 context ──
  pi.on("before_provider_request", (event) => {
    return injector(event);
  });

  // ── resources_discover：重新扫描（/reload 时） ──
  pi.on("resources_discover", async (_event, ctx) => {
    const agents = discoverAgents(ctx.cwd, BUILTIN_DIR, GLOBAL_DIR);
    store.setAgentRegistry(agents);

    // 检查当前 agent 是否仍存在
    const activeName = store.getActiveAgent();
    if (activeName && !store.getAgent(activeName)) {
      store.setActiveAgent(null);
      clearContext();
      const allTools = pi.getAllTools().map((t) => t.name);
      pi.setActiveTools(allTools);
    } else if (activeName) {
      const agent = store.getAgent(activeName);
      // 恢复模型
      if (agent?.model) {
        const model = resolveModel(agent.model, ctx.modelRegistry);
        if (model) await pi.setModel(model);
      }
      // 重新应用工具白名单
      const allTools = pi.getAllTools().map((t) => t.name);
      pi.setActiveTools(agent?.tools ?? allTools);
    }

    updateWidget(ctx, store.getActiveAgent());
  });

  // ── session_shutdown：清理 widget ──
  pi.on("session_shutdown", async (_event, ctx) => {
    clearWidget(ctx);
  });
}
