/**
 * Planning Plugin — /plan export
 */

import type { Task } from "../types";

export function formatExportMarkdown(tasks: Task[]): string {
  const statusIcon: Record<string, string> = {
    pending: "⬜", paused: "⏸️", in_progress: "🔄",
    completed: "✅", cancelled: "❌",
  };

  const lines: string[] = [
    "# 任务计划",
    "",
    `> 导出时间：${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    "",
    "| # | 状态 | 任务 | 前置 | 备注 |",
    "|---|:---:|------|------|------|",
  ];

  for (const t of tasks) {
    const icon = statusIcon[t.status] ?? "⬜";
    const prereq = t.prerequisites.length > 0 ? t.prerequisites.join(", ") : "—";
    const note = t.note ?? "—";
    lines.push(`| ${t.id} | ${icon} | ${t.name} | ${prereq} | ${note} |`);
  }

  lines.push("");
  lines.push(`共 ${tasks.length} 条任务`);
  return lines.join("\n") + "\n";
}
