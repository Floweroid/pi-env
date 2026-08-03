/**
 * PowerShell Extension for pi
 *
 * Registers a `powershell` tool that executes PowerShell commands on Windows.
 * Useful when bash is not available or when you need native PowerShell functionality.
 *
 * Auto-discovered from ~/.pi/agent/extensions/
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec, type ExecOptions } from "node:child_process";

/** Maximum characters of output to return to the LLM (prevents blowing up context) */
const MAX_OUTPUT_LENGTH = 50_000;

/**
 * Truncate output with a summary if it exceeds maxLength.
 */
function truncateOutput(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const omitted = text.length - maxLength;
  return (
    truncated +
    `\n\n[TRUNCATED: ${omitted.toLocaleString()} more characters omitted. ` +
    `Full output saved to a temp file if needed.]`
  );
}

/**
 * Execute a PowerShell command and return the result.
 */
function runPowerShell(
  command: string,
  timeout: number,
  signal: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number; cancelled: boolean; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    // Wrap in a script block to handle errors consistently
    const psCommand = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;

    const options: ExecOptions = {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10 MB buffer
      windowsHide: true,
      signal,
    };

    const child = exec(psCommand, options, (error, stdout, stderr) => {
      if (signal.aborted) {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: -1,
          cancelled: true,
          timedOut: false,
        });
        return;
      }

      if (error) {
        // error.killed === true means timeout or signal
        const timedOut = error.killed && !signal.aborted;
        resolve({
          stdout: stdout || "",
          stderr: stderr || error.message || "",
          exitCode: error.code ?? -1,
          cancelled: false,
          timedOut,
        });
        return;
      }

      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: 0,
        cancelled: false,
        timedOut: false,
      });
    });

    // Listen for abort signal to kill the process
    const onAbort = () => {
      child.kill();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "powershell",
    label: "PowerShell",
    description:
      "Execute a PowerShell command on Windows. " +
      "Use this tool to run PowerShell commands when bash is unavailable. " +
      "Output is limited to 50,000 characters; use filtering/selecting to narrow results. " +
      "Commands run with -NoProfile -NonInteractive -ExecutionPolicy Bypass. " +
      "For long-running commands, set an appropriate timeout (max 300 seconds).",

    parameters: Type.Object({
      command: Type.String({
        description:
          "The PowerShell command to execute. " +
          "The command runs in a fresh powershell.exe process with -NoProfile -NonInteractive. " +
          "Use proper PowerShell syntax (e.g., Get-ChildItem, not ls). " +
          "For complex scripts, use semicolons to chain commands or separate lines with semicolons.",
      }),
      timeout: Type.Optional(
        Type.Number({
          description:
            "Maximum execution time in seconds (default: 30, max: 300). " +
            "The process is killed if it exceeds this limit.",
        }),
      ),
    }),

    async execute(toolCallId, params, signal) {
      const timeoutMs = Math.min((params.timeout ?? 30) * 1000, 300_000);
      const startTime = Date.now();

      const result = await runPowerShell(params.command, timeoutMs, signal);
      const duration = Date.now() - startTime;

      // Build output text
      const parts: string[] = [];

      if (result.stdout.trim()) {
        parts.push(result.stdout.trim());
      }

      if (result.stderr.trim()) {
        if (parts.length > 0) parts.push("");
        parts.push("[STDERR]");
        parts.push(result.stderr.trim());
      }

      if (result.cancelled) {
        parts.push("\n[COMMAND CANCELLED]");
      } else if (result.timedOut) {
        parts.push(`\n[COMMAND TIMED OUT after ${timeoutMs / 1000}s]`);
      }

      const output = truncateOutput(parts.join("\n"), MAX_OUTPUT_LENGTH);

      // Status line
      const status = result.cancelled
        ? "cancelled"
        : result.timedOut
          ? "timed out"
          : `exit code: ${result.exitCode}`;

      const summary = `PowerShell ${status} | ${duration}ms | ${(output.length / 1024).toFixed(1)} KB output`;

      return {
        content: [{ type: "text" as const, text: output || "(no output)" }],
        details: {
          exitCode: result.exitCode,
          durationMs: duration,
          outputLength: output.length,
          cancelled: result.cancelled,
          timedOut: result.timedOut,
          summary,
        },
      };
    },
  });

  // Intercept user ! commands and route them through PowerShell instead of bash
  pi.on("user_bash", async (event, ctx) => {
    const timeoutMs = 30_000;
    const result = await runPowerShell(event.command, timeoutMs, ctx.signal ?? new AbortController().signal);

    const parts: string[] = [];
    if (result.stdout.trim()) parts.push(result.stdout.trim());
    if (result.stderr.trim()) parts.push("[STDERR]\n" + result.stderr.trim());

    const output = truncateOutput(parts.join("\n"), MAX_OUTPUT_LENGTH);

    return {
      result: {
        output,
        exitCode: result.exitCode,
        cancelled: result.cancelled,
        truncated: output.length >= MAX_OUTPUT_LENGTH,
      },
    };
  });

  // Notify that the PowerShell tool is ready
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("PowerShell tool registered | ! commands routed to PowerShell", "info");
  });

  // Also register a convenience command for the user
  pi.registerCommand("powershell", {
    description: "Show PowerShell tool info",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        "PowerShell tool is registered. The LLM can call it via the 'powershell' tool.\n" +
          'Usage: Ask me to "run this in powershell: Get-Process"',
        "info",
      );
    },
  });
}
