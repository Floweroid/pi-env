# async-tasks — 后台任务管理

> 3 个 TS 文件。让耗时命令**异步执行，不阻塞 Agent 会话**。

## 设计目标

Agent 执行长任务（构建、测试、下载、批处理）时，若同步等待会阻塞整轮对话。async-tasks 把命令丢到后台，完成后再把结果注入回来。

## 四个工具

| 工具 | 功能 |
|------|------|
| `async_run` | spawn 后台命令，立即返回 `task_id`，完成后自动注入结果 |
| `async_list` | 列出全部任务（运行中 / 已完成） |
| `async_peek` | 查看运行中任务的实时 stdout/stderr（尾 N 字符） |
| `async_kill` | 终止运行中的后台任务 |

参数：`async_run(command, cwd?)`；Windows 走 powershell.exe，Unix 走 bash。

## 核心机制

### 结果自动注入

任务完成时通过 `pi.sendMessage({ customType: "async_task_result", triggerTurn: true })` 注入结果，**触发新一轮对话**让 Agent 继续处理：

```
[后台任务完成 task_xxx]
✅ 状态: 完成 | 耗时: 12.3s | 退出码: 0
命令: npm run build

--- stdout ---
（尾部 4000 字符）
--- stderr ---
（尾部 4000 字符）
```

- stdout/stderr 各截断尾 4000 字符，防上下文爆炸
- 状态图标：✅ 完成 / ❌ 失败 / ⛔ 已中断

### 生命周期管理

- 任务状态存内存 `Map`（id → TaskInfo）
- **30 分钟无引用后自动清理**，防内存泄漏
- `session_shutdown` 时 kill 所有运行中任务（`status = killed`）
- `resultInjected` 标志防重复注入

### 与同步执行的对比

| 维度 | 同步执行 | async_run |
|------|---------|-----------|
| 会话阻塞 | 阻塞 | 不阻塞 |
| 结果获取 | 立即 | 完成自动注入 |
| 长任务 | 不可用 | 可用 |
| 实时查看 | 无 | async_peek |
| 终止 | Ctrl+C 难 | async_kill |

## 设计要点

| 决策 | 理由 |
|------|------|
| 立即返回 task_id | Agent 可以继续做其他事，符合异步心智模型 |
| 完成后 triggerTurn | 结果不丢，主动唤醒 Agent 处理 |
| 输出尾部截断 | 长输出只保留关键尾部，控制 token 成本 |
| 30 分钟清理 | 防 Map 无限增长 |
| shutdown 强杀 | 会话结束不留孤儿进程 |
