/**
 * Subagent — parallel 异步处理器
 *
 * 通过 spawn.ts 并发启动多个子进程。
 * 各子进程独立写日志，结果通过 sendUserMessage 注入。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import type { AgentConfig } from "../agents.ts";
import type { SubagentDetails } from "../types.ts";
import { clearWidget, injectSubagentResult } from "../utils.ts";
import { createSubagentProcess } from "./spawn.ts";

interface ParallelTask {
	agent: string;
	task: string;
	cwd?: string;
}

interface ParallelResult {
	content: { type: "text"; text: string }[];
	details: SubagentDetails;
	terminate: boolean;
}

export async function handleParallelAsync(
	pi: ExtensionAPI,
	sessionUi: ExtensionContext["ui"] | null,
	sessionCwd: string | null,
	params: { tasks: ParallelTask[] },
	agents: AgentConfig[],
	makeDetails: (results: any[]) => SubagentDetails,
	signal: AbortSignal | undefined,
): Promise<ParallelResult> {
	const widgetId = `subagent-${Date.now()}`;
	let doneCount = 0;
	const totalTasks = params.tasks.length;
	const taskEntries = params.tasks.map((t) => ({
		agent: t.agent,
		summary: (t.task.length > 40 ? t.task.slice(0, 40) + "..." : t.task),
		icon: "→" as string,
		activity: "" as string,
	}));

	const updateWidget = () => {
		sessionUi?.setWidget(widgetId, (_tui, theme) => {
			const box = new Box(1, 0, (text: string) => theme.bg("toolPendingBg", text));
			box.addChild(new Text(theme.fg("toolTitle",
				theme.bold(` ⏳ parallel [${doneCount}/${totalTasks} done] `)), 0, 0));
			for (const e of taskEntries) {
				const c = e.icon === "✓" ? "success" : e.icon === "✗" ? "error" : "dim";
				box.addChild(new Text(theme.fg(c as any,
					`  ${e.icon} ${e.agent}  ${e.summary}`), 0, 0));
				if (e.activity) box.addChild(new Text(theme.fg("dim", `    ${e.activity.slice(0, 60)}`), 0, 0));
			}
			return box;
		});
	};

	sessionUi?.setStatus(widgetId, `⏳ ${totalTasks} subagents running...`);
	updateWidget();

	const spawnOne = async (t: ParallelTask, index: number) => {
		const entry = taskEntries[index];
		const agent = agents.find((a) => a.name === t.agent);
		if (!agent) {
			entry.icon = "✗";
			pi.sendUserMessage(`[subagent ${t.agent}] ❌ Unknown agent.`, { deliverAs: "followUp" });
			doneCount++;
			if (doneCount >= totalTasks) {
				clearWidget(sessionUi, widgetId);
			} else {
				updateWidget();
			}
			return;
		}

		if (index > 0) await new Promise((r) => setTimeout(r, 50));

		const { wait } = createSubagentProcess({
			agentName: t.agent,
			agentSource: agent.source,
			task: t.task,
			cwd: t.cwd ?? sessionCwd ?? process.cwd(),
			tools: agent.tools,
			model: agent.model,
			systemPrompt: agent.systemPrompt,
			signal,
		});

		const result = await wait();

		entry.icon = result.exitCode === 0 ? "✓" : "✗";

		injectSubagentResult(pi, t.agent, result);

		doneCount++;
		if (doneCount >= totalTasks) {
			clearWidget(sessionUi, widgetId);
		} else {
			updateWidget();
		}
	};

	// 立即触发不等待单次结果
	params.tasks.forEach((t, i) => { spawnOne(t, i); });

	return {
		content: [{ type: "text", text: `✅ ${totalTasks} 个子代理已启动，完成后各自注入结果到会话。` }],
		details: makeDetails([]),
		terminate: true,
	};
}

