# 扩展文档

> pi-env 自研扩展的逐个深度文档。按与 Agent 核心的接近程度排序。

## 索引

| 扩展 | 文档 | 规模 | 一句话 |
|------|------|:---:|--------|
| planning | [planning.md](planning.md) | 20 ts | 任务计划引擎：两阶段同步 + Overlay + 规则引擎 |
| subagent | [subagent.md](subagent.md) | 16 ts | 子任务委托：single / parallel / chain，独立进程隔离 |
| agent-manager | [agent-manager.md](agent-manager.md) | 11 ts | Agent 切换 + context / 工具 / 模型绑定 |
| tool-result-guard | [tool-result-guard.md](tool-result-guard.md) | 6 ts | 修复 tool_result 丢失（竞态 + 快照） |
| permission-gate | [permission-gate.md](permission-gate.md) | 1 ts | 权限门控：yolo / warn / strict |
| async-tasks | [async-tasks.md](async-tasks.md) | 3 ts | 后台任务：异步执行 + 结果自动注入 |
| web-fetch | [web-fetch.md](web-fetch.md) | 1 ts | URL 抓取 + 正文提取 + Markdown 转换 |
| agent-core | [agent-core.md](agent-core.md) | 1 ts | 共享 agent 扫描器（agent-manager / subagent 复用） |

## 相互关系

```
                    agent-core（共享扫描器）
                    ┌──────────┴──────────┐
              agent-manager           subagent
              （切换/注入）          （委托执行，复用 agent 配置）
                    │
   ┌────────────────┼──────────────────┐
planning         permission-gate     async-tasks
（计划引擎）        （权限闸门）        （异步执行）
   │                   │                   │
   └─────────── tool-result-guard（结果兜底）┘
                    web-fetch（网络能力）
```

## 按关注维度选文档

- 想解决「任务偏移 / 计划混乱」→ [planning.md](planning.md)
- 想解决「上下文不够 / 需要分工」→ [subagent.md](subagent.md)
- 想解决「多角色切换混乱」→ [agent-manager.md](agent-manager.md)
- 想加固「安全边界」→ [permission-gate.md](permission-gate.md) + [security.md](../security.md)
- 想解决「工具结果丢失」→ [tool-result-guard.md](tool-result-guard.md)
- 想让 Agent「不阻塞等长任务」→ [async-tasks.md](async-tasks.md)
