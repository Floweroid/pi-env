# 路线图

> 现状 → 近期 → 中期 → 愿景。主线：**把 pi-env 的 Agent 插件实践带到更多框架**。

## ✅ 已完成

| 里程碑 | 时间 | 说明 |
|--------|------|------|
| pi-env 配置中心 | 2026-08 | 按 OS 分类、软链接、运行时分离、多设备同步 |
| planning 任务计划引擎 | 2026-07~08 | 两阶段强制同步 + Overlay + 规则引擎 + 内联标记 |
| subagent 子任务委托 | 2026-08 | single / parallel / chain 三模式，独立进程隔离 |
| agent-manager | 2026-08 | /agent 切换 + context/工具/模型绑定 |
| tool-result-guard | 2026-08 | 修复 pi 上游 tool_result 丢失（Issue #7053） |
| async-tasks / web-fetch / permission-gate | 2026-08 | 异步执行 / 网络能力 / 权限门控 |
| 文档中心 | 2026-08 | docs/ 完整文档（架构/扩展/开发/安全/同步） |

## 🚧 近期（补齐可信度短板）

| 事项 | 说明 | 优先级 |
|------|------|:---:|
| **补齐 SYNC-RULES.md** | README 已承诺的「LLM 同步铁律」，当前缺失 | 🔴 高 |
| **补齐 sync-to-device.sh** | 幂等只增不删的同步唯一入口，README 已承诺 | 🔴 高 |
| **README 重构** | 路演式：插件工具链前置 + 截图 + docs 链接 | 🔴 高 |
| GitHub 元信息 | description / topics / homepage 包装 | 🟡 中 |
| 效果截图 | planning Overlay / 状态栏 / subagent 调用记录 | 🟡 中 |

## 🔭 中期（扩展能力）

| 事项 | 说明 |
|------|------|
| planning 增强 | 计划模板自定义 / 多会话计划合并 / 甘特式时间预估 |
| subagent 增强 | 结果结构化返回（JSON schema）/ 子代理预算控制（token 上限） |
| agent-manager 增强 | agent 市场（可分享 agent 定义）/ 配置文件热加载 |
| web-fetch 增强 | 更聪明的正文提取 / 站点模板记忆 |
| permission-gate 增强 | 规则可配置化（用户自定义危险模式） |
| 单测覆盖 | 核心规则引擎（validator / 状态机）补测试 |

## 🎯 DeepSeek Harness 适配计划（2026-08）

> pi-env 是「Agent Harness 类框架」的深度实践者——8 个扩展基于事件钩子 + 工具注册实现。若接入 DSH，将按以下路径适配：

### 阶段 1：能力映射（发布第一时间）

| pi-env 插件 | DSH 对应形态 | 适配工作 |
|------------|-------------|---------|
| planning | plugin（任务规划） | 事件模型映射（before_provider_request → DSH 对应钩子） |
| subagent | orchestrator / aggregator | 进程模型对齐 + 结果注入协议 |
| agent-manager | plugin（角色管理） | agent 定义格式转换（frontmatter → DSH 格式） |
| tool-result-guard | plugin（可靠性） | 工具结果 schema 对齐 |
| permission-gate | plugin（安全） | 拦截点映射 |
| async-tasks / web-fetch | plugin / skill | 工具注册接口对齐 |

### 阶段 2：验证与反馈

- 在 DSH 上重放真实工作流（多工具协作 / 长任务 / 多角色切换）
- 验证工具结果可靠性机制（tool-result-guard 的实战场景）
- 反馈：工具调用结果结构化 schema、凭证跨设备管理、事件模型兼容性

### 阶段 3：开源协同

- 将适配后的插件以 DSH plugin/skill 形式开源
- 沉淀「Pi → DSH 迁移指南」，帮助两个生态的开发者互通

## 🌟 愿景

1. **插件一次编写，多框架运行**：抽象事件钩子与工具注册的通用层，降低 Agent 插件在 Pi / DSH / 其他 Harness 间的迁移成本
2. **Agent 配置工程化成为标准实践**：按 OS 分类 + 软链接 + 幂等同步 + 凭证隔离，推广为 Agent 环境管理的参考方案
3. **安全默认**：每个 Agent 环境默认具备权限门控、结果兜底、防 SSRF 三道防线

---

*路线图随实践更新。近期任务完成后会逐项打勾。*
