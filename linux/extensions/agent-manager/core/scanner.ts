/**
 * agent-manager core/scanner — .agent/ 目录扫描
 *
 * 纯函数模块，不依赖 pi API。扫描三个来源的内建/全局/项目级
 * .agent/ 目录，解析 agent.md 的 YAML frontmatter 和 context/ 目录。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { AgentEntry, AgentSource } from "./types";
import { AGENT_SUFFIX } from "./types";

// ── scanAgentDir ── 扫描单个目录下所有 .agent/ 子目录 ─────────────

/**
 * 扫描单个目录下的所有 .agent/ 子目录。
 * 目录不存在或不可读 → 返回 []。
 */
export function scanAgentDir(dir: string, source: AgentSource): AgentEntry[] {
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const agents: AgentEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (!entry.name.endsWith(AGENT_SUFFIX)) continue;

    const agentDir = path.join(dir, entry.name);
    const parsed = parseAgentDir(agentDir, source);
    if (parsed) {
      agents.push(parsed);
    }
  }

  agents.sort((a, b) => a.name.localeCompare(b.name));
  return agents;
}

// ── parseAgentDir ── 解析单个 .agent/ 目录 ─────────────────────────

/**
 * 解析单个 .agent/ 目录，返回 AgentEntry。
 * 格式不正确 → 返回 null。
 */
export function parseAgentDir(agentDir: string, source: AgentSource): AgentEntry | null {
  const agentMdPath = path.join(agentDir, "agent.md");

  // agent.md 必须存在
  if (!fs.existsSync(agentMdPath)) return null;

  let content: string;
  try {
    content = fs.readFileSync(agentMdPath, "utf-8");
  } catch {
    return null;
  }

  // 目录名去掉 .agent 后缀作为 name
  const dirName = path.basename(agentDir);
  let name = dirName.slice(0, -AGENT_SUFFIX.length);
  if (!name) return null;

  let description = "";
  let global = false;
  let model: string | undefined;
  let tools: string[] | undefined;
  let systemPrompt = content;

  try {
    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
    if (frontmatter?.name) name = frontmatter.name;
    description = frontmatter?.description ?? "";

    // global 字段
    if (frontmatter?.global !== undefined) {
      global = frontmatter.global === true || frontmatter.global === "true";
    }

    model = frontmatter?.model;

    if (frontmatter?.tools) {
      tools = frontmatter.tools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tools.length === 0) tools = undefined;
    }

    if (body?.trim()) systemPrompt = body.trim();
  } catch {
    // frontmatter 解析失败 → 全文作为 system prompt
  }

  // 检查 context/ 目录
  const contextDir = path.join(agentDir, "context");
  let hasContext = false;
  try {
    const ctxEntries = fs.readdirSync(contextDir);
    hasContext = ctxEntries.some((f) => f.endsWith(".md"));
  } catch {
    // context/ 不存在或不可读 → hasContext = false
  }

  return {
    name,
    dir: agentDir,
    source,
    filePath: agentMdPath,
    systemPrompt,
    description,
    hasContext,
    global,
    model,
    tools,
  };
}

// ── discoverAgents ── 三来源扫描 + 优先级合并 ──────────────────────

/**
 * 扫描三来源，按优先级合并（高优先级覆盖低优先级）：
 *   1. .pi/agents/（项目级）
 *   2. ~/.pi/agent/agents/（全局级）
 *   3. agent-manager/agents/（内建）
 */
export function discoverAgents(
  cwd: string,
  builtinDir: string,
  globalDir: string,
): AgentEntry[] {
  const builtin = scanAgentDir(builtinDir, "builtin");
  const globals = scanAgentDir(globalDir, "global");

  // 项目级：向上遍历找 .pi/agents/
  const projectDir = findProjectAgentsDir(cwd);
  const projects = projectDir ? scanAgentDir(projectDir, "project") : [];

  // 合并：按优先级 project > global > builtin
  const merged = new Map<string, AgentEntry>();

  for (const a of builtin) merged.set(a.name, a);
  for (const a of globals) merged.set(a.name, a);
  for (const a of projects) merged.set(a.name, a);

  const result = Array.from(merged.values());
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

// ── findProjectAgentsDir ── 向上找项目级 agents 目录 ────────────────

export function findProjectAgentsDir(cwd: string): string | null {
  let dir = cwd;
  while (true) {
    const candidate = path.join(dir, ".pi", "agents");
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // 不存在，继续向上
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
