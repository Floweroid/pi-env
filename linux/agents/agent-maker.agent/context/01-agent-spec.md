# Agent 格式规范（v2.1）

> 本文档定义 agent 的目录结构和文件格式，创建新 agent 时必须遵守。

## 目录结构

```
<name>.agent/
├── agent.md              # 必需：YAML frontmatter + system prompt
└── context/              # 可选：专属上下文（.md 文件）
```

## agent.md 格式

```yaml
---
name: <agent-name>              # 必需：小写字母 + 连字符
description: <简要说明>          # 必需：一句话，显示在 /agent list
global: true|false              # 可选：是否全局导出（默认 false）
model: <provider:modelId>       # 可选：指定 LLM 模型
tools: tool1, tool2, tool3      # 可选：工具白名单，逗号分隔。无此字段 = 全部可用
---

<system prompt 正文 — 角色定义、职责、行为准则>
```

### frontmatter 字段

| 字段 | 必需 | 类型 | 说明 |
|:---|:---:|:---:|:---|
| `name` | ✅ | string | Agent 唯一标识，也是目录名去掉 `.agent` 后缀 |
| `description` | ✅ | string | 简短说明，显示在 `/agent list` 中 |
| `global` | ❌ | bool | 是否导出到全局（通常不管） |
| `model` | ❌ | string | 切换到此 agent 时自动设置模型，例 `anthropic:claude-sonnet-4-20250514` |
| `tools` | ❌ | string[] | 工具白名单，逗号分隔。不填则使用全部工具 |

### 命名约定

- 目录后缀：`.agent`
- agent name：小写字母 + 连字符
- 例如：`code-review.agent`、`ops.agent`、`agent-creator.agent`

## context/ 目录

- 文件排序：按文件名 ASCII 排序后拼接注入
- 格式：`.md` 文件
- 不存在或为空 → 不注入额外上下文
- 注入时机：切换到此 agent 时，自动注入到 provider request

### 文件建议

| 文件名 | 用途 |
|:---|:---|
| `01-*.md` | 稳定信息（硬件事实、配置约定） |
| `02-*.md` | 对象信息（服务、依赖关系） |
| `03-*.md` | 规则信息（标准、模板、流程） |
| `04-*.md` | 元信息（检查清单、范例） |

## 发现优先级

三来源扫描，同名 agent 高优先级覆盖：

1. `.pi/agents/<name>.agent/` — 项目级（最高优先）
2. `~/.pi/agent/agents/<name>.agent/` — 全局级
3. `agent-manager/agents/<name>.agent/` — 内建

## 工具白名单建议

| Agent 类型 | 推荐工具 |
|:---|:---|
| 纯创作型（设计、写作） | `write`, `edit`, `read` |
| 运维型（服务管理） | `read`, `bash`, `write`, `edit` |
| 分析型（审查、调试） | `read`, `bash` |
| 执行型（编码、构建） | `read`, `write`, `edit`, `bash` |
