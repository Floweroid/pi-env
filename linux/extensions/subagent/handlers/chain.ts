/**
 * Subagent — chain 处理器（顺序同步）
 *
 * 按顺序依次运行 agent，通过 {previous} 在步骤间传递输出。
 * 每步使用 createSubagentProcess。
 */

import type { AgentConfig } from "../agents.ts";
import type { SubagentDetails, SingleResult } from "../types.ts";
import { isFailedResult, toSingleResult } from "../utils.ts";
import { createSubagentProcess } from "./spawn.ts";

interface ChainStep {
	agent: string;
	task: string;
	cwd?: string;
}

interface ChainResult {
	content: { type: "text"; text: string }[];
	details: SubagentDetails;
	isError?: boolean;
}

export async function handleChain(
	cwd: string,
	agents: AgentConfig[],
	params: { chain: ChainStep[] },
	onUpdate: ((partial: any) => void) | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
	signal: AbortSignal | undefined,
): Promise<ChainResult> {
	const results: SingleResult[] = [];
	let previousOutput = "";

	for (let i = 0; i < params.chain.length; i++) {
		const step = params.chain[i];
		const agent = agents.find((a) => a.name === step.agent);
		if (!agent) {
			return {
				content: [{ type: "text", text: `Chain stopped at step ${i + 1}: unknown agent "${step.agent}".` }],
				details: makeDetails(results),
				isError: true,
			};
		}

		const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

		const { wait } = createSubagentProcess({
			agentName: step.agent,
			agentSource: agent.source,
			task: taskWithContext,
			cwd: step.cwd ?? cwd,
			tools: agent.tools,
			model: agent.model,
			systemPrompt: agent.systemPrompt,
			signal,
		});

		const result = await wait();

		const singleResult = toSingleResult(result, {
			agent: step.agent,
			agentSource: agent.source,
			task: taskWithContext,
			step: i + 1,
		});
		results.push(singleResult);

		if (isFailedResult(singleResult)) {
			return {
				content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${result.output || result.stderr}` }],
				details: makeDetails(results),
				isError: true,
			};
		}

		previousOutput = result.output;

		onUpdate?.({
			content: [{ type: "text", text: result.output }],
			details: makeDetails(results),
		});
	}

	return {
		content: [{ type: "text", text: previousOutput || "(no output)" }],
		details: makeDetails(results),
	};
}

