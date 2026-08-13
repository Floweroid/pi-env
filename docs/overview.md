# 项目总览

## 一句话定位

为 **Pi Coding Agent** 自建的核心插件工具链 + 多设备工程化配置方案——不止是 dotfiles，而是一套「Agent 工作台」。

## 为什么做这个项目

日常重度使用 Agent 编码（近 30 天 2 万+ 次 API 调用）后，逐步暴露出一批**框架层未覆盖的真实痛点**：

- Agent 常常**任务偏移**，做完 A 忘了 B —— 需要强制性的任务计划机制
- 复杂任务需要**分工**，单上下文装不下 —— 需要子任务委托
- 多项目切换时，**上下文和工具集混乱** —— 需要按 agent 隔离
- 并行工具调用偶发 **tool_result 丢失** 导致 400 错误 —— 需要兜底修复
- 危险命令和敏感文件缺少**最后一道闸** —— 需要权限门控
- 耗时命令**阻塞会话** —— 需要异步执行

pi-env 用 8 个扩展 + 一套工程化分发方案回答这些问题。

## 设计哲学

### 1. 框架缺什么，就补什么（不重造轮子）

所有扩展都基于 Pi 官方 `ExtensionAPI` 的事件钩子（`before_provider_request` / `tool_call` / `session_start` 等）实现，**不 fork、不魔改核心**，与上游保持兼容。

### 2. 配置按 OS 分类，而非按设备

同一 OS 下 Pi 配置完全同构：Linux Desktop = Termux = WSL = 树莓派，共享一份 `linux/` 配置；Windows 单独适配。多设备同步因此变成「拉取同一份」而非「逐台维护」。

### 3. LLM 操作必须有铁律

Agent 自己管理自己的配置，必须用脚本而非自由发挥。`SYNC-RULES.md` 定义同步唯一入口（`sync-to-device.sh`），幂等、只增不删、硬排除敏感文件。

### 4. 安全是设计约束，不是事后补丁

凭证（auth.json）、会话（sessions/）、信任（trust.json）从第一天就排除在 Git 之外；扩展开发走「开发 → staging → 稳定」三级发布，杜绝实验代码污染生产配置。

## 核心概念

| 概念 | 说明 |
|------|------|
| **配置中心** | `/data/pi-env/`，Git 管理的唯一配置源 |
| **按 OS 分类** | `linux/` / `windows/` 两套模板，而非每设备一套 |
| **软链接** | `~/.pi/agent → /data/pi-env/linux/`，Pi 直接读取 |
| **运行时分离** | 配置入 Git，运行时（sessions/node_modules）留在数据盘 |
| **扩展生命周期** | 开发（pi-exp）→ staging 快照 → 稳定（linux/extensions/） |
| **SYNC-RULES** | LLM 执行同步的唯一安全入口，幂等只增不删 |

## 扩展全景

```
                    ┌─────────────────────────────┐
                    │        Pi Agent 核心         │
                    └─────────────┬───────────────┘
          ┌───────────────────────┼───────────────────────┐
   ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
   │  planning   │         │  subagent   │         │agent-manager│
   │ 任务计划引擎 │         │ 子任务委托  │         │ Agent 切换  │
   └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
          │                       │                       │
   ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
   │permission-  │         │ async-tasks │         │ web-fetch   │
   │gate 权限门  │         │ 后台任务     │         │ 网络获取    │
   └──────┬──────┘         └─────────────┘         └─────────────┘
          │
   ┌──────▼──────────┐
   │ tool-result-    │         agent-core（共享扫描器，被
   │ guard 结果修复  │         agent-manager / subagent 引用）
   └─────────────────┘
```

## 规模

- **8 个扩展**，67 个 TypeScript 文件
- planning 20 文件 / subagent 16 文件 / agent-manager 11 文件，为主要模块
- 5 个管理脚本（link-local / export / import / sync-to-device / publish-from-exp）
- 平台覆盖：Linux Desktop / Termux / WSL / 树莓派 / Windows（Git Bash）

## 下一步

- 想立即上手 → [getting-started.md](getting-started.md)
- 想理解架构 → [architecture.md](architecture.md)
- 想了解某个扩展 → [extensions/](extensions/)
- 想开发自己的扩展 → [development.md](development.md)
