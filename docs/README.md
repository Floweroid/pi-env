# 📖 pi-env 文档中心

> pi-env — 为 [Pi Coding Agent](https://pi.dev) 自建的核心插件工具链 + 多设备工程化配置方案。

本文档中心按「理解 → 使用 → 开发 → 安全」四个层次组织，建议按序阅读。

## 🗺️ 文档地图

### 入门（先读这两篇）

| 文档 | 内容 |
|------|------|
| [overview.md](overview.md) | 项目总览：定位、设计哲学、核心概念、扩展清单 |
| [getting-started.md](getting-started.md) | 快速上手：单机 / 多设备 / Windows 三种场景 |

### 架构与设计

| 文档 | 内容 |
|------|------|
| [architecture.md](architecture.md) | 配置中心架构：按 OS 分类、软链接拓扑、扩展生命周期 |

### 扩展文档（逐个深入）

| 扩展 | 文档 | 说明 |
|------|------|------|
| planning | [extensions/planning.md](extensions/planning.md) | 任务计划引擎（两阶段同步 / Overlay / 规则引擎） |
| subagent | [extensions/subagent.md](extensions/subagent.md) | 子任务委托（single / parallel / chain） |
| agent-manager | [extensions/agent-manager.md](extensions/agent-manager.md) | Agent 切换与上下文注入 |
| tool-result-guard | [extensions/tool-result-guard.md](extensions/tool-result-guard.md) | 工具结果丢失修复 |
| permission-gate | [extensions/permission-gate.md](extensions/permission-gate.md) | 权限门控（yolo / warn / strict） |
| async-tasks | [extensions/async-tasks.md](extensions/async-tasks.md) | 后台任务（异步执行 + 结果注入） |
| web-fetch | [extensions/web-fetch.md](extensions/web-fetch.md) | URL 获取与 HTML→Markdown 转换 |
| agent-core | [extensions/agent-core.md](extensions/agent-core.md) | 共享 agent 扫描与解析（内部库） |

### 开发与维护（写给扩展作者）

| 文档 | 内容 |
|------|------|
| [development.md](development.md) | 扩展开发指南：ExtensionAPI / 事件钩子 / 生命周期 / 发布流程 |
| [security.md](security.md) | 安全设计：SYNC-RULES / 凭证隔离 / 信任模型 |
| [sync.md](sync.md) | 多设备同步机制：export / import / link-local / 幂等规则 |

### 方向

| 文档 | 内容 |
|------|------|
| [roadmap.md](roadmap.md) | 路线图与愿景（含 DeepSeek Harness 适配计划） |

## 🧩 扩展速览

| 扩展 | 一句话 |
|------|--------|
| **planning** | 任务计划管理：计划先于执行，LLM 工具 + Overlay 卡片双通道 |
| **subagent** | 为每个子任务启动独立 pi 进程，三种执行模式全异步 |
| **agent-manager** | `/agent` 切换 + 按 agent 注入 context / 工具白名单 / 模型 |
| **tool-result-guard** | 修复并行工具调用导致的 tool_result 丢失（竞态 + 快照） |
| **permission-gate** | 三档权限模式，拦截危险命令与敏感路径访问 |
| **async-tasks** | 后台跑命令不阻塞，完成自动注入结果，支持 peek / kill |
| **web-fetch** | 抓取 URL：正文提取 → Markdown，SPA 渲染，内网拦截 |
| **agent-core** | 共享的 agent 文件发现解析器（agent-manager / subagent 共用） |

## 📁 目录对照

| 路径 | 对应文档 |
|------|---------|
| `linux/extensions/<name>/` | [extensions/](extensions/) |
| `scripts/` | [sync.md](sync.md) |
| `SYNC-RULES.md`（仓库根） | [security.md](security.md) |

---

*文档与源码保持同步。修改扩展后请同步更新对应文档。*
