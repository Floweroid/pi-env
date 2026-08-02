/**
 * Agent 发现与配置。
 *
 * 使用 agent-manager 的 scanner 扫描三来源 agent：
 *   1. agent-manager/agents/（内建）
 *   2. ~/.pi/agent/agents/（全局）
 *   3. .pi/agents/（项目级，最高优先级）
 *
 * 主要函数：
 *   discoverAgents(cwd, scope) — 返回按 scope 过滤的 agent 列表
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { discoverAgents as mgrDiscoverAgents, scanAgentDir } from "../agent-manager/core/scanner.ts";


export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
}

const AGENT_DIR = getAgentDir();
const BUILTIN_DIR = path.join(AGENT_DIR, "extensions", "agent-manager", "agents");
const GLOBAL_DIR = path.join(AGENT_DIR, "agents");

/**
 * 按 scope 过滤 agent 列表。
 *
 * scope:
 *   "user"    — 内建 + 全局（用户级）
 *   "project" — 仅 .pi/agents/（项目级）
 *   "both"    — 全部合并，项目级覆盖用户级同名 agent
 */
export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
	const all = mgrDiscoverAgents(cwd, BUILTIN_DIR, GLOBAL_DIR);

	const projectAgents = all.filter((a) => a.source === "project");
	const userAgents = all.filter((a) => a.source !== "project");


	let agents: AgentConfig[];

	if (scope === "project") {
		agents = projectAgents.map(toAgentConfig);
	} else if (scope === "both") {
		const agentMap = new Map<string, AgentConfig>();
		for (const a of userAgents.map(toAgentConfig)) agentMap.set(a.name, a);
		for (const a of projectAgents.map(toAgentConfig)) agentMap.set(a.name, a); // 项目覆盖
		agents = Array.from(agentMap.values());
	} else {
		// "user"
		agents = userAgents.map(toAgentConfig);
	}

	// 找到项目 agents 目录路径
	const projectAgentsDir = cwd ? _findProjectAgentsDir(cwd) : null;


	return { agents, projectAgentsDir };
}

function toAgentConfig(entry: import("../agent-manager/core/types").AgentEntry): AgentConfig {
	return {
		name: entry.name,
		description: entry.description || entry.name,
		tools: entry.tools,
		model: entry.model,
		systemPrompt: entry.systemPrompt,
		source: entry.source === "project" ? "project" : "user",
		filePath: entry.filePath,
	};
}

/** 向上遍历找项目 .pi/agents/ 目录 */
function _findProjectAgentsDir(cwd: string): string | null {
	let dir = cwd;
	while (true) {
		const candidate = path.join(dir, ".pi", "agents");
		try {
			if (fs.statSync(candidate).isDirectory()) return candidate;
		} catch { /* 不存在，继续 */ }
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}
