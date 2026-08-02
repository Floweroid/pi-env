/**
 * agent-manager core/store — 状态管理
 *
 * 管理内存状态（当前 agent、agent 列表），提供持久化/恢复。
 * 遵循 todo.ts 的 session entry 模式：通过 pi.appendEntry 持久化，
 * 通过扫描 session entries 恢复。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentEntry } from "./types";

// ── 模块级变量（非导出，纯内存） ───────────────────────────────────────

let activeAgent: string | null = null;
let agentRegistry: AgentEntry[] = [];

// ── 导出的 getter/setter ───────────────────────────────────────────────

export function getActiveAgent(): string | null {
  return activeAgent;
}

export function setActiveAgent(name: string | null): void {
  activeAgent = name;
}

export function getAgent(name: string): AgentEntry | undefined {
  return agentRegistry.find((a) => a.name === name);
}

export function getAllAgents(): AgentEntry[] {
  return agentRegistry;
}

export function setAgentRegistry(agents: AgentEntry[]): void {
  agentRegistry = agents;
}

// ── 持久化 ─────────────────────────────────────────────────────────────

/**
 * 将 activeAgent 写入 session entry。
 * 不参与 LLM context，仅用于状态恢复。
 */
export function persistState(pi: ExtensionAPI): void {
  pi.appendEntry("active-agent", { name: activeAgent });
}

// ── 恢复 ───────────────────────────────────────────────────────────────

/**
 * 从 session entries 恢复 activeAgent。
 * 倒序扫描，取最近一条 "active-agent" entry。
 */
export function restoreState(ctx: ExtensionContext): string | null {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as any;
    if (e.type === "custom" && e.customType === "active-agent") {
      return e.data?.name ?? null;
    }
  }
  return null;
}
