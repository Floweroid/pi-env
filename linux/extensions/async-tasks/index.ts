/**
 * Async Tasks Extension — 后台命令 + 自动注入结果 + 实时输出查看 + 终止任务
 *
 *   async_run  — spawn 后台命令，立即返回 task_id，完成后自动注入结果
 *   async_list — 列出全部任务（运行中 / 已完成）
 *   async_peek — 查看运行中任务的实时 stdout/stderr
 *   async_kill — 终止运行中的后台任务
 *
 * 所有命令均以非阻塞方式运行。Windows 走 powershell.exe。Task 状态存储在内存 Map 中。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { tasks, registerTools } from "./tools.ts";

export default function (pi: ExtensionAPI) {
  registerTools(pi);

  pi.on("session_shutdown", () => {
    for (const [, task] of tasks) {
      if (task.status === "running" && task.child) {
        task.child.kill();
        task.status = "killed";
        task.exitCode = -1;
        task.finishedAt = Date.now();
        // injectResult is internal to tools.ts; close handler will handle it
      }
    }
  });
}
