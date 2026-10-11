/**
 * Async Guard Extension — 拒绝超时等待 60s 以上的任务走同步，强制异步
 *
 * 拦截 bash/powershell 同步执行中设置了 timeout > 阈值（默认 60s）的调用，
 * 阻止其同步执行并提示改用 async_run 后台运行，避免阻塞会话。
 * 对应系统规则："长任务（预计超 1 分钟）一律走异步，不阻塞会话"。
 *
 * 判定依据（优先级）：
 *   1. 工具参数显式设置 timeout > 阈值            → 必拦
 *   2. 未设置 timeout 但命令特征疑似长任务（可选）→ 兜底拦截，默认关闭
 *
 * 命令：
 *   /async-guard                  — 查看当前状态
 *   /async-guard on|off           — 启用/禁用拦截
 *   /async-guard threshold <秒>   — 设置阈值（默认 60）
 *   /async-guard hints on|off     — 命令特征兜底开关（默认 off）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// 同步执行类工具
const SYNC_TOOLS = new Set(["bash", "powershell", "cmd"]);

// 疑似长任务的命令特征（仅 hints 模式启用时生效）
const LONG_RUN_HINTS = [
  /\b(pip|pip3|uv pip)\s+install/i,
  /\bnpm\s+(install|ci)\b/i,
  /\byarn\s+(add|install)\b/i,
  /\bpnpm\s+(install|add)\b/i,
  /\bgit\s+(clone|fetch|pull|push|submodule\s+update)\b/i,
  /\bwinget\s+install\b/i,
  /\bconda\s+(install|create|update)\b/i,
  /\b(apt|dnf|yum|pacman)\s+(install|update|upgrade)\b/i,
  /\b(gcc|cl|clang|g\+\+|msbuild|nmake|cargo\s+build)\b/i,
  /\bpython\s+.*\b(train|fine[- ]?tune|test|infer)\b/i,
  /\bllama-(server|bench|cli)\b/i,
  /\bffmpeg\b/i,
  /\bwget\b/i,
  /\bscp\b/i,
  /\brsync\b/i,
];

/** 解析工具调用中的 timeout（秒）。未设置返回 null。 */
function parseTimeout(input: any): number | null {
  if (input == null) return null;
  const t = Number(input.timeout);
  if (Number.isFinite(t) && t > 0) return t;
  return null;
}

export default function (pi: ExtensionAPI) {
  let enabled = true;
  let threshold = 60;   // 阈值（秒）：timeout > threshold 即拦截
  let useHints = false; // 无 timeout 时用命令特征兜底

  function statusLabel() {
    return `⏱️ async-guard: ${enabled ? "ON" : "OFF"} (timeout>${threshold}s → async)`;
  }

  function updateStatus(ctx?: any) {
    if (ctx?.ui?.setStatus) ctx.ui.setStatus("async-guard", statusLabel());
  }

  // ── 恢复上次状态 ──
  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === "async-guard") {
        const d = (entry.data as any) ?? {};
        if (typeof d.enabled === "boolean") enabled = d.enabled;
        if (typeof d.threshold === "number" && d.threshold > 0) threshold = d.threshold;
        if (typeof d.useHints === "boolean") useHints = d.useHints;
        break;
      }
    }
    updateStatus(ctx);
  });

  // ── /async-guard 命令 ──
  pi.registerCommand("async-guard", {
    description: `长任务异步守卫：on/off / threshold <秒> / hints on|off（当前: ${enabled ? "ON" : "OFF"}，timeout>${threshold}s）`,
    async handler(args, ctx) {
      const parts = (args || "").trim().split(/\s+/);
      const [cmd, val] = parts;

      if (!cmd) {
        ctx.ui.notify(
          `⏱️ async-guard 当前状态\n启用: ${enabled ? "✅ ON" : "⛔ OFF"}\n阈值: timeout > ${threshold}s\n命令特征兜底: ${useHints ? "✅ ON" : "❌ OFF"}\n\n用法:\n  /async-guard on|off\n  /async-guard threshold <秒>\n  /async-guard hints on|off`,
          "info",
        );
        return;
      }

      if (cmd === "on" || cmd === "off") {
        enabled = cmd === "on";
        pi.appendEntry("async-guard", { enabled, threshold, useHints });
        updateStatus(ctx);
        ctx.ui.notify(`⏱️ async-guard ${enabled ? "已启用" : "已禁用"}（timeout>${threshold}s 将强制 async）`, "info");
        return;
      }

      if (cmd === "threshold") {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 1) {
          ctx.ui.notify("阈值必须是 >= 1 的秒数，例如: /async-guard threshold 120", "info");
          return;
        }
        threshold = n;
        pi.appendEntry("async-guard", { enabled, threshold, useHints });
        updateStatus(ctx);
        ctx.ui.notify(`⏱️ 阈值已设为 timeout > ${threshold}s（超时任务强制 async）`, "info");
        return;
      }

      if (cmd === "hints") {
        useHints = (val || "on") !== "off";
        pi.appendEntry("async-guard", { enabled, threshold, useHints });
        updateStatus(ctx);
        ctx.ui.notify(`⏱️ 命令特征兜底: ${useHints ? "✅ 开启" : "❌ 关闭"}`, "info");
        return;
      }

      ctx.ui.notify(`未知参数: ${cmd}\n用法: /async-guard on|off | threshold <秒> | hints on|off`, "info");
    },
  });

  // ── 工具拦截 ──
  pi.on("tool_call", async (event, ctx) => {
    if (!enabled) return undefined;

    const { toolName, input } = event;
    if (!SYNC_TOOLS.has(toolName)) return undefined;

    const detail = (input as any)?.command ?? "";
    const timeout = parseTimeout(input);

    let reason: string | null = null;

    // 1. 显式 timeout 超阈值 → 必拦
    if (timeout !== null && timeout > threshold) {
      reason = `该命令设置了 ${timeout}s 超时，超过阈值 ${threshold}s，属于长任务`;
    }
    // 2. 无 timeout 但命令特征疑似长任务 → 兜底拦截（默认关闭）
    else if (useHints && timeout === null && LONG_RUN_HINTS.some((p) => p.test(detail))) {
      reason = "该命令特征表明可能长时间运行（未设置显式超时）";
    }

    if (!reason) return undefined;

    return {
      block: true,
      reason: `[⛔ async-guard 已拦截] ${reason}，禁止同步执行（会阻塞会话）。\n工具: ${toolName}\n命令: ${detail.slice(0, 200)}\n\n✅ 请改用 async_run 后台执行：返回 task_id 立即结束，完成时结果自动注入；如需查看进度用 async_peek 一次即可，不要循环轮询。`,
    };
  });
}
