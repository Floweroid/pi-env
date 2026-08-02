/**
 * agent-manager core/types — 类型定义与常量
 *
 * 纯类型和常量，无逻辑、无 import（除 node:path 等 stdlib）。
 */

// ═══════════════════════════════════════════════════════════════════════
// Agent 来源
// ═══════════════════════════════════════════════════════════════════════

export type AgentSource = "builtin" | "global" | "project";

// ═══════════════════════════════════════════════════════════════════════
// Agent 条目
// ═══════════════════════════════════════════════════════════════════════

export interface AgentEntry {
  /** Agent 标识（目录名不含 .agent 后缀） */
  name: string;
  /** Agent 目录完整路径 */
  dir: string;
  /** 来源 */
  source: AgentSource;
  /** agent.md 文件路径 */
  filePath: string;
  /** agent.md 正文（去除 frontmatter） */
  systemPrompt: string;
  /** 简短描述（frontmatter description） */
  description: string;
  /** 是否有 context/ 子目录且非空 */
  hasContext: boolean;
  /** frontmatter global 字段（是否导出到全局） */
  global: boolean;
  /** 指定模型（可选） */
  model?: string;
  /** 工具白名单（可选） */
  tools?: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// 持久化状态
// ═══════════════════════════════════════════════════════════════════════

export interface RegistryState {
  activeAgent: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// 上下文文件
// ═══════════════════════════════════════════════════════════════════════

export interface ContextFile {
  /** 文件名（不含 .md） */
  name: string;
  /** 文件正文 */
  content: string;
  /** 文件字节数 */
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════
// 切换记录（用于 entry renderer）
// ═══════════════════════════════════════════════════════════════════════

export interface SwitchData {
  from: string | null;
  to: string | null;
  timestamp: number;
  /** 切换后注入的 context 文件列表（无 context 则为空） */
  contextFiles?: Pick<ContextFile, "name" | "size">[];
  /** context 目录路径（无 context 则为空） */
  contextDir?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════════

export const AGENT_SUFFIX = ".agent";
export const WIDGET_ID = "agent-manager";
export const CONTEXT_MARKER = "<!-- agent-context -->";
export const SWITCH_MARKER = "<!-- agent-switch-info -->";
/** context 注入最大字节数（预防 token 浪费） */
export const MAX_CONTEXT_BYTES = 40_000;
