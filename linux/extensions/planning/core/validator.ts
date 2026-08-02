/**
 * Planning Plugin — 状态变更验证（规则引擎）
 */

import type { Task, TaskStatus } from "../types";
import { STATUS_LABEL } from "../types";

export interface ChangeResult {
  success: boolean;
  message: string;
  /** 级联暂停的任务 ID 列表 */
  cascadedPauses: number[];
}

/**
 * 应用单条状态变更，包含：
 *   1. 进入 in_progress 前检查前置
 *   2. 暂停/取消时级联暂停依赖任务
 */
export function applyStatusChange(
  tasks: Task[],
  taskId: number,
  newStatus: TaskStatus,
): ChangeResult {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return {
      success: false,
      message: `任务 #${taskId} 不存在`,
      cascadedPauses: [],
    };
  }

  const oldStatus = task.status;
  if (oldStatus === newStatus) {
    return {
      success: true,
      message: `#${taskId} 状态未变更（已是 ${STATUS_LABEL[newStatus]}）`,
      cascadedPauses: [],
    };
  }

  // 规则 1：进入进行中 → 前置必须 completed 或 paused（不可 pending）
  if (newStatus === "in_progress") {
    const blocked = task.prerequisites.filter((pid) => {
      const prereq = tasks.find((t) => t.id === pid);
      return !prereq || prereq.status === "pending";
    });
    if (blocked.length > 0) {
      return {
        success: false,
        message: `无法开始 #${taskId}：前置任务未就绪 [${blocked.join(",")}]`,
        cascadedPauses: [],
      };
    }
  }

  // 应用变更
  task.status = newStatus;

  // 规则 2：暂停/取消 → 级联暂停依赖它的进行中任务
  const cascadedPauses: number[] = [];
  if (newStatus === "paused" || newStatus === "cancelled") {
    for (const dep of tasks) {
      if (
        dep.status === "in_progress" &&
        dep.prerequisites.includes(taskId)
      ) {
        dep.status = "paused";
        cascadedPauses.push(dep.id);
      }
    }
  }

  return {
    success: true,
    message: `#${taskId}：${STATUS_LABEL[oldStatus]} → ${STATUS_LABEL[newStatus]}`,
    cascadedPauses,
  };
}
