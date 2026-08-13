# 扩展开发指南

> 基于 pi-env 8 个扩展的实战经验，写给想在 Pi / 类似 Agent 框架上开发扩展的人。

## 扩展是什么

一个扩展 = 一个目录（或单文件），通过 Pi 的 `ExtensionAPI` 挂接事件、注册工具、渲染 UI。pi-env 的扩展源码在 `linux/extensions/<name>/`。

## 扩展的基本结构

### 单文件扩展（最小形态）

```typescript
// permission-gate.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 注册命令、挂事件…
}
```

### 多文件扩展（推荐：目录 + package.json）

```json
// web-fetch/package.json
{
  "name": "web-fetch",
  "version": "1.0.0",
  "private": true,
  "pi": { "extensions": ["./index.ts"] },
  "dependencies": { "turndown": "^7.2.4" }
}
```

```
planning/              # 目录扩展示例
├── index.ts           入口：纯组装（<60 行）
├── store.ts           状态持有 + 持久化
├── core/              渲染/规则引擎
├── tools/             工具注册 + handler
├── commands/          /plan 命令
└── prompts/           注入文案
```

**模式**：`index.ts` 只做组装，业务逻辑按职责拆模块——pi-env 各扩展都遵循此模式，便于测试与维护。

## ExtensionAPI 核心能力（源码中实测可用）

### 1. 事件钩子（pi.on）

| 事件 | 时机 | 用途示例 |
|------|------|---------|
| `session_start` | 会话启动 | 恢复状态、扫描配置、创建 Overlay |
| `session_shutdown` | 会话结束 | 清理进程、释放资源 |
| `before_provider_request` | 每次 LLM 请求前 | **注入上下文 / 修改 payload**（planning 计划注入、agent-manager context 注入、tool-result-guard 修复都在这） |
| `tool_call` | 工具被调用时 | 工具门控（planning 屏蔽非 plan_tasks 工具） |

```typescript
pi.on("before_provider_request", async (event) => {
  const payload = event.payload as any;
  payload.messages.push({ role: "system", content: "…" });
});
```

### 2. 注册工具（pi.registerTool）

```typescript
import { Type } from "typebox";

pi.registerTool({
  name: "async_run",
  label: "Async Run",
  description: "Run a shell command. Returns immediately with a task_id.",
  parameters: Type.Object({
    command: Type.String({ description: "Command to run" }),
    cwd: Type.Optional(Type.String()),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const workDir = params.cwd || ctx.cwd;
    // …执行逻辑，返回结果
  },
});
```

要点：
- 参数用 **TypeBox schema**（`@earendil-works/pi-ai` 提供 `StringEnum` 等扩展）
- `execute` 接收 ctx（含 `cwd` 等），返回值即工具结果

### 3. 主动发消息（pi.sendMessage）

```typescript
pi.sendMessage(
  { customType: "async_task_result", content: "…", display: true },
  { triggerTurn: true }   // 触发新一轮对话
);
```

用于异步完成后的**结果注入**（async-tasks 的核心机制）。

### 4. 模型 / 工具集控制

```typescript
pi.setModel(model);                    // 切换模型
pi.setActiveTools(toolNames);          // 设置工具白名单
const all = pi.getAllTools().map(t => t.name);  // 全量工具
```

### 5. UI 能力（ctx.ui）

- `ctx.ui.setStatus(key, text)` — 底部状态栏
- Overlay / 选择器 / 快捷键 — 见 planning（Overlay 卡片）、agent-manager（Alt+A 选择器）
- `pi.registerEntryRenderer(type, renderer)` — 会话条目渲染（agent-switch 通知）

### 6. 子进程

```typescript
import { spawn } from "node:child_process";
// subagent：spawn 独立 pi 进程，detached + windowsHide 隔离
// async-tasks：spawn 后台命令，立即返回 task_id
```

## 开发 → 发布生命周期

```
开发阶段：~/proj/pi-exp/.pi/extensions/<name>/   （只影响实验项目）
    │
    ▼  publish-from-exp.sh <name>
    ├──→ staging/<日期>/<name>         （发布快照，git 可回溯）
    └──→ <os>/extensions/<name>/       （稳定版，随 pi-env 分发）
```

```bash
# 发布到 Linux
/data/pi-env/scripts/publish-from-exp.sh agent-manager

# 发布到 Windows / 全部
/data/pi-env/scripts/publish-from-exp.sh agent-manager --os windows
/data/pi-env/scripts/publish-from-exp.sh --all
```

**为什么要 staging 快照**：实验代码先隔离测试，稳定后才进入分发目录；一旦稳定版出问题，staging 里每个日期的快照可回溯。

## 实战经验（踩坑总结）

| 经验 | 说明 |
|------|------|
| 上下文注入要放末尾 | `before_provider_request` 中 splice 到消息列表末尾，避免与已有消息冲突（planning 的做法） |
| 懒加载重依赖 | web-fetch 的 turndown/playwright 用 `await import()`，启动零开销 |
| 结果注入去重 | async-tasks 用 `resultInjected` 标志防重复注入 |
| 会话结束清理 | `session_shutdown` 杀后台任务 / 子进程，不留孤儿 |
| 持久化随 session | planning 的 restoreState 在 `session_start` 恢复，重开不丢 |
| 纯组装入口 | index.ts 保持 <60 行，逻辑全在子模块，可读性关键 |
| 中文标签 + 符号渲染 | planning 用中文上下文标签（模型鲁棒）+ 符号 UI（人眼快速扫描） |

## 测试建议

1. **隔离环境**：先在 `pi-exp` 实验项目里开发测试，稳定后再 publish
2. **真实会话验证**：扩展的最终用户是 LLM——用真实任务验证 LLM 是否按预期调用工具/遵守注入规则
3. **回归**：发布前跑一遍核心场景（planning：开新任务→推进→完成；async-tasks：长命令→peek→kill）

## 参考

- 框架类型定义：`@earendil-works/pi-coding-agent`（ExtensionAPI / ExtensionContext）
- 工具辅助：`@earendil-works/pi-ai`（StringEnum）
- 参数 schema：`typebox`
- 最佳实践范例：`linux/extensions/planning/`（最完整的目录扩展）、`linux/extensions/web-fetch/`（懒加载范例）
