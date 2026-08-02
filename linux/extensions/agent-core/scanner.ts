/**
 * agent-core scanner — shared agent file discovery and parsing
 *
 * Provides a single `scanAgentDir()` function used by both
 * selectable-agents (system prompt switching) and subagent (sub-agent execution).
 *
 * Not a pi extension — imported by other extensions via relative path.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter, getAgentDir } from "@earendil-works/pi-coding-agent";

// ── Types ────────────────────────────────────────────────────────────────

export type AgentSource = "user" | "project";

export interface AgentProfile {
	name: string;
	description?: string;
	tools?: string[];
	model?: string;
	systemPrompt: string;
	source: AgentSource;
	filePath: string;
}

// ── Scan single directory ────────────────────────────────────────────────

/**
 * Scan a single directory for agent .md files.
 * Parses YAML frontmatter (name, description, tools, model).
 * Returns empty array if directory doesn't exist or is unreadable.
 */
export function scanAgentDir(
	dir: string,
	source: AgentSource,
	filter?: (profile: AgentProfile) => boolean,
): AgentProfile[] {
	if (!fs.existsSync(dir)) return [];

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const agents: AgentProfile[] = [];

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		let name = entry.name.slice(0, -3); // remove .md
		if (!name) continue;

		let description: string | undefined;
		let tools: string[] | undefined;
		let model: string | undefined;
		let systemPrompt = content;

		try {
			const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
			if (frontmatter?.name) name = frontmatter.name;
			description = frontmatter?.description;
			model = frontmatter?.model;

			if (frontmatter?.tools) {
				tools = frontmatter.tools
					.split(",")
					.map((t: string) => t.trim())
					.filter(Boolean);
			}

			if (body?.trim()) systemPrompt = body.trim();
		} catch {
			// No frontmatter — use full content as system prompt
		}

		const profile: AgentProfile = {
			name,
			description,
			tools: tools && tools.length > 0 ? tools : undefined,
			model,
			systemPrompt,
			source,
			filePath,
		};

		if (filter && !filter(profile)) continue;
		agents.push(profile);
	}

	agents.sort((a, b) => a.name.localeCompare(b.name));
	return agents;
}

// ── Discover selectable-agents directory ─────────────────────────────────

/**
 * Find the selectable-agents/agents/ directory.
 * Priority: project-level > global-level.
 */
export function findSelectableAgentsDir(cwd: string): string | null {
	// Project-level: walk up from cwd
	let dir = cwd;
	while (true) {
		const candidate = path.join(dir, ".pi", "extensions", "selectable-agents", "agents");
		if (fs.existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	// Global-level
	const globalDir = path.join(getAgentDir(), "extensions", "selectable-agents", "agents");
	if (fs.existsSync(globalDir)) return globalDir;

	return null;
}

/**
 * Find nearest .pi/agents/ directory (project-local agent overrides).
 */
export function findNearestProjectAgentsDir(cwd: string): string | null {
	const isDir = (p: string) => {
		try { return fs.statSync(p).isDirectory(); } catch { return false; }
	};

	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, ".pi", "agents");
		if (isDir(candidate)) return candidate;
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

// ── Composite discovery (for subagent) ───────────────────────────────────

/**
 * Discover all available agents, merging from multiple sources.
 * Priority: project selectable-agents > global selectable-agents > project .pi/agents/
 *
 * Returns { agents, projectAgentsDir } for backward compatibility with subagent.
 */
export function discoverAgents(
	cwd: string,
	includeProject: boolean,
): { agents: AgentProfile[]; projectAgentsDir: string | null } {
	const selectableDir = findSelectableAgentsDir(cwd);
	const projectDir = includeProject ? findNearestProjectAgentsDir(cwd) : null;

	const agents: AgentProfile[] = [];

	// User-level agents (from selectable-agents)
	if (selectableDir) {
		agents.push(...scanAgentDir(selectableDir, "user"));
	}

	// Project-level agents (from .pi/agents/)
	if (projectDir) {
		agents.push(...scanAgentDir(projectDir, "project"));
	}

	return { agents, projectAgentsDir: projectDir };
}

