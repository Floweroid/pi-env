/**
 * Subagent UI — 调用阶段渲染（renderCall）
 *
 * 显示 agent 名称、任务预览、scope 等信息。
 * 三种模式各有不同的排版。
 */

import type { AgentScope } from "../agents.ts";
import { truncateToWidth } from "@earendil-works/pi-tui";

export function renderCall(args: any, theme: any, context: any) {
	const cache = context.state as { key?: string; lines?: string[]; width?: number };
	const scope: AgentScope = args.agentScope ?? "user";
	const key = JSON.stringify(args);

	return {
		invalidate() { cache.width = undefined; cache.lines = undefined; cache.key = undefined; },
		render(width: number): string[] {
			if (cache.key === key && cache.width === width && cache.lines) return cache.lines;
			const out: string[] = [];

			if (args.chain && args.chain.length > 0) {
				out.push(truncateToWidth(
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`), width, "..."));
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					const cleanTask = (step.task || "").replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					out.push(truncateToWidth(
						`  ${theme.fg("muted", `${i + 1}.`)} ${theme.fg("accent", step.agent)} ${theme.fg("dim", preview)}`,
						width, "..."));
				}
				if (args.chain.length > 3)
					out.push(truncateToWidth(theme.fg("muted", `  ... +${args.chain.length - 3} more`), width, "..."));
			} else if (args.tasks && args.tasks.length > 0) {
				out.push(truncateToWidth(
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`), width, "..."));
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task?.length > 40 ? `${t.task.slice(0, 40)}...` : (t.task || theme.fg("dim", "..."));
					out.push(truncateToWidth(`  ${theme.fg("accent", t.agent || "?")} ${theme.fg("dim", preview)}`, width, "..."));
				}
				if (args.tasks.length > 3)
					out.push(truncateToWidth(theme.fg("muted", `  ... +${args.tasks.length - 3} more`), width, "..."));
			} else {
				const agentName = args.agent || "...";
				const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
				out.push(truncateToWidth(
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", agentName) +
					theme.fg("muted", ` [${scope}]`), width, "..."));
				out.push(truncateToWidth(`  ${theme.fg("dim", preview)}`, width, "..."));
			}

			cache.key = key; cache.width = width; cache.lines = out;
			return out;
		},
	};
}
