# Pi 配置中心架构

## 核心理念

`/data/pi-env/` 作为独立磁盘的唯一配置源，本机通过软链接引用，其他设备通过 SSH 拉取同步。

配置按 **操作系统** 分类，而非按设备。因为同一 OS 下 pi 配置文件完全通用。

```
/data/pi-env/            ← 配置中心（Git 管理）
├── linux/               ← Linux 通用（Desktop / Termux / WSL / 树莓派）
│   ├── extensions/
│   ├── agents/
│   └── config/
├── windows/             ← Windows 适配
├── projects/            ← 各项目 .pi/ 实体
├── staging/             ← 实验中待发布的扩展快照
├── archive/             ← 其他设备导入的配置快照
├── scripts/             ← 管理脚本
└── .git/                ← Git 仓库
```

## 为什么不分设备？

| 文件 | Linux 设备间差异 | Win/Linux 间差异 |
|------|:--:|:--:|
| `settings.json` | 无 | 无 |
| `auth.json` | 无 | 无 |
| `extensions/` | 无 | 可能有（路径、shell） |
| `trust.json` | 路径不同（已排除 git） | 完全不同 |

**结论：同一 OS 内配置零差异。** Linux Desktop、Termux、WSL、树莓派共享同一份 `linux/` 配置。

## 物理分离原则

| 类型 | 目录 | Git | 内容 |
|------|------|:---:|------|
| 配置 | `linux/` / `windows/` | ✅ | extensions、agents、config |
| 运行时 | `/data/pi-work/` | ❌ | sessions、node_modules |

## 本机软链接拓扑

```
~/.pi/agent ............ → /data/pi-env/linux/
  ├── sessions/ ......... → 🔗 /data/pi-work/sessions/  (运行时分离)
  └── extensions/ ....... → 实体扩展

proj/<project>/.pi ..... → /data/pi-env/projects/<project>/
```

## 扩展生命周期

| 阶段 | 路径 | 说明 |
|------|------|------|
| 🔬 开发 | `~/proj/pi-exp/.pi/extensions/` | 开发中的插件 |
| 📦 快照 | `/data/pi-env/staging/<日期>/` | 发布快照（git 回溯） |
| ✅ 稳定 | `/data/pi-env/linux/extensions/` | Linux 稳定版本 |

## 多设备同步

```bash
# 从本机导出 Linux 配置
/data/pi-env/scripts/export.sh --os linux pi-linux.tar.gz

# 目标 Linux 设备拉取（Termux、WSL 等通用）
ssh user@<server> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/

# 反向导入
ssh user@<device> "tar czf - -C ~/.pi/agent ." | \
  /data/pi-env/scripts/import.sh --os linux

# Windows
/data/pi-env/scripts/export.sh --os windows pi-windows.tar.gz
```
