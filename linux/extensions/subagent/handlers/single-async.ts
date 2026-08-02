/**
 * Subagent — single 异步处理器
 *
 * 通过 spawn.ts 启动子进程后立即返回。
 * 完成后通过 sendUserMessage(followUp) 注入结果。
 * 通过 onEvent 回调实现 TUI widget 实时进度。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import type { AgentConfig } from "../agents.ts";
import type { SubagentDetails } from "../types.ts";
import { clearWidget, injectSubagentResult } from "../utils.ts";
import { createSubagentProcess } from "./spawn.ts";

interface SingleAsyncParams {
	agent: string;
	task: string;
	cwd?: string;
	agentScope: string;
	agentSource: "user" | "project" | "unknown";
	model?: string;
	tools?: string[];
	systemPrompt: string;
}

interface SingleAsyncResult {
	content: { type: "text"; text: string }[];
	details: SubagentDetails;
	terminate: boolean;
}

export async function handleSingleAsync(
	pi: ExtensionAPI,
	sessionUi: ExtensionContext["ui"] | null,
	sessionCwd: string | null,
	params: SingleAsyncParams,
	agent: AgentConfig,
	makeDetails: (results: any[]) => SubagentDetails,
	signal: AbortSignal | undefined,
	cwd: string,
): Promise<SingleAsyncResult> {
	const widgetId = `subagent-${Date.now()}`;
	const startTime = Date.now();
	let lastProgressText = "";
	let lastToolCallKey = "";
	const toolLines: string[] = [];
	let latestText = "";
	let lastSingleStateKey = "";

	sessionUi?.setStatus(widgetId, `⏳ ${params.agent} 运行中...`);

	// 防抖更新
	const updateWidget = () => {
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		const stateKey = `${toolLines.length}|${latestText?.slice(-30)||""}`;
		if (stateKey === lastSingleStateKey) return;
		lastSingleStateKey = stateKey;

		sessionUi?.setWidget(widgetId, (_tui, theme) => {
			const box = new Box(1, 0, (text: string) => theme.bg("toolPendingBg", text));
			box.addChild(new Text(theme.fg("toolTitle", theme.bold(` ⏳ ${params.agent} [${elapsed}s] `)), 0, 0));
			for (const tl of toolLines.slice(-3)) {
				const m = tl.match(/^→ (\w+): (.+)$/);
				box.addChild(new Text(
					m
						? theme.fg("muted", "  → ") + theme.fg("accent", m[1]) + theme.fg("dim", ` ${m[2]}`)
						: theme.fg("dim", `  ${tl}`),
					0, 0));
			}
			if (latestText) {
				box.addChild(new Text(theme.fg("muted", "  ──────────"), 0, 0));
				box.addChild(new Text(theme.fg("toolOutput", ` ${latestText} `), 0, 0));
			}
			return box;
		});
	};

	const { logDir, wait } = createSubagentProcess({
		agentName: params.agent,
		agentSource: params.agentSource,
		task: params.task,
		cwd: params.cwd ?? cwd,
		tools: params.tools,
		model: params.model,
		systemPrompt: params.systemPrompt,
		signal,
		onEvent: (event) => {
			if (event.type === "tool_execution_start") {
				const key = event.toolCallId || JSON.stringify(event.args);
				if (key === lastToolCallKey) return;
				lastToolCallKey = key;
				const argStr = JSON.stringify(event.args || {}).slice(0, 50);
				toolLines.push(`→ ${event.toolName}: ${argStr}`);
				updateWidget();
			} else if (event.type === "message_update" && event.message?.role === "assistant") {
				for (const part of event.message.content) {
					if (part.type === "text" && part.text && part.text !== lastProgressText) {
						lastProgressText = part.text;
						const trimmed = part.text.replace(/\n/g, " ").slice(-80);
						latestText = `...${trimmed}`;
						updateWidget();
						break;
					}
				}
			}
		},
	});

	// 完成后通过 followUp 注入结果
	wait().then((result) => {
		clearWidget(sessionUi, widgetId);
		injectSubagentResult(pi, params.agent, result);
	}).catch(() => {
		clearWidget(sessionUi, widgetId);
	});

	return {
		content: [{ type: "text", text: `✅ 子代理 "${params.agent}" 已启动，完成后自动注入结果到会话。` }],
		details: makeDetails([{
			agent: params.agent,
			agentSource: params.agentSource,
			task: params.task,
			exitCode: -1,
			messages: [],
			stderr: "",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		}]),
		terminate: true,
	};
}

