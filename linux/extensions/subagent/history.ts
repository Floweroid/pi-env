/**
 * Subagent History — execution log persistence
 *
 * Saves subagent execution records to disk for debugging and review.
 * Creates: <projectRoot>/.pi/subagent-logs/<timestamp>-<agent>/
 *   - metadata.json  → execution metadata (updated incrementally)
 *   - events.jsonl   → each event as a JSON line (appended per event)
 *   - stderr.txt     → raw process stderr (if any)
 *
 * Memory-safe: events are written to disk incrementally and cleared from memory.
 * Use readSubagentLog(dir) to reconstruct full history from disk when needed.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Message } from "@earendil-works/pi-ai";

export interface SubagentHistoryRecord {
	agent: string;
	agentSource: string;
	model?: string;
	task: string;
	cwd: string;
	startTime: string;
	endTime: string;
	durationMs: number;
	exitCode: number;
	hasToolErrors: boolean;
	toolErrors: Array<{ toolName: string; error: string }>;
	output: string;
	stderr: string;
	/** Not persisted separately — events are in events.jsonl */
}

/**
 * Create log directory for a subagent run.
 * Returns the logDir path.
 */
export function createLogDir(
	record: Pick<SubagentHistoryRecord, "startTime" | "agent">,
	projectRoot: string,
): string {
	const safeTimestamp = record.startTime.replace(/[:.]/g, "-");
	const dirName = `${safeTimestamp}-${record.agent}`;
	const logDir = path.join(projectRoot, ".pi", "subagent-logs", dirName);
	fs.mkdirSync(logDir, { recursive: true });
	return logDir;
}

/**
 * Append a single event to the events.jsonl log file.
 * Low-level write function used by logSubprocessEvent.
 */
function appendSubagentEvent(
	logDir: string,
	eventType: string,
	event: any,
): void {
	try {
		const line = JSON.stringify({ type: eventType, ts: Date.now(), data: event }) + "\n";
		fs.appendFileSync(path.join(logDir, "events.jsonl"), line, "utf-8");
	} catch {
		// 静默
	}
}

/**
 * Parse and log any JSONL event from subprocess stdout.
 * This is the single entry point for logging all known event types.
 *
 * Event types handled:
 *   session_start, message_start, message_update, message_end,
 *   tool_execution_start, tool_execution_end, tool_result_end, session_info
 *
 * Returns the parsed event object for further processing by the caller,
 * or null if JSON parsing failed.
 */
export function logSubprocessEvent(
	logDir: string,
	rawLine: string,
): Record<string, any> | null {
	try {
		const event = JSON.parse(rawLine);
		const type = event.type as string;

		switch (type) {
			case "session_start":
				appendSubagentEvent(logDir, "session_start", { id: event.id, timestamp: event.timestamp });
				break;
			case "message_start":
				appendSubagentEvent(logDir, "message_start", event.message);
				break;
			case "message_update":
				appendSubagentEvent(logDir, "message_update", event.message);
				break;
			case "message_end":
				appendSubagentEvent(logDir, "message_end", event.message);
				break;
			case "tool_execution_start":
				appendSubagentEvent(logDir, "tool_execution_start", {
					toolName: event.toolName,
					args: event.args,
					toolCallId: event.toolCallId,
				});
				break;
			case "tool_execution_end":
				appendSubagentEvent(logDir, "tool_execution_end", {
					toolName: event.toolName,
					toolCallId: event.toolCallId,
					isError: event.isError,
					result: event.result,
				});
				break;
			case "tool_result_end":
				appendSubagentEvent(logDir, "tool_result_end", event.message);
				break;
			case "session_info":
				appendSubagentEvent(logDir, "session_info", { name: event.name });
				break;
		}

		return event;
	} catch {
		return null;
	}
}

/**
 * Update metadata.json with latest execution state.
 * Called after each event and on completion.
 * The file is rewritten each time (small, fixed-size).
 */
export function updateMetadata(
	logDir: string,
	meta: {
		agent: string;
		agentSource: string;
		model?: string;
		task: string;
		cwd: string;
		startTime: string;
		endTime: string;
		durationMs: number;
		exitCode?: number;
		stopReason?: string;
		errorMessage?: string;
		latestOutput?: string;
	},
): void {
	try {
		fs.writeFileSync(
			path.join(logDir, "metadata.json"),
			JSON.stringify(meta, null, 2),
			"utf-8",
		);
	} catch {
		// 静默
	}
}

/**
 * Finalize the log after subagent process exits.
 * Writes stderr.txt and marks completion in metadata.
 */
export function finalizeLog(
	logDir: string,
	stderr: string,
	exitCode: number,
	latestOutput: string,
	agent: string,
	agentSource: string,
	model: string | undefined,
	task: string,
	cwd: string,
	startTime: string,
	endTime: string,
	durationMs: number,
	stopReason?: string,
	errorMessage?: string,
): void {
	try {
		if (stderr) {
			fs.writeFileSync(path.join(logDir, "stderr.txt"), stderr, "utf-8");
		}
		updateMetadata(logDir, {
			agent,
			agentSource,
			model,
			task,
			cwd,
			startTime,
			endTime,
			durationMs,
			exitCode,
			stopReason,
			errorMessage,
			latestOutput,
		});
	} catch {
		// 静默
	}
}

/**
 * Read the final output from events.jsonl.
 * Returns the last assistant message text as the final result.
 * This matches the behavior of all major community subagent implementations.
 */
export function readReportOutput(logDir: string): string {
	try {
		const eventsPath = path.join(logDir, "events.jsonl");
		if (!fs.existsSync(eventsPath)) return "";

		const content = fs.readFileSync(eventsPath, "utf-8");
		const lines = content.split("\n").filter(Boolean);

		// Walk backwards, find the last assistant message_end with text
		for (let i = lines.length - 1; i >= 0; i--) {
			try {
				const entry = JSON.parse(lines[i]);
				if (entry.type === "message_end" && entry.data?.role === "assistant") {
					for (const part of entry.data.content || []) {
						if (part.type === "text" && part.text) {
							return part.text.trim();
						}
					}
				}
			} catch { /* skip */ }
		}

		return "";
	} catch {
		return "";
	}
}