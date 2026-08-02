/**
 * 共享子进程 spawn 逻辑。
 *
 * 提供 createSubagentProcess() 供所有执行模式使用。
 * 保证一致性：
 *   - --no-extensions + --tools 强制工具遮蔽
 *   - detached: true / windowsHide: true 进程隔离
 *   - 增量日志写入 events.jsonl
 *   - finalizeLog + readReportOutput 从日志读取最终输出
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { createLogDir, logSubprocessEvent, finalizeLog, readReportOutput } from "../history.ts";
import { getPiInvocation } from "../utils.ts";

// ── 运行中进程注册表（供 subagent_kill 工具查询）─────────────────────────

export interface SubagentEntry {
	id: string;
	agentName: string;
	task: string;
	startTime: number;
	kill: () => void;
}

export const subagentRegistry = new Map<string, SubagentEntry>();
let subagentSeq = 0;

// ── 类型 ────────────────────────────────────────────────────────────────

export interface SubagentProcessOptions {
	agentName: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	cwd: string;
	tools?: string[];
	model?: string;
	systemPrompt: string;
	signal?: AbortSignal;
	onStderr?: (text: string) => void;
	/** 每个解析后的 stdout 事件，用于实时 UI 更新 */
	onEvent?: (event: Record<string, any>) => void;
}

export interface SubagentProcessResult {
	exitCode: number;
	output: string;
	id: string;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens: number;
		turns: number;
	};
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	stderr: string;
}

export interface SubagentProcessControl {
	proc: ChildProcess;
	logDir: string;
	kill: () => void;
	wait: () => Promise<SubagentProcessResult>;
}

// ── 启动 ────────────────────────────────────────────────────────────────

/**
 * 创建子代理子进程。
 *
 * 返回控制对象：
 *   - proc: ChildProcess
 *   - logDir: events.jsonl 写入目录
 *   - kill(): 终止进程
 *   - wait(): 进程退出时 resolve 的 Promise
 */
export function createSubagentProcess(opts: SubagentProcessOptions): SubagentProcessControl {
	const {
		agentName, agentSource, task, cwd,
		tools, model,
		signal, onStderr,
	} = opts;

	// ── 构建参数 ──
	const args: string[] = [
		"--mode", "json", "-p", "--no-session",
		"--no-skills", "--no-prompt-templates",
	];
	if (model) args.push("--model", model);
	if (tools && tools.length > 0) args.push("--tools", tools.join(","));

	args.push(`Task: ${task}`);

	// ── 子代理环境（agent-manager 在 session_start 中检查）──
	const subEnv = { ...process.env, PI_ACTIVE_AGENT: agentName };

	// ── 启动进程 ──
	const invocation = getPiInvocation(args);
	const startTime = Date.now();
	const registryId = `sub_${Date.now().toString(36)}_${++subagentSeq}`;
	const logDir = createLogDir({ startTime: new Date(startTime).toISOString(), agent: agentName }, cwd);

	let stderrAccum = "";
	let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
	let resolvedModel = model;
	let stopReason: string | undefined;
	let errorMessage: string | undefined;

	const proc = spawn(invocation.command, invocation.args, {
		cwd,
		shell: false,
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
		...(process.platform === "win32" ? { windowsHide: true } : {}),
		env: subEnv,
	});

	// ── stdout: 增量 JSONL 解析 ──
	proc.stdout.on("data", (data) => {
		const text = data.toString();
		for (const line of text.split("\n").filter(Boolean)) {
			const event = logSubprocessEvent(logDir, line);
			if (!event) continue;

			if (event.type === "message_end" && event.message?.role === "assistant") {
				const msg = event.message;
				const u = msg.usage;
				if (u) {
					usage.input += u.input || 0;
					usage.output += u.output || 0;
					usage.cacheRead += u.cacheRead || 0;
					usage.cacheWrite += u.cacheWrite || 0;
					usage.cost += u.cost?.total || 0;
					usage.contextTokens = u.totalTokens || 0;
				}
				if (!resolvedModel && msg.model) resolvedModel = msg.model;
				if (msg.stopReason) stopReason = msg.stopReason;
				if (msg.errorMessage) errorMessage = msg.errorMessage;
			}

			// 转发事件给调用方用于实时 UI
			opts.onEvent?.(event);
		}
	});

	// ── stderr ──
	proc.stderr.on("data", (data) => {
		const text = data.toString();
		stderrAccum += text;
		onStderr?.(text);
	});

	// ── 进程退出 ──
	const waitPromise = new Promise<SubagentProcessResult>((resolve) => {
		proc.on("close", (code) => {
			subagentRegistry.delete(registryId);
			const endTime = new Date().toISOString();
			const durationMs = Date.now() - startTime;

			const output = readReportOutput(logDir);

			finalizeLog(
				logDir, stderrAccum, code ?? 1, output,
				agentName, agentSource, resolvedModel, task,
				cwd,
				new Date(startTime).toISOString(), endTime, durationMs,
				stopReason, errorMessage,
			);

			// 清理临时文件

			resolve({
				exitCode: code ?? 1,
				output,
				id: registryId,
				usage,
				model: resolvedModel,
				stopReason,
				errorMessage,
				stderr: stderrAccum,
			});
		});

		proc.on("error", () => {
			subagentRegistry.delete(registryId);
			resolve({
				exitCode: 1,
				output: "",
				id: registryId,
				usage,
				model: resolvedModel,
				stopReason: "error",
				errorMessage: "Process failed to start",
				stderr: stderrAccum,
			});
		});
	});

	// ── 信号 / 中断 ──
	let wasKilled = false;
	const killProc = () => {
		wasKilled = true;
		proc.kill("SIGTERM");
		setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
	};

	subagentRegistry.set(registryId, {
		id: registryId,
		agentName,
		task,
		startTime,
		kill: killProc,
	});

	if (signal) {
		if (signal.aborted) killProc();
		else signal.addEventListener("abort", killProc, { once: true });
	}

	return {
		proc,
		logDir,
		kill: killProc,
		wait: () => wasKilled
			? Promise.resolve({
				exitCode: 1,
				output: "",
				id: registryId,
				usage,
				model: resolvedModel,
				stopReason: "aborted",
				errorMessage: "Subprocess was aborted",
				stderr: stderrAccum,
			})
			: waitPromise,
	};
}




