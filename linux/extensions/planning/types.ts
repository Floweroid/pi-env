/**
 * Planning Plugin — 类型定义与常量
 */

// ── 任务状态 ──

export type TaskStatus =
  | "pending"
  | "paused"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Task {
  id: number;
  name: string;
  status: TaskStatus;
  prerequisites: number[];
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  entrySeq?: number;
}

// ── 持久化结构 ──

export interface PlanningState {
  tasks: Task[];
  collapsedSections: string[];
  twoPhaseEnabled?: boolean;
}

// ── Widget 分区 ──

export const SECTIONS = [
  { key: "in_progress", label: "进行中" },
  { key: "pending", label: "目标" },
  { key: "done", label: "已完成" },
  { key: "cancelled", label: "已取消" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

// ── 状态显示映射 ──

/** 符号标签（Widget 用） */
export const STATUS_DISPLAY: Record<TaskStatus, string> = {
  pending: "[-]",
  paused: "[=]",
  in_progress: "[ing..]",
  completed: "[√]",
  cancelled: "[x]",
};

/** 中文标签（上下文注入用） */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "未开始",
  paused: "暂停",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "取消",
};

/** 上下文注入锚点标记 */
export const PLAN_MARKER = "<!-- planning-plugin -->";
