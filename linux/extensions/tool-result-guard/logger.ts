/**
 * Tool Result Guard — 日志模块
 *
 * 记录每次 guard 触发的现场信息到 /tmp/tool-result-guard.log，
 * 自动保留最近 10 条记录。
 */

import * as fs from "node:fs";

// ── 常量 ────────────────────────────────────────────────────────────────

const LOG_FILE = "/tmp/tool-result-guard.log";
const MAX_ENTRIES = 10;

// ── 类型 ────────────────────────────────────────────────────────────────

export interface MissingToolInfo {
  name: string;
  id: string;
  position: string;
  args?: string;
}

export interface LogEntry {
  timestamp: string;
  sessionId: string;
  missing: MissingToolInfo[];
  choice: string;
}

// ── 读写 ────────────────────────────────────────────────────────────────

function readLog(): LogEntry[] {
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries: LogEntry[]): void {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
  } catch {
    // 日志写入失败不阻塞主流程
  }
}

// ── 追加 ────────────────────────────────────────────────────────────────

export function appendLog(entry: LogEntry): void {
  const entries = readLog();
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  writeLog(entries);
}
