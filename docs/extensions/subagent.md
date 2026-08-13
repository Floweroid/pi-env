# subagent — 子任务委托

> 核心扩展（16 个 TS 文件）。为每个子代理调用启动**独立 `pi` 进程**，拥有**隔离的上下文窗口**。

## 设计目标

单上下文窗口有容量上限，复杂任务需要分工。subagent 把任务拆给多个独立进程并行/串行执行，互不污染上下文。

## 三种执行模式

### 1. single — 单任务委托

```json
{ "agent": "agent名称", "task": "要委托的任务", "cwd": "可选工作目录" }
```

### 2. parallel — 并行执行

```json
{ "tasks": [
  { "agent": "agent-a", "task": "任务A" },
  { "agent": "agent-b", "task": "任务B" }
]}
```

所有子代理**同时启动**，各自独立异步执行。

### 3. chain — 顺序执行（支持传递）

```json
{ "chain": [
  { "agent": "agent-a", "task": "任务A" },
  { "agent": "agent-b", "task": "基于 {previous} 的后续任务" }
]}
```

按序执行，`{previous}` 占位符会被上一个任务的输出替换——适合「先分析后实现」的依赖型流水线。

## 核心机制

### 独立进程隔离

每次子代理调用 spawn 一个独立 `pi` 进程：

- `--no-extensions + --tools` 强制工具遮蔽（子代理只能看到指定工具）
- `detached: true / windowsHide: true` 进程隔离
- 子代理可指定：agent 名称、模型、工具白名单、systemPrompt、cwd

### 全异步 + 自动注入

所有模式**发起即返回**，子代理完成后结果自动注入回主会话（不阻塞主 Agent 继续工作）。

### subagent_kill — 终止子代理

```json
{ "task_id": "运行中的子代理ID" }
```

通过 `subagentRegistry`（运行中进程注册表）查询并终止。

### 事件日志

每个子代理的增量日志写入 `events.jsonl`；`finalizeLog + readReportOutput` 从日志读取最终输出。

## Agent 发现与作用域

subagent 复用 agent-manager 的扫描器，从三来源发现 agent：

```
1. agent-manager/agents/   （内建，默认）
2. ~/.pi/agent/agents/     （全局）
3. .pi/agents/             （项目级，最高优先级）
```

| agentScope | 含义 |
|------------|------|
| `user` | 内建 + 全局（用户级） |
| `project` | 仅 `.pi/agents/`（项目级） |
| `both` | 全部合并，项目级覆盖同名用户级 agent |

运行项目本地 agent 前默认弹确认框（`confirmProjectAgents: true`），防止项目代码里被塞入恶意 agent 定义。

## 工具参数（subagent 工具）

| 参数 | 说明 |
|------|------|
| `agent` / `task` | single 模式：目标 agent + 任务 |
| `tasks` | parallel 模式：{agent, task, cwd} 数组 |
| `chain` | chain 模式：{agent, task, cwd} 数组 |
| `agentScope` | user / project / both |
| `confirmProjectAgents` | 运行项目 agent 前是否确认（默认 true） |

## 架构

```
subagent/
├── index.ts       入口：session_start 捕获 UI/cwd，注册工具
├── tools.ts       TypeBox schema + 三种模式派发 + subagent_kill
├── agents.ts      agent 发现（复用 agent-manager scanner，按 scope 过滤）
├── handlers/
│   ├── spawn.ts       共享子进程 spawn 逻辑 + 进程注册表
│   ├── single-async.ts  single 模式执行
│   ├── parallel.ts      parallel 模式执行
│   └── chain.ts         chain 模式执行（{previous} 替换）
├── ui/            调用/结果渲染（single / parallel / chain / 通用）
├── history.ts     事件日志（events.jsonl）
└── utils.ts       pi 调用定位等工具函数
```

## 设计要点

| 决策 | 理由 |
|------|------|
| 独立进程而非线程 | 真正隔离上下文，子代理崩溃不影响主进程 |
| 全异步发起即返回 | 长任务不阻塞主 Agent 会话 |
| 工具遮蔽（--tools） | 子代理只能执行被授权的工具，安全边界明确 |
| 项目 agent 需确认 | 防止项目仓库中的 agent 定义被静默执行 |
| events.jsonl 增量日志 | 进程级可观测，支持 kill 后取回已完成输出 |
