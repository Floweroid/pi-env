# planning — 任务计划引擎

> 核心扩展（20 个 TS 文件）。解决 Agent 最典型的问题：**任务偏移**——做着做着忘了计划。

## 设计目标

让「计划」成为 Agent 工作流的强制组成部分，而非可选的聊天话题：

- **计划先于执行**：每轮对话先同步计划，再处理用户消息
- **双通道更新**：LLM 工具调用 + 回复内联标记，两条路都能更新计划
- **可视化**：终端右上角 Overlay 卡片，人眼可随时确认进度
- **规则约束**：依赖方向、完成条件（未测试不算完成）由规则引擎强制

## 核心机制

### 1. 两阶段强制同步（计划阶段 → 执行阶段）

```
用户消息
  → 阶段 1（计划）：注入同步指令 → 仅 plan_tasks 可用（其他工具被屏蔽）
    → LLM 调 plan_tasks（add/update）
  → 阶段 2（执行）：恢复用户原消息 → 全部工具可用
    → LLM 正常工作
```

- 阶段标记：`---计划阶段---` / `---执行阶段---`
- 工具屏蔽：通过 `tool_call` 事件 block 所有非 `plan_tasks` 工具，确保 LLM 只做计划不做执行
- 防环回：两阶段各执行一次，执行阶段结束自动重置
- 挂钩点：`before_provider_request`（上下文注入）+ `tool_call`（工具门控）

### 2. 上下文注入

每次 LLM 请求前，将当前计划作为 system 消息注入到消息列表末尾：

```
[当前任务计划 — 共 3 条]

[ing..]-#1.分析需求
[未开始]-#2.设计架构 前置：[1]
[已完成]-#3.编码实现 前置：[2]

状态：[-]未开始 [=]暂停 [ing..]进行中 [√]已完成 [x]取消
规则：进入[进行中]需前置[已完成]或[暂停]；前置暂停/取消→依赖任务自动暂停
```

### 3. `plan_tasks` 工具

| action | 职责 | 参数 |
|--------|------|------|
| `add` | 追加任务（upsert：同 ID 更新） | `tasks: [{id, name, prerequisites?, note?}]` |
| `update` | 更新状态 | `changes: [{id, status}]` |
| `view` | 查看 | 无 |

需同时追加+改状态时，在同一条回复中连续调用 `add` + `update`。

### 4. 内联标记（工具 fallback）

LLM 在回复中直接写标记即可自动更新计划：

| 标记 | 效果 |
|------|------|
| `[√:1]` / `[✓:1]` | 任务 #1 → 已完成 |
| `[ing..:2]` | 任务 #2 → 进行中 |
| `[=:3]` | 任务 #3 → 暂停 |
| `[x:4]` | 任务 #4 → 取消 |

示例：LLM 回复 *"重构完成 [√:3]，接下来开始测试 [ing..:4]"* —— 无需调用工具即完成同步。

### 5. 规则引擎（validator）

- **状态转换**：`pending → in_progress` 前置必须 `completed` 或 `paused`（不可 `pending`）
- **级联暂停**：前置 `paused/cancelled` → 依赖它的 `in_progress` 任务自动暂停
- **依赖方向**：建依赖前自问 *"A 完成 B 才能开始？→ B 前置 A"*；防止父子前置标反
- **测试闭环**：改动未通过测试验证的任务不得标记完成（未验证保持 in_progress）
- **多轮无进展**：进行中任务长时间无进展 → 退回暂停或未开始

### 6. Overlay 卡片（UI）

- 位置：终端右上角；宽度自适应内容；最大高度终端 50%
- 分区：进行中 / 目标 / 已完成（可独立折叠）
- 快捷键 `Ctrl+Alt+T` 循环切换折叠
- 计划为空时自动隐藏；无背景色融入终端

### 7. 会话持久化

计划状态随 session 保存，重开会话自动恢复（`session_start` 时 restoreState）。

## /plan 命令

| 命令 | 功能 |
|------|------|
| `/plan` | 弹窗显示完整计划 |
| `/plan toggle [分区]` | 切换折叠（分区：进行中/目标/已完成） |
| `/plan expand-all` / `collapse-all` | 展开/折叠所有 |
| `/plan template [名称]` | 列出 / 加载模板（5 套：review/refactor/deploy/feature/dev） |
| `/plan export [路径]` | 导出为 Markdown 表格 |
| `/plan reset` | 清空计划 |

## 架构

```
planning/
├── index.ts       入口：纯组装（<60 行）
├── store.ts       状态持有 + 持久化
├── types.ts       类型 + 常量
├── core/          渲染引擎：format（上下文格式化）/ widget（Overlay）/ validator（规则）/ overlay（生命周期）
├── tools/         plan_tasks 注册 + add/update/view handler
├── commands/      /plan 命令路由 + toggle / template / export
├── sync/          两阶段状态机 + 工具屏蔽 + 内联标记自动同步
└── prompts/       注入文案：guidelines（13 条 LLM 行为准则）/ sync-message / templates
```

## 设计决策摘录

| 决策 | 理由 |
|------|------|
| 上下文用中文标签，Widget 用符号 | 模型对自然语言更鲁棒；人眼对符号扫描更快 |
| 强制同步在前（before_agent_start） | 计划先于工作，而非滞后 |
| 内联标记作为工具 fallback | LLM 忘记调工具时也能自动同步 |
| `add` 而非 `init` 追加 | 全量替换浪费且危险，追加 + upsert 更安全 |
| 前置允许 paused | 父任务暂停后子任务可并行执行 |
| Overlay 默认 unfocused | 不阻塞编辑器键盘输入 |

## 任务状态机

```
pending ──▶ in_progress ──▶ completed
   ▲            │  │
   │            │  └──▶ cancelled
   │            └──▶ paused（依赖阻塞/等待子任务）
   └──（多轮无进展自动退回）
```
