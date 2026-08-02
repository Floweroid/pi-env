/**
 * Subagent UI — single 模式结果渲染
 */

import type { SingleResult, DisplayItem } from "../types.ts";
import { Markdown, truncateToWidth } from "@earendil-works/pi-tui";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { COLLAPSED_ITEM_COUNT, formatToolCall, formatUsageStats, getDisplayItems, getFinalOutput, isFailedResult } from "../utils.ts";
import { renderDisplayItems } from "./helpers.ts";

export function renderSingleResult(
	r: SingleResult,
	expanded: boolean,
	width: number,
	theme: any,
): string[] {
	const out: string[] = [];
	const mdTheme = getMarkdownTheme();

	const isRunning = r.exitCode === -1;
	const isError = isFailedResult(r);
	const icon = isRunning ? theme.fg("warning", "⏳") : isError ? theme.fg("error", "✗") : theme.fg("success", "✓");

	if (isRunning) {
		out.push(truncateToWidth(
			`${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)} ${theme.fg("warning", "[running...]")}`,
			width, "..."));
		return out;
	}

	const displayItems = getDisplayItems(r.messages);
	const finalOutput = getFinalOutput(r.messages);
	let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
	if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
	out.push(truncateToWidth(header, width, "..."));

	if (isError && r.errorMessage)
		out.push(truncateToWidth(theme.fg("error", `Error: ${r.errorMessage}`), width, "..."));

	if (expanded) {
		out.push(truncateToWidth(theme.fg("muted", "─── Task ───"), width, "..."));
		out.push(truncateToWidth(theme.fg("dim", r.task), width, "..."));
		out.push(truncateToWidth(theme.fg("muted", "─── Output ───"), width, "..."));
		if (displayItems.length === 0 && !finalOutput) {
			out.push(truncateToWidth(theme.fg("muted", "(no output)"), width, "..."));
		} else {
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
		}
	} else {
		if (displayItems.length === 0)
			out.push(truncateToWidth(theme.fg("muted", "(no output)"), width, "..."));
		else
			for (const line of renderDisplayItems(displayItems, expanded, theme, COLLAPSED_ITEM_COUNT).split("\n"))
				out.push(truncateToWidth(line, width, "..."));
	}

	const usageStr = formatUsageStats(r.usage, r.model);
	const hint = expanded ? "" : `  ${keyHint("app.tools.expand", "expand for full output")}`;
	out.push(truncateToWidth(`${usageStr ? theme.fg("dim", usageStr) : ""}${hint}`, width, "..."));

	return out;
}
