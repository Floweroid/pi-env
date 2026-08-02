## 管理脚本与工具

四个核心脚本在 `/data/pi-env/scripts/` 中，都有 `set -euo pipefail` 安全执行。

---

### 1️⃣ export.sh — 导出配置供其他设备使用

**用途：** 打包指定设备的配置，排除运行时数据，供其他设备使用。

**源目录：** `/data/pi-env/<os>/`（由 `--os` 参数指定，默认 `dell`）

**打包内容：** settings.json、auth.json、models-store.json、extensions 源码、bin/ 等

**默认排除：** sessions/、node_modules/（运行时数据在 `/data/pi-work/`）

**选项：**
- `--os <name>` 指定设备（默认 dell）
- `--full` 排除 sessions 和 node_modules

```bash
# 导出 Linux 配置到文件
/data/pi-env/scripts/export.sh --os dell pi-dell.tar.gz

# 导出完整的配置（含 sessions）
/data/pi-env/scripts/export.sh --os dell --full dell-full.tar.gz

# SSH 直传 Termux（在目标设备执行）
ssh user@<pi-server-ip> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/

**在目标设备上，拉取后需要额外执行：**
```bash
cd ~/.pi/agent/extensions/web-fetch && npm install  # 安装 node_modules
```

---

### 2️⃣ import.sh — 导入其他设备的配置快照

**用途：** 将其他设备（如 Termux）的配置导入本机存档。

```bash
# 从文件导入
/data/pi-env/scripts/import.sh /path/to/config.tar.gz --os nexus5

# SSH 直传（在本机执行）
ssh user@device "tar czf - -C ~/.pi/agent ." | /data/pi-env/scripts/import.sh --os nexus5
```

**导入位置：** `/data/pi-env/archive/<OS 名>-<时间戳>/`

---

### 3️⃣ link-local.sh — 建立/恢复本机软链接

**用途：** 为本机建立或恢复 pi 软链接（首次安装或修复）。

```bash
# 建立软链接
/data/pi-env/scripts/link-local.sh

# 仅建立 agent 软链接（内部逻辑）
ln -sf /data/pi-env/linux ~/.pi/agent

# 建立单个项目软链接（内部逻辑）
ln -sf /data/pi-env/projects/mana /home/user/proj/mana/.pi
```

**建立的软链接：**
| 目标 | 指向 |
|------|------|
| `~/.pi/agent` | `/data/pi-env/linux/` |
| `proj/mana/.pi` | `/data/pi-env/projects/mana/` |
| `proj/pi-exp/.pi` | `/data/pi-env/projects/pi-exp/` |
| `proj/本地服务器/.pi` | `/data/pi-env/projects/本地服务器/` |

---

### 4️⃣ publish-from-exp.sh — 发布稳定扩展

**用途：** 将 pi-exp 中开发完成的扩展发布到稳定目录。

```bash
# 发布单个扩展
/data/pi-env/scripts/publish-from-exp.sh agent-manager

# 发布所有扩展（谨慎使用）
/data/pi-env/scripts/publish-from-exp.sh --all
```

**流程：**
```
pi-exp/.pi/extensions/<name>
    ↓ cp -a （覆盖 staging 快照 → 覆盖稳定目录）
/data/pi-env/staging/<日期>/<name>   （最近发布快照）
/data/pi-env/linux/extensions/<name> ← Linux 稳定版
```

> 旧版不保留备份，历史通过 git 回溯。

**已知扩展：**
| 名称 | 类型 | 说明 |
|------|------|------|
| `agent-manager` | 目录 | agent 管理核心 |
| `tool-result-guard` | 目录 | 工具结果保护 |
| `context-loader` | 目录 | 上下文加载器 |
