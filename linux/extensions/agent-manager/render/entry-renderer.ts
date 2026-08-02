/**
 * agent-manager render/entry-renderer — 切换记录渲染
 *
 * 在消息历史中渲染 agent 切换记录，类似 context-loader 的文件清单。
 */

import { Box, Text } from "@earendil-works/pi-tui";
import type { SwitchData } from "../core/types";

export function createAgentSwitchRenderer() {
  return (entry: { data?: SwitchData }, _options: unknown, theme: any) => {
    const data = entry.data;
    if (!data) return;

    const fromStr = data.from ?? "default";
    const toStr = data.to ?? "default";

    const lines: string[] = [];
    lines.push(`🔄 agent: ${fromStr} → ${toStr}`);

    if (data.contextFiles && data.contextFiles.length > 0) {
      const totalSize = data.contextFiles.reduce((sum, f) => sum + f.size, 0);
      lines.push(
        `   context：${data.contextFiles.length} 个文件 (${(totalSize / 1024).toFixed(1)} KB)`,
      );
      if (data.contextDir) {
        lines.push(`   ${data.contextDir}`);
      }
      for (const f of data.contextFiles) {
        lines.push(`   └─ ${f.name}`);
      }
    }

    const content = lines.join("\n");

    const box = new Box(0, 0, (s: string) => theme.bg("toolSuccessBg", s));
    box.addChild(new Text(theme.fg("success", content), 0, 0));
    return box;
  };
}
