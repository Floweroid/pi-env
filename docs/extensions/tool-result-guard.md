# tool-result-guard — 工具结果保护

> **版本**：2.0.0（6 个 TS 文件）。检测并修复 `tool_result` 丢失的兜底扩展。

## 问题背景

Pi 在特定场景下会向 API 发送**缺少 tool_result 的 payload**，导致 400 错误：

```
"Messages with role 'tool' must be a response to a preceding message with 'tool_calls'"
```

两个根因：

### 1. 竞态条件（[pi Issue #7053](https://github.com/earendil-works/pi/issues/7053)）

并行工具调用时，pi 的 `executeToolCallsParallel` 使用 `Promise.all` 等待所有工具完成后才将结果持久化到 session。**一个工具延迟，已完成的结果也被阻塞**。

### 2. structuredClone 快照

pi 在 `emitContext` 中对 `context.messages` 执行 `structuredClone`，创建不可变快照。此后的 payload 构建、`before_provider_request` handler 都基于此快照，**不反映实时的 `context.messages`**。

## 解决方案

在 `before_provider_request` 事件中做三层兜底：

### 1. 静默修复（silentRepair）

检查 session 实时状态（`buildSessionContext()`），如果结果已在 entries 中但 payload 快照没有，**自动补全，不弹框**。

### 2. 交互处理（对话框）

静默修复失败时弹出选框，让用户选择处理方式：

| # | 选项 | 行为 |
|:---:|:---|:---|
| 1 | 删除 | 移除 tool_calls / tool_results，清理 session 文件 |
| 2 | 填入默认返回结果 | 插入 tool 消息：「工具调用『xxx』结果丢失，请重试」 |
| 3 | 填入自定义文本 | 弹输入框让用户输入内容，插入 tool 消息 |
| 4 | 重试（等待结果就绪） | 等待 2 秒后重检。就绪放行，未就绪重新弹框 |
| 5 | 放行（发送到 API） | 原样发送 payload，可能触发 API 400 |

> 无 UI 环境自动走选项 1。

### 3. 强制刷新

删除后调用 `setSessionFile()` 强制 pi 重读 session，避免同一会话重复拦截。

## 检测逻辑

```typescript
收集 callIds:   assistant.tool_calls[].id
                user.content[].type === tool_use.id
收集 resultIds: tool.tool_call_id
                toolResult.toolCallId
                user.content[].type === tool_result.tool_use_id

缺失 = callIds 中不在 resultIds 里的
孤儿 = resultIds 中不在 callIds 里的
```

## 架构

```
tool-result-guard/
├── index.ts     主入口（130 行）：handler 编排
├── detect.ts    检测：findMissingToolResults / findOrphanToolResults
├── repair.ts    修复：删除 / 插入 / 静默补全（silentRepair）
├── dialog.ts    对话框：handleMissingDialog
├── session.ts   会话操作：removeToolCallFromSession / forceSessionReload
└── logger.ts    日志：appendLog
```

依赖关系：`index.ts → detect / repair / dialog / session / logger`

## 流程

```
payload 进入 before_provider_request
  ↓
检测缺失/孤儿工具结果
  ↓
有问题？ → silentRepair() ← 从 session entries 捞回结果
  ↓              |
  成功          失败
  ↓              ↓
放行 ✅        弹对话框 → 用户选择 → 修复/放行/删除
```

## 日志

| 文件 | 格式 | 内容 |
|:---|:---|:---|
| `/tmp/tool-result-guard.log` | JSON 数组 | 最近 10 次触发记录 |
| `/tmp/tool-result-guard-debug.log` | JSONL | 每次触发时的 payload 消息快照 |

## 使用场景

- 并行工具调用频繁的会话（多工具协作时最容易触发）
- 网络不稳定导致工具超时、结果晚到
- 扩展 reload / 会话切换后结果状态丢失

## 设计要点

| 决策 | 理由 |
|------|------|
| 静默修复优先 | 不打断用户，能自动解决就不弹框 |
| 对话框提供「放行」选项 | 尊重用户判断，不强制替用户做决定 |
| 日志 JSON 落盘 | 可事后回溯触发原因，辅助排查 pi 上游 bug |
| 无 UI 自动删除 | 无头环境下不能卡死流程 |
