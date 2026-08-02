/**
 * Subagent 工具注册
 *
 * 包含：
 *   - TypeBox schema 定义（TaskItem / ChainItem / SubagentParams）
 *   - subagent 工具：single / parallel / chain 三种模式的派发
 *   - subagent_kill 工具：终止运行中的子代理
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { type AgentConfig, type AgentScope, discoverAgents } from "../agents.ts";
import { renderCall, renderResult } from "../ui/index.ts";
import type { SubagentDetails } from "../types.ts";
import { formatAgentList } from "../utils.ts";
import { handleSingleAsync } from "../handlers/single-async.ts";
import { handleParallelAsync } from "../handlers/parallel.ts";
import { handleChain } from "../handlers/chain.ts";
import { subagentRegistry } from "../handlers/spawn.ts";

// ── TypeBox schema ──────────────────────────────────────────────────────

const TaskItem = Type.Object({
	agent: Type.String({ description: "要调用的 agent 名称" }),
	task: Type.String({ description: "要委托的任务" }),
	cwd: Type.Optional(Type.String({ description: "子代理进程的工作目录" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "要调用的 agent 名称" }),
	task: Type.String({ description: "包含可选 {previous} 占位符的任务" }),
	cwd: Type.Optional(Type.String({ description: "子代理进程的工作目录" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: '使用的 agent 目录。默认 "user"。设为 "both" 可包含项目本地 agent（.pi/agents）。',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "要调用的 agent 名称（single 模式）" })),
	task: Type.Optional(Type.String({ description: "要委托的任务（single 模式）" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "{agent, task} 数组，用于并行执行" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "{agent, task} 数组，用于顺序执行" })),

	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "运行项目本地 agent 前先提示确认。默认 true。", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "子代理进程的工作目录（single 模式）" })),
});

// ── 会话数据（由 index.ts 的 session_start 填充）─────────────────────────

interface SessionData {
	sessionUi: ExtensionContext["ui"] | null;
	sessionCwd: string | null;
}

// ── 注册所有工具 ────────────────────────────────────────────────────────

export function registerTools(
	pi: ExtensionAPI,
	getSession: () => SessionData,
) {
	// ── subagent ──
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single ({agent, task}), parallel ({tasks: [...]}), chain ({chain: [...]}, sequential with {previous} placeholder).",
			'Default agent scope is "user" (from ~/.pi/agent/agents). Set agentScope: "both" to include project-local agents in .pi/agents.',
			"Set confirmProjectAgents: false to skip project-agent confirmation dialog.",
			"Set cwd to override the working directory for the subagent process.",
		].join(" "),
		promptSnippet: "Delegate tasks to specialized subagents (ops, pi-env, agent-maker, proj-mana) with isolated context",
		promptGuidelines: [
			"Use subagent to offload substantial work (multi-step investigation, large-scope changes) to keep main context clean. Do NOT delegate single read/grep/edit tasks.",
			"Available agents: ops (运维管理 — 服务器监控、服务管理、故障排查), pi-env (Pi 环境管理 — 配置中心维护、扩展发布、多设备同步), agent-maker (Agent 管理 — 创建/维护 agent), proj-mana (项目管理 — 项目计划、开发文档、规范划分).",
			"Single mode: {agent, task}. Parallel mode: {tasks: [{agent, task, cwd?}, ...]}. Chain mode: {chain: [{agent, task, cwd?}, ...]} with {previous} placeholder for sequential handoff.",
			"All modes are async (non-blocking, result auto-injected).",
			"Pass cwd per task to set the working directory for each subagent process independently.",
		],
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const { sessionUi, sessionCwd } = getSession();

			const agentScope: AgentScope = params.agentScope ?? "user";
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: any[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			// ── 校验 ──
			if (modeCount !== 1) {
				const available = formatAgentList(agents);
				return {
					content: [{ type: "text", text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}` }],
					details: makeDetails("single")([]),
				};
			}

			// ── 项目 agent 权限门控 ──
			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			// ── 路由 ──
			if (hasChain) {
				return handleChain(ctx.cwd, agents, { chain: params.chain! }, onUpdate, makeDetails("chain"), signal);
			}

			if (hasTasks) {
				return handleParallelAsync(pi, sessionUi, sessionCwd, {
					tasks: params.tasks!,
				}, agents, makeDetails("parallel"), signal);
			}

			if (hasSingle) {
				const agent = agents.find((a) => a.name === params.agent);
				if (!agent) {
					const available = formatAgentList(agents);
					return {
						content: [{ type: "text", text: `Unknown agent: "${params.agent}". Available: ${available}.` }],
						details: makeDetails("single")([]),
						isError: true,
					};
				}

				return handleSingleAsync(pi, sessionUi, sessionCwd, {
					agent: params.agent,
					task: params.task!,
					cwd: params.cwd,
					agentScope,
					agentSource: agent.source,
					model: agent.model,
					tools: agent.tools,
					systemPrompt: agent.systemPrompt,
				}, agent, makeDetails("single"), signal, ctx.cwd);
			}

			const available = formatAgentList(agents);
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall,
		renderResult,
	});

	// ── subagent_kill ──
	pi.registerTool({
		name: "subagent_kill",
		label: "Subagent Kill",
		description:
			"Terminate a running subagent by its ID. Sends SIGTERM first, then SIGKILL after 5 seconds if still alive.",
		parameters: Type.Object({
			task_id: Type.String({ description: "The subagent ID (displayed in subagent result header)" }),
		}),
		async execute(_toolCallId, params) {
			const entry = subagentRegistry.get(params.task_id);
			if (!entry) {
				return { content: [{ type: "text", text: `子代理 ${params.task_id} 不存在或已完成。` }] };
			}

			entry.kill();
			return {
				content: [{
					type: "text",
					text: `⛔ 已发送终止信号给子代理 ${params.task_id}（${entry.agentName}: ${entry.task.slice(0, 60)}）。`,
				}],
			};
		},
	});
}
