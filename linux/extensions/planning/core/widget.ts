/**
 * Planning Plugin — Widget & Overlay 渲染（给人看）
 */

import type { Task } from "../types";
import { SECTIONS, STATUS_DISPLAY, type SectionKey } from "../types";

export interface WidgetRenderOptions {
  tasks: Task[];
  collapsedSections: Set<SectionKey>;
  theme: any;
  maxWidth: number;
}

export interface OverlayRenderOptions extends WidgetRenderOptions {
  /** overlay 容器宽度 */
  boxWidth: number;
}

/** 主渲染入口 */
export function renderWidget(opts: WidgetRenderOptions): string[] {
  const { tasks, collapsedSections, theme, maxWidth } = opts;

  if (tasks.length === 0) return [];

  const grouped = {
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    pending: tasks.filter(
      (t) => t.status === "pending" || t.status === "paused",
    ),
    done: tasks.filter((t) => t.status === "completed"),
    cancelled: tasks.filter((t) => t.status === "cancelled"),
  };

  const completed = grouped.done.length;
  const cancelled = grouped.cancelled.length;
  const total = tasks.length;
  const inProgress = grouped.in_progress.length;

  const lines: string[] = [];

  // ── 标题行 ──
  let titleLine = `📋 目标：${completed}/${total}`;
  if (inProgress > 0) titleLine += ` ⚡${inProgress}`;

  const toggles = SECTIONS.map((s) => {
    const collapsed = collapsedSections.has(s.key);
    const arrow = collapsed ? "▶" : "▼";
    const count = grouped[s.key].length;
    return `${arrow} ${s.label}(${count})`;
  }).join("  ");

  const titlePlain = `📋 目标：${completed}/${total}${inProgress > 0 ? ` ⚡${inProgress}` : ""}`;
  const availableForToggles = maxWidth - titlePlain.length - 2;
  if (availableForToggles > 20) {
    titleLine += `  ${theme.fg("dim", toggles)}`;
  }
  lines.push(titleLine);

  // ── 分区 ──
  for (const section of SECTIONS) {
    const sectionTasks = grouped[section.key];
    const collapsed = collapsedSections.has(section.key);
    lines.push(renderHeader(section, sectionTasks, collapsed, theme));

    if (!collapsed) {
      for (const task of sectionTasks) {
        lines.push(...renderTask(task, theme, maxWidth, tasks));
      }
    }
  }

  return lines;
}

// ── 内部渲染函数 ──

function renderHeader(
  section: (typeof SECTIONS)[number],
  tasks: Task[],
  collapsed: boolean,
  theme: any,
): string {
  const arrow = collapsed ? "▶" : "▼";
  const count = tasks.length;
  const fg =
    section.key === "in_progress"
      ? "warning"
      : section.key === "done"
        ? "success"
        : section.key === "cancelled"
          ? "dim"
          : "accent";

  if (collapsed) {
    return theme.fg(fg, `${arrow} ${section.label} (${count} 条已折叠)`);
  }
  return theme.fg(fg, `${arrow} ${section.label} (${count})`);
}

function renderTask(
  task: Task,
  theme: any,
  maxWidth: number,
  allTasks: Task[],
): string[] {
  const statusFg =
    task.status === "in_progress"
      ? "warning"
      : task.status === "completed"
        ? "success"
        : task.status === "cancelled"
          ? "error"
          : "dim";

  const display = STATUS_DISPLAY[task.status];

  // 第一行：[状态]-#id. 前置：[...]
  let header = `${theme.fg(statusFg, display)}${theme.fg("dim", `-#${task.id}.`)}`;
  if (task.prerequisites.length > 0) {
    header += ` ${theme.fg("dim", "前置：")}[${renderPrereqIDs(task.prerequisites, allTasks, theme)}]`;
  }

  // 第二行：任务名称（全宽）
  const truncatedName =
    task.name.length > maxWidth && maxWidth > 5
      ? task.name.slice(0, maxWidth - 1) + "…"
      : task.name;

  const styledName =
    task.status === "completed" || task.status === "cancelled"
      ? theme.strikethrough?.(truncatedName) ?? truncatedName
      : task.status === "in_progress"
        ? truncatedName
        : theme.fg("dim", truncatedName);

  return [header, `  ${styledName}`, ...(task.note ? [`    ${theme.fg("dim", task.note)}`] : [])];
}

/** 渲染前置 ID 列表：已完成者加删除线 */
function renderPrereqIDs(ids: number[], allTasks: Task[], theme: any): string {
  return ids
    .map((id) => {
      const pt = allTasks.find((t) => t.id === id);
      const done = pt && (pt.status === "completed" || pt.status === "cancelled");
      const s = String(id);
      return done
        ? theme.strikethrough?.(theme.fg("success", s)) ?? s
        : theme.fg("dim", s);
    })
    .join(theme.fg("dim", ","));
}

// ── Overlay 渲染 ────────────────────────────────────────

/** 粗略计算字符串的可见宽度（去除 ANSI 码） */
function visibleLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/**
 * 为 overlay 渲染带边框和背景的卡片。
 * 宽度自适应内容（取最宽行的长度），右对齐于 overlay 容器内。
 * 空计划返回空数组（overlay 不显示）。
 */
export function renderOverlay(opts: OverlayRenderOptions): string[] {
  const { tasks, boxWidth: containerW, theme } = opts;

  if (tasks.length === 0) return [];

  // 先渲染内容
  const inner = renderWidget({ ...opts, maxWidth: containerW - 4 });
  if (inner.length === 0) return [];

  // 计算内容最大可见宽度
  const contentMaxW = Math.max(...inner.map(visibleLen), 10);
  // 盒子内宽 = 内容 + 2 空格 padding，但不超过容器
  const innerW = Math.min(contentMaxW + 2, containerW - 4);
  const boxW = innerW + 2; // 含 │ 边框

  // 无背景色 — 使用默认终端背景
  const border = (s: string) => theme.fg("border", s);

  // 左填充（右对齐）
  const leftPad = containerW - boxW;

  function pad(s: string): string {
    return " ".repeat(leftPad) + s;
  }

  function innerLine(content: string): string {
    const padded = padVisual(content, innerW - 1);
    return `│ ${padded}│`;
  }

  function padVisual(str: string, target: number): string {
    const need = Math.max(0, target - visibleLen(str));
    return str + " ".repeat(need);
  }

  const lines: string[] = [];
  lines.push(border(pad(`┌${"─".repeat(boxW - 2)}┐`)));
  lines.push(pad(`│${" ".repeat(boxW - 2)}│`));
  for (const line of inner) {
    lines.push(pad(innerLine(line)));
  }
  lines.push(pad(`│${" ".repeat(boxW - 2)}│`));
  lines.push(border(pad(`└${"─".repeat(boxW - 2)}┘`)));

  return lines;
}
