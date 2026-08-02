/**
 * agent-manager core/injector — context 注入逻辑
 *
 * 读取当前 agent 的 context/ 目录中的 .md 文件，
 * 在 before_provider_request 时注入到消息列表。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { CONTEXT_MARKER, SWITCH_MARKER, MAX_CONTEXT_BYTES } from "./types";

// ── 模块级缓存 ────────────────────────────────────────────────────────

let cachedContext: string = "";

/** 待注入的切换信息（单轮多次切换只保留最新） */
let pendingSwitchInfo: { from: string | null; to: string; description: string } | null = null;

/** 设置待注入的切换信息（覆盖旧值） */
export function setPendingSwitchInfo(
  info: { from: string | null; to: string; description: string } | null,
): void {
  pendingSwitchInfo = info;
}

// ── 加载 context ──────────────────────────────────────────────────────

/**
 * 读取 agentDir/context/ 下的所有 .md 文件，排序后拼接存入缓存。
 * context/ 不存在或为空 → cachedContext = ""。
 */
export function loadAgentContext(agentDir: string): void {
  const contextDir = path.join(agentDir, "context");

  let names: string[];
  try {
    names = fs
      .readdirSync(contextDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    cachedContext = "";
    return;
  }

  if (names.length === 0) {
    cachedContext = "";
    return;
  }

  const blocks: string[] = [];
  let totalSize = 0;
  let truncated = false;
  const included: string[] = [];
  const skipped: string[] = [];

  for (const name of names) {
    try {
      let content = fs.readFileSync(path.join(contextDir, name), "utf-8").trim();
      const size = Buffer.byteLength(content, "utf-8");

      if (totalSize + size > MAX_CONTEXT_BYTES) {
        skipped.push(name);
        truncated = true;
        continue;
      }

      blocks.push(`## ${name}\n\n${content}`);
      included.push(name);
      totalSize += size;
    } catch {
      // 跳过不可读文件
    }
  }

  // 被跳过的文件追加提示
  if (skipped.length > 0) {
    const skippedMsg = `> ⚠️ 以下 ${skipped.length} 个文件因上下文大小限制被跳过：\n> ${skipped.join(", ")}`;
    blocks.push(skippedMsg);
  }

  if (blocks.length === 0) {
    cachedContext = "";
    return;
  }

  let assembled = `[系统信息 — 以下为 agent 专属上下文，非用户对话]\n\n${CONTEXT_MARKER}\n\n${blocks.join("\n\n")}`;

  if (truncated) {
    assembled += "\n\n> ⚠️ context 已截断，超出大小限制";
  }

  cachedContext = assembled;
}

/** 清空缓存 */
export function clearContext(): void {
  cachedContext = "";
}

// ── injector handler ──────────────────────────────────────────────────

/**
 * 创建 before_provider_request handler 闭包。
 *
 * 注入逻辑：
 *   1. 无 cachedContext 且无 pendingSwitchInfo → 不修改
 *   2. 删除旧 CONTEXT_MARKER + SWITCH_MARKER 消息
 *   3. 在 system prompt（index 0）之后依次注入 switch info → context
 */
export function createInjectorHandler(): (event: any) => any | undefined {
  return (event: any) => {
    // 无任何待注入内容 → 跳过
    if (!cachedContext && !pendingSwitchInfo) return;

    const payload = event.payload;
    let messages: any[] = payload?.messages;
    if (!messages || messages.length === 0) return;

    // 删除旧的 context + switch 注入
    messages = messages.filter((m: any) => {
      if (typeof m.content !== "string") return true;
      if (m.content.includes(CONTEXT_MARKER)) return false;
      if (m.content.includes(SWITCH_MARKER)) return false;
      return true;
    });

    // 构建注入列表（switch 在前，context 在后）
    const injections: any[] = [];

    if (pendingSwitchInfo) {
      const si = pendingSwitchInfo;
      injections.push({
        role: "user",
        content: `${SWITCH_MARKER}\n[Agent: ${si.from ?? "(none)"} → ${si.to}] ${si.description}`,
      });
      pendingSwitchInfo = null;
    }

    if (cachedContext) {
      injections.push({ role: "user", content: cachedContext });
    }

    if (injections.length > 0) {
      messages.splice(1, 0, ...injections);
    }

    return { ...payload, messages };
  };
}
