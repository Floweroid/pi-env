/**
 * Subagent UI — parallel 模式结果渲染
 */

import { Box, Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import type { SubagentDetails } from "../types.ts";
import { formatToolCall, formatUsageStats, getDisplayItems, getFinalOutput, isFailedResult } from "../utils.ts";
import { renderDisplayItems, aggregateUsage } from "./helpers.ts";

export function renderParallelResult(
	details: SubagentDetails,
	expanded: boolean,
	width: number,
	theme: any,
): string[] {
	const out: string[] = [];
	const mdTheme = getMarkdownTheme();

	const running = details.results.filter((r) => r.exitCode === -1).length;
	const successCount = details.results.filter((r) => r.exitCode !== -1 && !isFailedResult(r)).length;
	const failCount = details.results.filter((r) => r.exitCode !== -1 && isFailedResult(r)).length;
	const isRunningMode = running > 0;
	const icon = isRunningMode ? theme.fg("warning", "⏳") : failCount > 0 ? theme.fg("warning", "◐") : theme.fg("success", "✓");
	const status = isRunningMode
		? `${successCount + failCount}/${details.results.length} done, ${running} running`
		: `${successCount}/${details.results.length} tasks`;

	if (expanded && !isRunningMode) {
		out.push(truncateToWidth(
			`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`, width, "..."));
		for (const r of details.results) {
			const rIcon = isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
			const displayItems = getDisplayItems(r.messages);
			const finalOutput = getFinalOutput(r.messages);
			const box = new Box(0, 1, (text: string) => theme.bg(isFailedResult(r) ? "toolErrorBg" : "toolSuccessBg", text));
			box.addChild(new Text(
				`${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`, 0, 0));
			box.addChild(new Text(
				`${theme.fg("muted", "Task: ")}${theme.fg("dim", r.task)}`, 0, 0));
			for (const item of displayItems) {
				if (item.type === "toolCall")
					box.addChild(new Text(
						theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
						0, 0));
			}
			if (finalOutput) {
				const mdLines = new Markdown(finalOutput.trim(), 0, 0, mdTheme).render(width - 4);
				if (mdLines.length > 0) {
					box.addChild(new Text("", 0, 0));
					for (const line of mdLines)
						box.addChild(new Text(line, 0, 0));
				}
			}
			const taskUsage = formatUsageStats(r.usage, r.model);
			if (taskUsage)
				box.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
			out.push("");
			out.push(...box.render(width));
		}
		const totalUsage = formatUsageStats(aggregateUsage(details.results));
		if (totalUsage) {
			out.push("");
			out.push(truncateToWidth(theme.fg("dim", `Total: ${totalUsage}`), width, "..."));
		}
	} else {
		out.push(truncateToWidth(
			`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`,
			width, "..."));
		for (const r of details.results) {
			const rIcon = r.exitCode === -1 ? theme.fg("warning", "⏳") : isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
			const displayItems = getDisplayItems(r.messages);
			const box = new Box(0, 1, (text: string) => theme.bg(r.exitCode === -1 ? "toolPendingBg" : isFailedResult(r) ? "toolErrorBg" : "toolSuccessBg", text));
			box.addChild(new Text(
				`${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`, 0, 0));
			if (displayItems.length === 0)
				box.addChild(new Text(
					theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)"), 0, 0));
			else
				for (const line of renderDisplayItems(displayItems, expanded, theme, 5).split("\n"))
					box.addChild(new Text(line, 0, 0));
			out.push("");
			out.push(...box.render(width));
		}
		if (!isRunningMode) {
			const totalUsage = formatUsageStats(aggregateUsage(details.results));
			const hint = keyHint("app.tools.expand", "expand for full output");
			out.push(truncateToWidth(
				`${totalUsage ? theme.fg("dim", `Total: ${totalUsage}`) : ""}  ${theme.fg("muted", hint)}`,
				width, "..."));
		} else {
			out.push(truncateToWidth(
				theme.fg("muted", keyHint("app.tools.expand", "expand for full output")),
				width, "..."));
		}
	}

	return out;
}
