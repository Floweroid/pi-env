/**
 * Tool Result Guard — Session 文件操作
 *
 * 读写 Dify 会话 JSONL 文件，清理工具调用记录。
 */

import * as fs from "node:fs";

// ── 锁 ──────────────────────────────────────────────────────────────────

/**
 * 等待文件锁释放。轮询检测 .lock 文件，最多等 timeoutMs。
 */
function waitForLock(filePath: string, timeoutMs = 3000): void {
  const lockFile = filePath + ".lock";
  const start = Date.now();
  while (fs.existsSync(lockFile)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`等待文件锁超时: ${lockFile}`);
    }
    const waitUntil = Date.now() + 50;
    while (Date.now() < waitUntil) { /* spin */ }
  }
}

// ── 删除 ────────────────────────────────────────────────────────────────

/**
 * 从会话 JSONL 文件中删除与指定 tool_call_id 相关的行。
 * 同时修复后续行的 parentId 链。
 *
 * @param sessionFile 会话文件路径
 * @param targetId 要删除的 tool_call_id
 * @param mode "assistant" — 找 assistant + toolResult 一并删除（缺失场景）
 *               "orphan" — 直接找 toolResult 行单独删除（孤儿场景）
 * @returns 是否成功删除
 */
export function removeToolCallFromSession(
  sessionFile: string,
  targetId: string,
  mode: "assistant" | "orphan" = "assistant",
): boolean {
  try {
    waitForLock(sessionFile);

    const raw = fs.readFileSync(sessionFile, "utf-8");
    const lines = raw.split("\n");
    if (lines.length === 0) return false;

    const entries: Array<{ line: string; parsed: any }> = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        entries.push({ line, parsed: JSON.parse(line) });
      } catch {
        entries.push({ line, parsed: null });
      }
    }

    // 查找目标行
    let targetIdx = -1;
    let resultIdx = -1;

    let assistantEntry: any = null;
    let assistantMsg: any = null;
    let oldContent: any[] = [];
    let newContent: any[] = [];

    if (mode === "orphan") {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.parsed || e.parsed.type !== "message") continue;
        const msg = e.parsed.message || {};
        if (msg.role === "toolResult" && msg.toolCallId === targetId) {
          targetIdx = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.parsed || e.parsed.type !== "message") continue;
        const msg = e.parsed.message || {};
        if (msg.role !== "assistant") continue;
        const content = msg.content || [];
        if (!Array.isArray(content)) continue;
        const hasTarget = content.some(
          (c: any) =>
            (c.type === "toolCall" || c.type === "tool_use") &&
            (c.id === targetId || c.tool_use_id === targetId),
        );
        if (hasTarget) {
          targetIdx = i;
          break;
        }
      }

      if (targetIdx === -1) return false;

      // 不删整条 assistant，只删目标 tool_call block
      assistantEntry = entries[targetIdx];
      assistantMsg = assistantEntry.parsed.message;
      oldContent = assistantMsg.content || [];
      newContent = oldContent.filter(
        (c: any) =>
          !((c.type === "toolCall" || c.type === "tool_use") &&
            (c.id === targetId || c.tool_use_id === targetId)),
      );

      // 搜索所有 entry 找对应的 toolResult
      let resultIdx = -1;
      for (let i = 0; i < entries.length; i++) {
        if (i === targetIdx) continue;
        const e = entries[i];
        if (!e.parsed || e.parsed.type !== "message") continue;
        const m = e.parsed.message || {};
        if (m.role === "toolResult" && m.toolCallId === targetId) {
          resultIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return false;

    // 收集被删除行的 id（只有 toolResult，不删 assistant）
    const removedIds = new Set<string>();
    if (resultIdx !== -1) {
      removedIds.add(entries[resultIdx].parsed.id);
    }

    const orphanParentId = mode === "orphan" ? entries[targetIdx].parsed.parentId : null;

    const newEntries: Array<{ line: string; parsed: any }> = [];
    for (let i = 0; i < entries.length; i++) {
      // 跳过要删除的行：orphan 跳过 targetIdx，assistant 跳过 resultIdx
      if (mode === "orphan" && i === targetIdx) continue;
      if (mode === "assistant" && i === resultIdx) continue;

      const e = entries[i];
      let entryToPush = e;

      // 如果是 assistant 行且需要修改（删除目标 tool_call block）
      if (i === targetIdx && mode === "assistant" && newContent && newContent.length !== oldContent.length) {
        const modifiedAssistant = {
          ...assistantEntry.parsed,
          message: { ...assistantMsg, content: newContent },
        };
        entryToPush = { line: JSON.stringify(modifiedAssistant), parsed: modifiedAssistant };
      }

      // 修复 parentId 链
      if (entryToPush.parsed && entryToPush.parsed.parentId && removedIds.has(entryToPush.parsed.parentId)) {
        let newParentId = orphanParentId;
        if (!newParentId) {
          newParentId = entryToPush.parsed.parentId;
          const visited = new Set<string>();
          while (removedIds.has(newParentId) && !visited.has(newParentId)) {
            visited.add(newParentId);
            const parentEntry = entries.find((pe) => pe.parsed && pe.parsed.id === newParentId);
            if (!parentEntry || !parentEntry.parsed) break;
            if (removedIds.has(parentEntry.parsed.parentId)) {
              newParentId = parentEntry.parsed.parentId;
            } else {
              newParentId = parentEntry.parsed.parentId;
              break;
            }
          }
        }
        const newParsed = { ...entryToPush.parsed, parentId: newParentId };
        newEntries.push({ line: JSON.stringify(newParsed), parsed: newParsed });
      } else {
        newEntries.push(entryToPush);
      }
    }

    const output = newEntries.map((e) => e.line).join("\n") + "\n";
    fs.writeFileSync(sessionFile, output, "utf-8");

    return true;
  } catch (err) {
    console.error(`[tool-result-guard] 清理会话文件失败:`, err);
    return false;
  }
}

// ── 强制刷新 ──────────────────────────────────────────────────────────────

/**
 * 强制 pi 重读 session 文件（刷新内存 state）。
 */
export function forceSessionReload(ctx: any): void {
  const file = ctx.sessionManager?.getSessionFile();
  if (file) {
    try {
      (ctx.sessionManager as any).setSessionFile(file);
    } catch {
      // 静默忽略
    }
  }
}

