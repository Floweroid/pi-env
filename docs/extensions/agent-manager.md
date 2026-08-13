# agent-manager — Agent 切换与上下文注入

> 核心扩展（11 个 TS 文件）。合并了 selectable-agents（切换）与 context-loader（上下文注入）两大能力：**`/agent` 切换 + 按 agent 注入 context / 工具白名单 / 模型**。

## 设计目标

一个 Agent 实例应对多个角色。agent-manager 让「当前角色」成为一等公民：

- **切换**：`/agent <name>` 一键切换角色（含交互选择器）
- **上下文注入**：每个 agent 携带自己的 context 文档，切换后自动注入
- **工具/模型绑定**：每个 agent 可定义自己的工具白名单和模型，切换即生效

## 三来源 Agent 发现

```
1. .pi/agents/*.agent/    （项目级，最高优先级）
2. ~/.pi/agent/agents/    （全局级）
3. agent-manager/agents/  （内建，默认）
```

## /agent 命令

| 命令 | 功能 |
|------|------|
| `/agent` | 打开交互选择器（UI 弹窗） |
| `/agent list` | 列出全部可用 agent |
| `/agent <name>` | 切换到指定 agent |
| `/agent none` | 恢复默认（清空当前 agent） |
| `/agent tools` | 显示当前工具列表 |
| `/agent export <name>` | 导出到全局（骨架） |
| `/agent unexport <name>` | 取消导出（骨架） |

快捷键：**Alt+A** 循环切换。

## 核心机制

### 1. context 注入（before_provider_request）

读取当前 agent 的 `context/` 目录下所有 `.md` 文件，排序拼接后注入消息列表：

```
agentDir/
├── agent.md          # agent 定义（frontmatter: name/description/tools/model）
└── context/          # 注入的上下文文档
    ├── 01-xxx.md
    └── 02-yyy.md
```

- 模块级缓存，切换时失效重建
- `MAX_CONTEXT_BYTES` 限制注入体积
- 切换信息（from → to + 描述）注入下一轮，让模型感知角色变化

### 2. 工具白名单

每个 agent 可声明 `tools` 字段。切换后 `pi.setActiveTools(agent.tools)` 立即生效；`/agent none` 恢复全部工具。

### 3. 模型切换

每个 agent 可声明 `model` 字段（支持 `provider:modelId` 和裸 `modelId` 两种格式）。切换时经 `modelRegistry` 解析后 `pi.setModel()`。

### 4. 子代理模式（PI_ACTIVE_AGENT）

子代理进程可通过环境变量 `PI_ACTIVE_AGENT=<name>` 指定目标 agent：

- 跳过 session 恢复逻辑，直接激活指定 agent
- 应用其 model / tools / context —— **subagent 扩展因此能复用 agent 配置**

### 5. entry renderer

注册 `agent-switch` entry renderer，切换动作在会话中渲染为结构化条目（switch-notify），清晰记录角色变更历史。

## 架构

```
agent-manager/
├── index.ts          入口：组装 scanner/store/injector/commands/ui/render
├── core/
│   ├── scanner.ts    agent 文件扫描（frontmatter 解析）
│   ├── store.ts      注册表 + 当前激活 agent 状态
│   ├── injector.ts   context 加载与注入（缓存 + 切换信息）
│   └── types.ts      类型 + 常量（CONTEXT_MARKER / SWITCH_MARKER / MAX_CONTEXT_BYTES）
├── commands/
│   ├── switch.ts     /agent 命令 + Alt+A + 工具白名单 + 模型解析
│   └── export.ts     agent 导出/取消导出
├── ui/
│   ├── widget.ts     状态 widget
│   └── selector.ts   交互选择器
├── render/
│   └── entry-renderer.ts  agent-switch 条目渲染
└── agents/           内建 agent 定义（默认）
```

## 设计要点

| 决策 | 理由 |
|------|------|
| 三来源 + 项目级优先 | 项目自带 agent 定义覆盖全局，多项目互不干扰 |
| context 文件化（.md 目录） | 上下文即文档，可版本管理、可 diff |
| 工具/模型随 agent 绑定 | 角色切换 = 能力切换，一次到位 |
| PI_ACTIVE_AGENT 环境变量 | 子代理复用同一套 agent 配置，主/子 Agent 行为一致 |
| 切换信息注入下一轮 | 模型感知「我换角色了」，避免上下文割裂 |
