/**
 * Async Tasks — tools + shared state
 *
 * Exports:
 *   tasks       — Map of all tasks (used by index.ts for session_shutdown)
 *   registerTools(pi) — registers async_run / async_list / async_peek / async_kill
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import type { TaskInfo } from "./types.ts";

// ── Shared state ─────────────────────────────────────────────────────────

export const tasks = new Map<string, TaskInfo>();
let taskSeq = 0;

function injectResult(pi: ExtensionAPI, task: TaskInfo) {
  if (task.resultInjected) return;
  task.resultInjected = true;

  const icons: Record<string, string> = { done: "✅", failed: "❌", killed: "⛔" };
  const labels: Record<string, string> = { done: "完成", failed: "失败", killed: "已中断" };
  const icon = icons[task.status] || "❓";
  const label = labels[task.status] || task.status;
  const elapsed = ((task.finishedAt! - task.createdAt) / 1000).toFixed(1);
  let content = `[后台任务${label} ${task.id}]\n${icon} 状态: ${label} | 耗时: ${elapsed}s | 退出码: ${task.exitCode}\n命令: ${task.command}`;

  if (task.stdout) content += `\n\n--- stdout ---\n${task.stdout.slice(-4000)}`;
  if (task.stderr) content += `\n\n--- stderr ---\n${task.stderr.slice(-4000)}`;

  try {
    pi.sendMessage(
      { customType: "async_task_result", content, display: true },
      { triggerTurn: true },
    );
  } catch {
    // 扩展已失效（reload/session 切换），静默忽略
  }

  // 30 分钟后清理，避免内存泄漏
  setTimeout(() => tasks.delete(task.id), 30 * 60 * 1000);
}

// ── Tool registration ────────────────────────────────────────────────────

export function registerTools(pi: ExtensionAPI) {

  // ── async_run ──
  pi.registerTool({
    name: "async_run",
    label: "Async Run",
    description:
      "Run a shell command. Returns immediately with a task_id; results are auto-injected when done. Uses bash on Linux, powershell.exe on Windows.",
    parameters: Type.Object({
      command: Type.String({ description: "Command to run (Windows: powershell with ;, Unix: bash)" }),
      cwd: Type.Optional(Type.String({ description: "Working directory (default: project root)" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const workDir = params.cwd || ctx.cwd;
      const startTime = Date.now();
      const taskId = `task_${Date.now().toString(36)}_${++taskSeq}`;
      const task: TaskInfo = {
        id: taskId,
        command: params.command,
        cwd: workDir,
        status: "running",
        exitCode: null,
        stdout: "",
        stderr: "",
        createdAt: startTime,
        finishedAt: null,
        resultInjected: false,
      };
      tasks.set(taskId, task);

      const isWindows = process.platform === "win32";
      const child = isWindows
        ? spawn("powershell.exe", ["-NoProfile", "-Command", params.command], {
            cwd: workDir,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          })
        : spawn(params.command, {
            cwd: workDir,
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

      task.child = child;

      child.stdout.on("data", (data: Buffer) => {
        task.stdout += data.toString();
        if (task.stdout.length > 1_000_000) task.stdout = task.stdout.slice(-1_000_000);
      });
      child.stderr.on("data", (data: Buffer) => {
        task.stderr += data.toString();
        if (task.stderr.length > 1_000_000) task.stderr = task.stderr.slice(-1_000_000);
      });

      let settled = false;

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        const t = tasks.get(taskId);
        if (t) {
          t.status = "failed";
          t.exitCode = 1;
          t.stderr = (t.stderr ? t.stderr + "\n" : "") + `[spawn error] ${err.message}`;
          t.finishedAt = Date.now();
          injectResult(pi, t);
        }
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        const t = tasks.get(taskId);
        if (!t) return;
        if (t.status !== "killed") {
          t.status = code === 0 ? "done" : "failed";
          t.exitCode = code ?? 1;
          t.finishedAt = Date.now();
        }
        injectResult(pi, t);
      });

      return { content: [{ type: "text", text: `✅ 后台任务已启动: ${taskId}\n命令: ${params.command}` }] };
    },
  });

  // ── async_list ──
  pi.registerTool({
    name: "async_list",
    label: "Async List",
    description: "List all background tasks (running and completed).",
    parameters: Type.Object({}),
    async execute() {
      if (!tasks.size) return { content: [{ type: "text", text: "无后台任务" }] };

      const all = [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
      const icons: Record<string, string> = { running: "⏳", done: "✅", failed: "❌", killed: "⛔" };
      const lines = all.map(t =>
        `${icons[t.status] || "❓"} ${t.id}  [${t.status}]  ${t.command.slice(0, 60)}`
      );

      return { content: [{ type: "text", text: lines.join("\n") }], details: { tasks: all.map(({ child: _, ...rest }) => rest) } };
    },
  });

  // ── async_peek ──
  pi.registerTool({
    name: "async_peek",
    label: "Async Peek",
    description:
      "Peek at the live stdout/stderr of a running or completed background task. Returns the last N characters.\n\nUsage: Use peek once to check progress, then STOP. Do NOT loop peek calls.\nInstead, notify the user and request your next action while waiting.",
    parameters: Type.Object({
      task_id: Type.String({ description: "The task ID returned by async_run" }),
      tail: Type.Optional(Type.Number({ description: "Return last N characters (default: 2000, max: 8000)" })),
    }),
    async execute(_toolCallId, params) {
      const task = tasks.get(params.task_id);
      if (!task) {
        return { content: [{ type: "text", text: `任务 ${params.task_id} 不存在或已被清理（30 分钟后自动清理）。` }] };
      }

      const tail = Math.min(params.tail ?? 2000, 8000);
      const elapsed = ((Date.now() - task.createdAt) / 1000).toFixed(1);
      const icons: Record<string, string> = { running: "⏳", done: "✅", failed: "❌", killed: "⛔" };
      const icon = icons[task.status] || "❓";

      let content = `${icon} ${task.id}  [${task.status}]  运行 ${elapsed}s | ${task.command.slice(0, 80)}`;

      if (task.stdout) {
        content += `\n\n--- stdout (最近 ${tail} 字符) ---\n${task.stdout.slice(-tail)}`;
      } else {
        content += `\n(尚无 stdout 输出)`;
      }

      if (task.stderr) {
        content += `\n\n--- stderr (最近 ${tail} 字符) ---\n${task.stderr.slice(-tail)}`;
      }

      if (task.status !== "running") {
        content += `\n\n退出码: ${task.exitCode}`;
      }

      return { content: [{ type: "text", text: content }] };
    },
  });

  // ── async_kill ──
  pi.registerTool({
    name: "async_kill",
    label: "Async Kill",
    description:
      "Terminate a running background task by task_id. Sends SIGTERM first, then SIGKILL after 3 seconds if still alive. Already-completed tasks are not affected.",
    parameters: Type.Object({
      task_id: Type.String({ description: "The task ID returned by async_run" }),
    }),
    async execute(_toolCallId, params) {
      const task = tasks.get(params.task_id);
      if (!task) {
        return { content: [{ type: "text", text: `任务 ${params.task_id} 不存在或已被清理。` }] };
      }

      if (task.status !== "running") {
        return { content: [{ type: "text", text: `任务 ${params.task_id} 已经结束（状态: ${task.status}），无需终止。` }] };
      }

      if (!task.child) {
        task.status = "killed";
        task.exitCode = -1;
        task.finishedAt = Date.now();
        injectResult(pi, task);
        return { content: [{ type: "text", text: `⛔ 任务 ${params.task_id} 无活跃子进程，已标记为 killed。` }] };
      }

      task.status = "killed";
      task.exitCode = -1;
      task.finishedAt = Date.now();

      task.child.kill("SIGTERM");
      const killTimer = setTimeout(() => {
        if (task.child && !task.child.killed) {
          task.child.kill("SIGKILL");
        }
      }, 3000);

      task.child.once("close", () => {
        clearTimeout(killTimer);
      });

      injectResult(pi, task);

      return { content: [{ type: "text", text: `⛔ 已发送终止信号给 ${params.task_id}（SIGTERM，3s 后升级为 SIGKILL）` }] };
    },
  });
}
