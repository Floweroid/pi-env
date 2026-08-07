# pi-env — Pi 配置中心

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

一个系统化的 [Pi Coding Agent](https://pi.dev) 环境管理方案 — 按 OS 分类，而非按设备。

## 为什么不是 dotfiles？

社区常见的 `pi-dotfiles` 做法是直接把 `~/.pi/agent/` 镜像到 Git。这在单设备场景下可以，但：

- **多设备管理**：台式机、笔记本、Termux、WSL — 真的需要每台一份配置吗？
- **答案是不需要** — 同一 OS 下配置完全同构。唯一需要区分的是 **Linux** 和 **Windows**。
- **多项目管理**：不同项目需要不同的 agent 上下文和扩展组合
- **扩展迭代**：安全地从开发 → 测试 → 稳定发布
- **磁盘分离**：SSD 系统盘和 HDD 数据盘的配置/运行时分离

## 核心理念

```
┌─────────────────────────────────────────────┐
│               /data/pi-env/                  │
│  Git 管理 · 唯一配置源 · 按 OS 分类           │
├──────────┬──────────┬──────────┬────────────┤
│  linux/  │ windows/ │ staging/ │  scripts/  │
│ Linux配置 │ Win配置  │ 发布快照  │  管理工具   │
└──────────┴──────────┴──────────┴────────────┘
        │
  软链接 │  ~/.pi/agent → /data/pi-env/linux/
        ▼
  pi 直接读取（Termux、WSL、Desktop 通用）
```

## 快速开始

### 1. 克隆本仓库

```bash
git clone https://github.com/<your-username>/pi-env.git /data/pi-env
```

### 2. 建立软链接

```bash
# Linux（Desktop / Termux / WSL 通用）
/data/pi-env/scripts/link-local.sh --os linux

# Windows（Git Bash）
/data/pi-env/scripts/link-local.sh --os windows
```

### 3. 配置认证

```bash
cp /data/pi-env/linux/config/auth.json.example /data/pi-env/linux/config/auth.json
# 编辑 auth.json，填入你的 API key
```

### 4. 创建运行时目录

```bash
mkdir -p /data/pi-work/sessions
ln -sfn /data/pi-work/sessions /data/pi-env/linux/sessions
```

## 目录结构

```
pi-env/
├── README.md
├── SYNC-RULES.md              # 同步安全铁律（LLM 必读）
├── .gitignore
├── linux/                    # Linux 通用配置
│   ├── extensions/           # 自定义扩展
│   │   ├── agent-manager/    # Agent 管理核心
│   │   ├── subagent/         # 子进程 agent 委托
│   │   ├── tool-result-guard/# 工具结果保护
│   │   ├── planning/         # 任务计划管理
│   │   ├── web-fetch/        # URL 内容获取
│   │   ├── async-tasks/      # 异步任务管理
│   │   └── *.ts              # 单文件扩展
│   ├── agents/               # Agent 定义模板
│   │   ├── agent-maker.agent/
│   │   └── pi-env.agent/
│   └── config/               # 示例配置
│       ├── settings.example.json
│       └── auth.json.example
├── windows/                  # Windows 适配（按需补充）
│   └── .gitkeep
├── scripts/                  # 管理工具
│   ├── sync-to-device.sh     # 无损同步（幂等只增不删）
│   ├── export.sh             # 导出配置供同步
│   ├── import.sh             # 导入其他设备配置快照
│   ├── link-local.sh         # 建立/恢复本机软链接
│   └── publish-from-exp.sh   # 发布扩展到稳定版
├── staging/                  # 发布快照（git 可回溯）
├── docs/
│   └── architecture.md       # 架构说明
└── projects/                 # 项目级配置（可选）
```

## 管理脚本

### sync-to-device.sh — 无损同步配置

> 同步配置到本机的**唯一安全入口**，LLM 执行同步必须调用此脚本（见 [SYNC-RULES.md](./SYNC-RULES.md)）。
> 幂等 · 只增不删 · 硬排除 auth.json / trust.json / models-store.json / sessions/ 等本地数据。

```bash
# 同步 linux → ~/.pi/agent
/data/pi-env/scripts/sync-to-device.sh

# 预览（不实际写入）
/data/pi-env/scripts/sync-to-device.sh --dry-run

# 指定 OS
/data/pi-env/scripts/sync-to-device.sh --os windows
```

### export.sh — 导出配置

```bash
# 导出 Linux 配置
/data/pi-env/scripts/export.sh --os linux pi-linux.tar.gz

# SSH 直传（目标设备执行）
ssh user@<server> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/
```

### import.sh — 导入快照

```bash
/data/pi-env/scripts/import.sh /path/to/config.tar.gz --os linux
```

### link-local.sh — 恢复软链接

```bash
/data/pi-env/scripts/link-local.sh --os linux
```

### publish-from-exp.sh — 发布扩展

```bash
# 发布到 Linux
/data/pi-env/scripts/publish-from-exp.sh agent-manager

# 发布到 Windows
/data/pi-env/scripts/publish-from-exp.sh agent-manager --os windows
```

## 扩展生命周期

```
开发阶段：修改插件 → 测试（仅影响开发项目）
  ↓
 publish-from-exp.sh <name> [--os linux|windows]
  ↓                    ↓
staging 快照       linux/extensions/<name>/
```

## 为什么只分 Linux 和 Windows？

Pi 配置文件（settings.json、auth.json、extensions 源码）在同一 OS 下完全通用：

- **Linux Desktop** = **Termux (Android)** = **WSL** = **树莓派** — 同一套
- **Windows** — 路径语法、shell、可用工具不同，需单独适配

多设备同步只需 `export.sh --os linux`，所有 Linux 设备拉取同一份。

## Git 管理

```bash
cd /data/pi-env
git status
git add -A
git commit -m "feat: 描述"
git push
```

## 安全

**绝不提交到 Git：**
- `auth.json` — API 密钥
- `sessions/` — 会话历史
- `node_modules/` — 第三方依赖
- `trust.json` — 设备信任配置

本仓库仅包含示例模板，不含真实密钥。

## 许可

MIT
