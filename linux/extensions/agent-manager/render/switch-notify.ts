/**
 * agent-manager render/switch-notify — 切换通知生成
 *
 * 独立函数，生成切换时 appendEntry 的数据和 notify 消息。
 * 类似 context-loader 在 index.ts 中调用 pi.appendEntry 的模式。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { SwitchData, ContextFile } from "../core/types";

/**
 * 生成切换记录数据，包含 context 文件清单。
 *
 * @param from 旧 agent 名（null = 默认）
 * @param to   新 agent 名（null = 默认）
 * @param agentDir 新 agent 的目录（null = 无 context）
 */
export function buildSwitchEntry(
  from: string | null,
  to: string | null,
  agentDir: string | null,
): SwitchData {
  const data: SwitchData = {
    from,
    to,
    timestamp: Date.now(),
  };

  if (agentDir) {
    const contextDir = path.join(agentDir, "context");
    try {
      const names = fs
        .readdirSync(contextDir)
        .filter((f) => f.endsWith(".md"))
        .sort();

      if (names.length > 0) {
        const files: Pick<ContextFile, "name" | "size">[] = [];
        for (const name of names) {
          try {
            const stat = fs.statSync(path.join(contextDir, name));
            files.push({ name, size: stat.size });
          } catch {
            files.push({ name, size: 0 });
          }
        }
        data.contextFiles = files;
        data.contextDir = contextDir;
      }
    } catch {
      // context/ 不存在 — 不附加文件信息
    }
  }

  return data;
}

/**
 * 生成 notify 用的简短信息文本。
 */
export function buildSwitchNotify(
  to: string | null,
  data: SwitchData,
): string {
  if (!to) return "Agent: none (default)";

  const ctxInfo =
    data.contextFiles && data.contextFiles.length > 0
      ? ` (${data.contextFiles.length} context files)`
      : "";

  return `Agent: ${to}${ctxInfo}`;
}
