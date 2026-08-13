# pi-env — Pi Agent 插件工具链 & 环境管理

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

为 [Pi Coding Agent](https://pi.dev) 自建的核心插件工具链 + 多设备工程化配置方案——**不止是 dotfiles，是一套 Agent 工作台**。

```
8 个自研扩展 · 67 个 TypeScript 文件 · Linux / WSL / Termux / Windows
```

---

## ✨ 亮点

### 🧩 自研插件（触及 Agent 决策与执行核心）

| 扩展 | 解决什么 | 核心机制 |
|------|---------|---------|
| **planning** | 任务偏移——做着做着忘了计划 | 两阶段强制同步（计划先于执行）+ Overlay 可视化 + 依赖规则引擎 + 内联标记自动更新 |
| **subagent** | 单上下文装不下复杂任务 | 独立 `pi` 进程隔离上下文，single / parallel / chain 三模式全异步 |
| **agent-manager** | 多角色切换混乱 | `/agent` 切换 + 按 agent 注入 context / 工具白名单 / 模型 |
| **tool-result-guard** | 并行调用偶发 tool_result 丢失（400 错误） | 修复 pi 上游竞态 + 快照问题，静默补全 + 交互兜底 |
| **permission-gate** | Agent 误执行危险命令 | yolo / warn / strict 三档，拦截 `rm -rf`、`curl|sh`、敏感路径等 |
| **async-tasks** | 长任务阻塞会话 | 后台执行 + 完成自动注入结果 + peek / kill |
| **web-fetch** | Agent 没有网络能力 | 正文提取 → Markdown，SPA 渲染，内网 SSRF 拦截 |

> 完整文档见 [docs/extensions/](docs/extensions/)

### 🛠️ 工程化落地

- **按 OS 分类，而非按设备**：Linux Desktop = Termux = WSL = 树莓派，同一份配置
- **软链接 + 幂等同步**：`~/.pi/agent → /data/pi-env/linux/`，同步脚本幂等只增不删
- **扩展生命周期**：开发（pi-exp）→ staging 快照 → 稳定发布，实验代码不污染生产

### 🔐 安全设计

- **SYNC-RULES.md**：LLM 同步铁律——同步必须走唯一安全入口，禁止自由发挥
- **凭证硬隔离**：auth.json / trust.json / sessions/ 永不入 Git，仓库只含示例模板
- **运行时分离**：配置入 Git，会话历史留在数据盘

---

## 🖼️ 效果演示

> TODO：截图占位——planning Overlay 任务卡片 / 状态栏进度 / subagent 调用记录
> （终端右上角计划卡片、`📋 3/5 ⚡1` 状态栏，见 [docs/extensions/planning.md](docs/extensions/planning.md)）

---

## 📦 快速开始

### 单机（Linux / WSL / Termux / 树莓派）

```bash
git clone https://github.com/Floweroid/pi-env.git /data/pi-env

# 建立软链接：~/.pi/agent → /data/pi-env/linux/
/data/pi-env/scripts/link-local.sh --os linux

# 配置认证（模板不含真实密钥）
cp /data/pi-env/linux/config/auth.json.example /data/pi-env/linux/config/auth.json
# 编辑 auth.json，填入你的 API key
```

### 多设备同步

```bash
# 从本机导出
/data/pi-env/scripts/export.sh --os linux pi-linux.tar.gz

# 目标设备拉取（SSH 直传）
ssh user@<server> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/
```

### Windows（Git Bash）

```bash
/data/pi-env/scripts/link-local.sh --os windows
```

---

## 🗂️ 目录结构

```
pi-env/
├── linux/                    # Linux 通用配置（Desktop/Termux/WSL/树莓派）
│   ├── extensions/           # 8 个自研扩展
│   ├── agents/               # Agent 定义模板
│   └── config/               # 示例配置（settings / auth 模板）
├── windows/                  # Windows 适配
├── scripts/                  # link-local / export / import / publish-from-exp
├── staging/                  # 发布快照（git 可回溯）
├── docs/                     # 📚 文档中心
└── SYNC-RULES.md             # 同步安全铁律（LLM 必读）
```

---

## 📚 文档中心

| 文档 | 内容 |
|------|------|
| [docs/overview.md](docs/overview.md) | 项目总览：设计哲学、核心概念 |
| [docs/getting-started.md](docs/getting-started.md) | 快速上手：单机 / 多设备 / Windows |
| [docs/architecture.md](docs/architecture.md) | 配置中心架构 |
| [docs/extensions/](docs/extensions/) | 8 个扩展的逐个深度文档 |
| [docs/development.md](docs/development.md) | 扩展开发指南（ExtensionAPI / 事件钩子 / 发布） |
| [docs/security.md](docs/security.md) | 安全设计（凭证隔离 / 威胁模型） |
| [docs/sync.md](docs/sync.md) | 多设备同步机制 |
| [docs/roadmap.md](docs/roadmap.md) | 路线图（含 **DeepSeek Harness 适配计划**） |

---

## 🔐 安全

**绝不提交到 Git：**

- `auth.json` — API 密钥
- `sessions/` — 会话历史
- `node_modules/` — 第三方依赖
- `trust.json` — 设备信任配置

本仓库仅包含示例模板，不含真实密钥。完整安全模型见 [docs/security.md](docs/security.md)。

---

## 许可

MIT
