/**
 * Subagent UI — chain 模式结果渲染
 */

import { Markdown, truncateToWidth } from "@earendil-works/pi-tui";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import type { SubagentDetails } from "../types.ts";
import { formatToolCall, formatUsageStats, getDisplayItems, getFinalOutput } from "../utils.ts";
import { renderDisplayItems, aggregateUsage } from "./helpers.ts";

export function renderChainResult(
	details: SubagentDetails,
	expanded: boolean,
	width: number,
	theme: any,
): string[] {
	const out: string[] = [];
	const mdTheme = getMarkdownTheme();

	const successCount = details.results.filter((r) => r.exitCode === 0).length;
	const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

	if (expanded) {
		out.push(truncateToWidth(
			`${icon} ${theme.fg("toolTitle", theme.bold("chain "))}${theme.fg("accent", `${successCount}/${details.results.length} steps`)}`,
			width, "..."));
		for (const r of details.results) {
			const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
			const displayItems = getDisplayItems(r.messages);
			const finalOutput = getFinalOutput(r.messages);
			out.push("");
			out.push(truncateToWidth(
				`${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}`, width, "..."));
			out.push(truncateToWidth(`${theme.fg("muted", "Task: ")}${theme.fg("dim", r.task)}`, width, "..."));
			for (const item of displayItems) {
				if (item.type === "toolCall")
					out.push(truncateToWidth(
						theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
						width, "..."));
			}
			if (finalOutput) {
				out.push("");
				out.push(...new Markdown(finalOutput.trim(), 0, 0, mdTheme).render(width));
			}
			const stepUsage = formatUsageStats(r.usage, r.model);
			if (stepUsage)
				out.push(truncateToWidth(theme.fg("dim", stepUsage), width, "..."));
		}
		const totalUsage = formatUsageStats(aggregateUsage(details.results));
		if (totalUsage) {
			out.push("");
			out.push(truncateToWidth(theme.fg("dim", `Total: ${totalUsage}`), width, "..."));
		}
	} else {
		out.push(truncateToWidth(
			`${icon} ${theme.fg("toolTitle", theme.bold("chain "))}${theme.fg("accent", `${successCount}/${details.results.length} steps`)}`,
			width, "..."));
		for (const r of details.results) {
			const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
			const displayItems = getDisplayItems(r.messages);
			out.push("");
			out.push(truncateToWidth(
				`${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}`,
				width, "..."));
			if (displayItems.length === 0)
				out.push(truncateToWidth(theme.fg("muted", "(no output)"), width, "..."));
			else
				for (const line of renderDisplayItems(displayItems, expanded, theme, 5).split("\n"))
					out.push(truncateToWidth(line, width, "..."));
		}
		const totalUsage = formatUsageStats(aggregateUsage(details.results));
		const hint = keyHint("app.tools.expand", "expand for full output");
		out.push(truncateToWidth(
			`${totalUsage ? theme.fg("dim", `Total: ${totalUsage}`) : ""}  ${theme.fg("muted", hint)}`,
			width, "..."));
	}

	return out;
}
