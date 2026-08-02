## 扩展生命周期

### 扩展存放位置

| 阶段 | 路径 | 说明 |
|------|------|------|
| 🔬 **开发** | `/home/user/proj/pi-exp/.pi/extensions/` | 开发中的插件，可任意修改测试 |
| 📦 **快照** | `/data/pi-env/staging/<日期>/` | 最近一次发布的快照（历史回 git） |
| ✅ **稳定** | `/data/pi-env/linux/extensions/` | Linux 已安装的稳定版本 |
| 🔗 **项目引用** | `.pi/extensions/<name>` | ~~项目级软链接（已清理，被全局版替代）~~ |

### 工作流

```
开发阶段：
  修改 pi-exp/.pi/extensions/<name>/
  → 测试功能
  → 如果出错，只影响当前开发项目（通过 symlink 引用）

发布阶段：
  publish-from-exp.sh <name>
  → 覆盖 staging/<日期>/<name>/ 快照
  → 覆盖 agent/extensions/<name>/
  → 历史版本通过 git 回溯

使用阶段：
  pi 加载 ~/.pi/agent/extensions/<name>/
  → 即 /data/pi-env/linux/extensions/<name>/
  → 所有项目共享稳定版
```

### 当前已发布的稳定扩展

`/data/pi-env/linux/extensions/` 中的扩展：

| 扩展 | pi-exp 副本 | 发布方式 |
|------|:--:|------|
| agent-manager | ✅ | `publish-from-exp.sh agent-manager` |
| subagent | ❌ | 手动 cp 到 staging + git commit（无 pi-exp 副本，以 dell 为源） |

| 扩展 | 类型 | 大小 | 说明 |
|------|------|------|------|
| `agent-manager` | 目录 | - | agent 管理核心 |
| `subagent` | 目录 | - | 子进程 agent 委托 |
| `web-fetch` | 目录 | ~17MB（含 node_modules） | URL 内容获取 |
| `agent-core` | 目录 | 5KB | agent scanner（保留兼容） |
| `planning` | 目录 | - | 任务计划管理（实体拷贝自 /data/repos/planning-plugin/） |
| `zh-tools.ts` | 单文件 | 14KB | 中文工具提示 |
| `zh-compaction.ts` | 单文件 | 12KB | 中文会话压缩 |
| `async-tasks.ts` | 单文件 | 11KB | 异步任务 |
| `auto-name.ts` | 单文件 | 12KB | 自动命名会话 |
| `context-rules.ts` | 单文件 | 2KB | 注入 .pi/rules.md |
| `embed-guard.ts` | 单文件 | 12KB | 嵌入安全防护 |
| `intercom-style.ts` | 单文件 | 5KB | 交互风格调整 |
| `permission-gate.ts` | 单文件 | 7KB | 权限门控 |
| `reload-notify.ts` | 单文件 | 1KB | 重载通知 |
| `timestamp.ts` | 单文件 | 3KB | 消息时间戳 |
| `tool-result-guard` | 目录 | - | 工具结果保护 |

### 项目级扩展

`/data/pi-env/projects/mana/extensions/`：

| 扩展 | 目标 |
|------|------|
| ~~`agent-manager`~~ | ~~🔗 → `~/proj/pi-exp/.pi/extensions/agent-manager`（已删除，被全局版替代）~~ |
| ~~`tool-result-guard`~~ | ~~🔗 → `~/proj/pi-exp/.pi/extensions/tool-result-guard`（已删除，被全局版替代）~~ |

> ~~项目级扩展已清理，因为两个扩展已发布到全局稳定版。~~
