# agent-core — 共享 Agent 扫描器

> 单文件共享库（`scanner.ts`）——**不是独立扩展**，被 agent-manager 和 subagent 通过相对路径引用。

## 定位

多个扩展都需要「扫描 agent 文件 + 解析定义」。为避免重复实现，抽成共享模块：

- **agent-manager**：扫描三来源 agent，用于 `/agent` 切换
- **subagent**：扫描 agent，用于子任务委托时选择目标

## 核心 API

### `scanAgentDir(dir, source, filter?)`

扫描单个目录下的 agent `.md` 文件：

- 只认 `.md` 后缀（文件或符号链接）
- 解析 YAML frontmatter：`name` / `description` / `tools` / `model`
- 目录不存在或不可读 → 返回空数组（容错）
- 可选 filter 过滤 profile

```typescript
interface AgentProfile {
  name: string;
  description?: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: AgentSource;        // "user" | "project"
  filePath: string;
}
```

## 设计要点

| 决策 | 理由 |
|------|------|
| 纯函数式单 API | 一个入口扫描，各扩展按需过滤 |
| 目录缺失容错 | 项目没有 .pi/agents 时不报错 |
| frontmatter 解析复用官方 API | 与 Pi 的 agent 格式完全兼容 |
| 非扩展（无注册入口） | 只做共享库，不重复加载 |
