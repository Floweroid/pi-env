# 多设备同步机制

> pi-env 的同步哲学：**按 OS 分类，而非按设备**。同一 OS 下配置完全同构，同步 = 拉取同一份。

## 为什么同一 OS 无需逐台维护

| 文件 | Linux 设备间差异 | Win/Linux 间差异 |
|------|:---:|:---:|
| `settings.json` | 无 | 无 |
| `auth.json` | 无 | 无 |
| `extensions/` | 无 | 可能有（路径、shell） |
| `trust.json` | 路径不同（已排除 git） | 完全不同 |

**结论**：Linux Desktop = Termux = WSL = 树莓派，共享同一份 `linux/` 配置；Windows 单独适配。

## 管理脚本总览

| 脚本 | 职责 | 方向 |
|------|------|------|
| `link-local.sh` | 为本机建立软链接（含备份旧目录） | 本机 |
| `export.sh` | 导出配置为 tar 包（排除运行时数据） | 本机 → 外部 |
| `import.sh` | 导入其他设备快照到 archive/（带时间戳） | 外部 → 本机 |
| `sync-to-device.sh` | 同步配置到本机 ~/.pi/agent（**唯一安全入口**） | 仓库 → 本机 |
| `publish-from-exp.sh` | 实验扩展发布到稳定目录 | 开发 → 生产 |

> ⚠️ `sync-to-device.sh` 当前在仓库中缺失（设计已定，见 [roadmap.md](roadmap.md) 补齐计划）。

## link-local.sh — 本机软链接

```bash
/data/pi-env/scripts/link-local.sh            # 自动检测 OS（默认 linux）
/data/pi-env/scripts/link-local.sh --os windows
```

行为：
- `~/.pi/agent → /data/pi-env/<os>/`
- `sessions/ → /data/pi-work/sessions/`（运行时分离）
- 已有真实目录时自动备份为 `.auto-bak`，不覆盖丢失
- 已正确时跳过（幂等）

## export.sh — 导出

```bash
# 本地保存
/data/pi-env/scripts/export.sh --os linux pi-linux.tar.gz

# SSH 直传（目标设备执行，一步到位）
ssh user@<server> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/

# 包含运行时数据（默认排除）
/data/pi-env/scripts/export.sh --os linux --full pi-full.tar.gz
```

默认排除：sessions、node_modules 等运行时数据（体积小、无敏感历史）。

## import.sh — 导入快照

```bash
# 从文件导入
/data/pi-env/scripts/import.sh /path/to/config.tar.gz --os linux

# 从 stdin
cat config.tar.gz | /data/pi-env/scripts/import.sh --os windows
```

行为：快照落到 `archive/<os>-<时间戳>/`，**不改动当前配置**，先存后审。

## publish-from-exp.sh — 扩展发布

```bash
/data/pi-env/scripts/publish-from-exp.sh agent-manager          # → linux
/data/pi-env/scripts/publish-from-exp.sh agent-manager --os windows
/data/pi-env/scripts/publish-from-exp.sh --all                  # 全部
```

流程：
```
~/proj/pi-exp/.pi/extensions/<name>   （开发）
  → staging/<日期>/<name>             （快照，git 可回溯）
  → <os>/extensions/<name>            （稳定）
```

## 同步安全规则（LLM 必读）

1. **唯一入口**：LLM 同步配置必须调用 `sync-to-device.sh`，禁止手写 cp/rsync
2. **先预览**：`--dry-run` 确认无误再实际执行
3. **幂等**：重复执行结果一致
4. **只增不删**：不删除目标已有文件
5. **硬排除**：auth.json / trust.json / models-store.json / sessions/ 永不触碰

## 典型流程

### 新增一台 Linux 设备

```bash
git clone https://github.com/Floweroid/pi-env.git /data/pi-env
/data/pi-env/scripts/link-local.sh --os linux
# 从已有设备拉配置
ssh user@<已有设备> /data/pi-env/scripts/export.sh --os linux | tar xz -C ~/.pi/agent/
cp /data/pi-env/linux/config/auth.json.example ~/.pi/agent/config/auth.json
# 填入 API key，完成
```

### 日常修改同步

```bash
# 本机开发机改了配置 → 同步到本机
/data/pi-env/scripts/sync-to-device.sh --dry-run
/data/pi-env/scripts/sync-to-device.sh

# 提交到 Git 中心
git add -A && git commit -m "feat: …" && git push
```

## 注意事项

| 场景 | 处理 |
|------|------|
| 软链接失败（权限） | Git Bash 需管理员；Termux 需 `termux-setup-storage` |
| 想保留设备差异 | 放在 `projects/` 项目级配置，不入通用 `linux/` |
| 实验性扩展 | 先 pi-exp 开发，稳定后 publish，见 [development.md](development.md) |
