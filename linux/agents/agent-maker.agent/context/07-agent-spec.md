# Agent 规范 v2.1 — 注册与发现

## 目录约定

```
<source>/agents/
└── <name>.agent/          ← 目录名以 .agent 结尾
    ├── agent.md           ← 必须存在：YAML frontmatter + body
    └── context/           ← 可选：参考文档，.md 自动注入 LLM
```

## agent.md 格式

```markdown
---
name: my-agent
description: 简短描述（必填）
tools: read, write, edit, bash   # 逗号分隔，可选
model: claude-sonnet-4-20250514  # 指定模型，可选
global: true                     # 导出到全局，可选
---

正文内容 = system prompt。
frontmatter 之后的所有内容作为 system prompt 注入。
```

### frontmatter 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | agent 标识（调用时使用），不写则用目录名 |
| `description` | string | tool 说明中展示 |
| `tools` | string | 逗号分隔的白名单，如 `read, write, bash` |
| `model` | string | 模型 ID，不写则使用会话默认 |
| `global` | bool | 元数据标签，不影响发现逻辑 |

## context/ 注入机制

`context/` 下的 `.md` 文件通过 `before_provider_request` 事件注入到每次 LLM 请求的系统提示词末尾。

- 注入内容截断于 `CONTEXT_MARKER`（`<!-- agent-context -->`）之后
- 单次最大注入 15KB（`MAX_CONTEXT_BYTES`）
- 仅在活跃 agent 有 `hasContext=true` 时注入

## 三来源发现

| 来源 | 路径 | 优先级 |
|------|------|:--:|
| builtin | `~/.pi/agent/extensions/agent-manager/agents/` | 最低 |
| global | `~/.pi/agent/agents/` | 中 |
| project | `<cwd>/.pi/agents/` | 最高 |

同名 agent → 高优先级覆盖低优先级。

## 注册步骤

1. 在项目或全局 agents 目录创建 `<name>.agent/`
2. 写入 `agent.md` 和 `context/`（可选）
3. **重启 pi**（`/reload` 不够，需完整退出重进）
4. 子代理调用：`subagent(agent="<name>", task="...")`

## 子代理隔离

- spawn 时通过 `PI_ACTIVE_AGENT=<name>` 环境变量传递
- agent-manager `session_start` 检测后跳过父会话恢复，加载目标 agent 的 prompt + context
- 不依赖 `--append-system-prompt` 或临时文件

## 注意事项

- 新 agent 目录需 pi **完全重启**才能被发现（scanner 在 `session_start` 运行）
- `frontmatter.global` 是元数据标签，不影响扫描——agent 存在于 global 目录即全局可用
- `tools` 白名单如果为空或省略，子代理继承全部工具
- context/ 文件名无特定顺序要求，按文件系统返回顺序排列
