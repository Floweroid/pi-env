# 快速上手

按场景选择：**单机 Linux**（最常见）→ **多设备**（进阶）→ **Windows**（特殊）。

---

## 场景 A：单机 Linux（Desktop / WSL / Termux / 树莓派）

### 1. 克隆仓库到数据盘

```bash
git clone https://github.com/Floweroid/pi-env.git /data/pi-env
```

> 为什么是 `/data/pi-env`？配置中心建议放在独立数据分区，避免重装系统丢失，也与运行时（sessions）物理分离。

### 2. 建立软链接

```bash
/data/pi-env/scripts/link-local.sh --os linux
```

执行后 `~/.pi/agent → /data/pi-env/linux/`，Pi 直接读取配置。

### 3. 配置认证

```bash
cp /data/pi-env/linux/config/auth.json.example /data/pi-env/linux/config/auth.json
# 编辑 auth.json，填入你的 API key
```

> ⚠️ auth.json 已被 .gitignore 硬排除，不会进入 Git。见 [security.md](security.md)。

### 4. 创建运行时目录

```bash
mkdir -p /data/pi-work/sessions
ln -sfn /data/pi-work/sessions /data/pi-env/linux/sessions
```

### 5. 验证

```bash
ls -la ~/.pi/agent          # 应显示软链接指向 /data/pi-env/linux/
pi                          # 启动 Pi，检查 planning Overlay / 扩展是否生效
```

---

## 场景 B：多设备同步（Linux 家族）

同一 OS 下配置完全同构，同步 = 拉取同一份，不是逐台维护。

### 从本机导出

```bash
/data/pi-env/scripts/export.sh --os linux pi-linux.tar.gz
```

### 目标设备拉取（SSH 直传）

```bash
ssh user@<server> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/
```

### 反向导入（把设备上的改动收回来）

```bash
ssh user@<device> "tar czf - -C ~/.pi/agent ." | \
  /data/pi-env/scripts/import.sh --os linux
```

### 完整同步（本机配置 → 本机 ~/.pi/agent）

```bash
/data/pi-env/scripts/sync-to-device.sh          # 实际写入
/data/pi-env/scripts/sync-to-device.sh --dry-run  # 仅预览
```

> ⚠️ **LLM 执行同步必须调用 `sync-to-device.sh`**，禁止手写 cp/rsync 自由发挥。完整规则见仓库根 [SYNC-RULES.md](../../SYNC-RULES.md) 与 [security.md](security.md)。

---

## 场景 C：Windows（Git Bash）

Windows 与 Linux 的路径语法、shell、可用工具不同，需单独适配。

```bash
git clone https://github.com/Floweroid/pi-env.git /d/pi-env   # 或你的数据盘路径

# 建立软链接（Git Bash 中运行，需管理员权限）
/data/pi-env/scripts/link-local.sh --os windows
```

> Windows 适配仍在演进中。若遇路径或换行问题，参考 [sync.md](sync.md) 与 [development.md](development.md) 的适配说明。

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 软链接建立失败（权限） | Git Bash 需以管理员运行；Termux 需 `termux-setup-storage` 授权 |
| 扩展不生效 | 检查 `~/.pi/agent/extensions/` 软链接指向；Pi 需重启会话加载扩展 |
| 同步后配置被覆盖 | sync 幂等只增不删，被硬排除的文件不会动；先 `--dry-run` 预览 |
| 想要实验性扩展 | 开发扩展放 `~/proj/pi-exp/.pi/extensions/`，稳定后再 publish，见 [development.md](development.md) |

---

## 下一步

- 理解配置中心架构 → [architecture.md](architecture.md)
- 逐个了解扩展 → [extensions/](extensions/)
- 理解安全边界 → [security.md](security.md)
