# Agent-manager 插件内部原理

> 当插件代码变更时，需要理解以下机制才能判断哪些 agent 受影响、如何更新。

## 模块架构

```
agent-manager/
├── index.ts                    # 入口：注册命令、事件处理
├── core/
│   ├── scanner.ts              # 扫描 .agent/ 目录，解析 frontmatter
│   ├── injector.ts             # context 注入到 LLM 消息
│   ├── store.ts                # 内存状态 + 持久化/恢复
│   └── types.ts                # 类型定义 + 常量
├── commands/
│   └── switch.ts               # /agent 命令 + 切换逻辑 + model 解析
├── render/
│   ├── entry-renderer.ts       # agent 切换记录渲染
│   └── switch-notify.ts        # 切换通知
└── ui/
    ├── selector.ts             # 交互选择器
    └── widget.ts               # 状态栏 widget
```

---

## scanner.ts — Agent 发现与解析

### 三来源扫描（`discoverAgents`）

```
优先级：project > global > builtin

.project/ .pi/agents/*.agent/     ← 项目级（最高优先）
~/.pi/agent/agents/*.agent/      ← 全局级
agent-manager/agents/*.agent/    ← 内建（最低优先）
```

同名 agent 高优先级覆盖低优先级。

### 解析单个 agent（`parseAgentDir`）

1. 读取 `<dir>/agent.md`
2. 用 `parseFrontmatter()` 提取 YAML 头
3. 解析的 frontmatter 字段：

```typescript
name: string             // 优先 frontmatter name，fallback 目录名去掉 .agent 后缀
description: string      // frontmatter description
global: boolean          // frontmatter global（true/"true"）
model?: string           // frontmatter model（原始字符串）
tools?: string[]         // frontmatter tools（逗号分隔 → 数组，空数组 → undefined）
systemPrompt: string     // body 部分（去掉 frontmatter 的正文）
hasContext: boolean      // context/ 下是否有 .md 文件
```

4. `global` 字段当前未实际使用（P2 未实现）
5. `tools` 是逗号分隔的字符串列表，如 `"read, bash, write"`
6. `model` 可以是 `"provider:modelId"` 或裸 `"modelId"`

### 关键点

- agent.md 必须存在，否则跳过该目录
- frontmatter 解析失败时，全文作为 systemPrompt（降级处理）
- context/ 存在且至少有一个 .md 文件 → hasContext = true

---

## injector.ts — Context 注入

### 加载流程（`loadAgentContext`）

1. 读取 `<agentDir>/context/*.md` 文件
2. 按文件名 ASCII 排序
3. 拼接为单个消息：

```
[系统信息 — 以下为 agent 专属上下文，非用户对话]

<!-- agent-context -->

## 01-hardware.md

{文件正文}

## 02-software.md

{文件正文}
```

4. `CONTEXT_MARKER = "<!-- agent-context -->"` 用于注入和清理
5. 总大小限制 `MAX_CONTEXT_BYTES = 40000` 字节，超限跳过并追加警告提示（不截断尾部）

### Switch info 注入（`setPendingSwitchInfo` / `pendingSwitchInfo`）

切换时由 `switchToAgent()` 调用 `setPendingSwitchInfo({ from, to, description })`，存入模块级变量。
单轮多次切换 → 覆盖旧值，只保留最新一次。

### 注入到消息列表（`createInjectorHandler`）

触发时机：`before_provider_request` 事件（每次 LLM 请求前）

1. 无 `cachedContext` 且无 `pendingSwitchInfo` → 跳过
2. 删除所有含 `CONTEXT_MARKER` 或 `SWITCH_MARKER` 的消息（清理旧注入）
3. 构建注入列表：switch info 在前，context 在后
4. 在 index 0（system prompt）之后依次插入

### 关键点

- context 是会话级缓存（模块级 `cachedContext` 变量）
- switch info 是 pending 变量，注入后立即清空
- 切换 agent 时重新加载 context
- 如果 context/ 不存在或为空 → 不注入 context，但仍可注入 switch info
- `SWITCH_MARKER = "<!-- agent-switch-info -->"` 用于清理旧开关消息

---

## store.ts — 状态管理

### 内存状态

```typescript
activeAgent: string | null     // 当前激活的 agent name
agentRegistry: AgentEntry[]    // 所有已发现的 agent 列表
```

### 持久化

`persistState(pi)` → `pi.appendEntry("active-agent", { name })`  
写入 session entry，不参与 LLM context。

### 恢复

`restoreState(ctx)` → 倒序扫描 session entries，取最近一条 `"active-agent"` entry。

---

## switch.ts — Agent 切换

### 切换流程（`switchToAgent`）

```
1. store.setActiveAgent(name)
2. 如果有 agent.model → resolveModel() → pi.setModel()
3. applyAgentTools(name) → pi.setActiveTools(agent.tools ?? allTools)
4. 如果有 agent.hasContext → loadAgentContext(dir)
5. 否则 → clearContext()
6. store.persistState(pi) → 持久化
7. updateWidget → 更新状态栏
8. pi.appendEntry("agent-switch", data) → 切换记录（UI 渲染，非 LLM 可见）
9. ctx.ui.notify → toast 通知（UI 层，非 LLM 可见）
10. setPendingSwitchInfo({ from, to, description }) → LLM 可见切换信息（下轮 before_provider_request 注入）
```

### model 解析（`resolveModel`）

- 包含 `:` → 按 `provider:modelId` 精确匹配
- 不包含 `:` → 遍历所有 model 匹配 `.id`
- 未匹配 → warn，不阻断切换

### 工具过滤（`applyAgentTools`）

- `agent.tools` 有值 → `setActiveTools(agent.tools)`（白名单）
- `agent.tools` 无值 → `setActiveTools(allTools)`（全部可用）
- 切换到 none → 恢复全部工具

---

## index.ts — 生命周期

### session_start

1. 扫描三来源 → `store.setAgentRegistry()`
2. 从 session entries 恢复 activeAgent
3. 恢复 model、tools、context

### before_agent_start

- 替换 system prompt 为 agent 的 `systemPrompt`

### before_provider_request

- 注入 context（见 injector）

### resources_discover（/reload 时）

1. 重新扫描 agents
2. 检查当前 agent 是否仍存在（否则清空）
3. 恢复 model、tools

---

## 扩展点

### 添加新的 frontmatter 字段

1. 在 `scanner.ts` 的 `parseAgentDir()` 中解析
2. 在 `types.ts` 的 `AgentEntry` 中添加字段
3. 在 `switch.ts` 的 `switchToAgent()` 中应用

### 修改 context 注入格式

1. 修改 `injector.ts` 的 `loadAgentContext()` 中的拼接逻辑
2. 如果改变了 `CONTEXT_MARKER`，同时更新 `createInjectorHandler` 的清理逻辑
