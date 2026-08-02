## Pi 配置中心架构

### 核心理念

`/data/pi-env/` 作为 HDD 唯一配置源，本机通过软链接引用，其他设备通过 SSH 拉取。

```
/data/                 ← HDD（独立数据盘）
├── pi-env/            ← Pi 配置中心（Git 管理配置）
│   ├── linux/         ← Linux 通用配置（Desktop/Termux/WSL）
│   ├── windows/       ← Windows 适配
│   ├── projects/      ← 各项目 .pi/ 实体
│   ├── staging/       ← 实验中待发布的扩展
│   ├── archive/       ← 其他设备导入的快照
│   ├── scripts/       ← 管理脚本
│   ├── .git/          ← Git 仓库
│   └── README.md
└── pi-work/           ← 运行时数据（无 Git）
    └── sessions/      ← 会话历史
```

### 物理分离原则

| 类型 | 目录 | Git | 内容 |
|------|------|:---:|------|
| 配置 | `linux/` | ✅ | settings、auth、extensions 源码 |
| 运行时 | `/data/pi-work/` | ❌ | sessions、node_modules |

### 本机软链接拓扑

```
~/.pi/agent .......................... → /data/pi-env/linux/   (实体)
  ├── settings.json ................... → /data/pi-env/linux/settings.json
  ├── auth.json ....................... → /data/pi-env/linux/auth.json
  ├── models-store.json .............. → /data/pi-env/linux/models-store.json
  ├── trust.json ...................... → /data/pi-env/linux/trust.json
  ├── sessions/ ....................... → 🔗 /data/pi-work/sessions/     (运行时分离)
  ├── extensions/ ..................... → /data/pi-env/linux/extensions/
  │   ├── planning/ ................... → 实体拷贝（源：/data/repos/planning-plugin/）
  │   ├── web-fetch/ .................. → 实体（含 node_modules，.gitignore 排除）
  │   ├── subagent/ ................... → 实体
  │   └── *.ts ........................ → 实体
  └── selectable-agents.bak/ ......... → /data/pi-env/linux/selectable-agents.bak/

proj/mana/.pi ........................ → /data/pi-env/projects/mana/
  └── extensions/
      ├── agent-manager ............... ~~已删除（已被全局稳定版替代）~~
      └── tool-result-guard ........... ~~已删除（已被全局稳定版替代）~~

proj/pi-exp/.pi ...................... → /data/pi-env/projects/pi-exp/
proj/本地服务器/.pi .................. → /data/pi-env/projects/本地服务器/
```

### 磁盘分配

| 磁盘 | 类型 | 挂载点 | 容量 | 空闲 | 用途 |
|------|------|--------|------|------|------|
| /dev/sdX | SSD | / | — | — | 系统 + 临时文件 |
| /dev/sdY | HDD | /data | — | — | pi 配置、项目数据、备份 |

### 备份

- 迁移前备份：`~/.pi/agent.bak-20260725`（完整原始配置）
- 软链接恢复脚本：`/data/pi-env/scripts/link-local.sh`
- 推荐定期打包：`tar czf /data/backups/pi-env-$(date +%Y%m%d).tar.gz -C /data pi-env/`
