# 安全设计

> pi-env 把「Agent 运作安全」作为设计约束，而非事后补丁。本文覆盖：凭证隔离、同步铁律、运行时防护、扩展边界。

## 1. 凭证隔离（第一原则）

**敏感数据绝不进入 Git。**

```gitignore
# === 敏感信息 ===
auth.json            # API 密钥
trust.json           # 设备信任配置
models-store.json    # 模型缓存（含本地路径）
*.key / *.pem / .env # 密钥与环境变量
```

- 仓库只包含**示例模板**（`auth.json.example` / `settings.example.json`），不含真实密钥
- 快速开始要求用户复制模板后手动填入
- 即使仓库被 fork / 公开，凭据也不会泄露

## 2. 运行时数据分离

| 类型 | 目录 | Git | 内容 |
|------|------|:---:|------|
| 配置 | `linux/` / `windows/` | ✅ | extensions、agents、config |
| 运行时 | `/data/pi-work/` | ❌ | sessions（会话历史）、node_modules |

- 会话历史包含对话内容，**不纳入版本控制**
- `link-local.sh` 自动把 `sessions/` 软链接到数据盘运行时目录

## 3. 同步铁律（SYNC-RULES）

Agent 管理自己的配置时，**禁止自由发挥**——所有同步必须走唯一安全入口：

```
sync-to-device.sh
  ├── 幂等：重复执行结果一致
  ├── 只增不删：不删除目标已有文件
  ├── 硬排除：auth.json / trust.json / models-store.json / sessions/ 永不触碰
  └── --dry-run：先预览再执行
```

> ⚠️ **状态说明**：`SYNC-RULES.md` 与 `sync-to-device.sh` 当前在仓库中缺失（README 已承诺该机制），见 [roadmap.md](roadmap.md) 的补齐计划。

## 4. 扩展层安全防护

### permission-gate — 危险操作最后一道闸

- 默认 `warn` 模式：拦截 `rm -rf`、`sudo`、`curl | sh`、`dd if=`、`drop database`、`git push --force` 等危险命令
- 敏感路径保护：`.env`、`/etc/`、`.ssh/`、`id_rsa`、`.git/config` 等
- `strict` 模式：所有修改类工具都需确认

详见 [extensions/permission-gate.md](extensions/permission-gate.md)。

### web-fetch — 防 SSRF

- 内网 IP 黑名单：Agent 不能访问内网资源
- HTTP 自动升级 HTTPS

详见 [extensions/web-fetch.md](extensions/web-fetch.md)。

### subagent — 子进程隔离

- 独立 `pi` 进程 + `--no-extensions --tools` 工具遮蔽
- 项目级 agent 定义**默认需确认**后才执行（防项目仓库塞入恶意 agent）
- detached 进程隔离，崩溃不影响主会话

详见 [extensions/subagent.md](extensions/subagent.md)。

### agent-manager — 项目级覆盖

- 项目 `.pi/agents/` 可覆盖全局 agent，但工具集/模型随 agent 绑定
- 切换 agent 即切换能力边界

详见 [extensions/agent-manager.md](extensions/agent-manager.md)。

## 5. 发布安全（扩展生命周期）

```
开发（pi-exp，隔离） → staging 快照（git 可回溯） → 稳定（分发）
```

- 实验代码**不直接进**分发目录，先快照再发布
- staging 每日快照，出问题可回滚
- 见 [development.md](development.md) 发布流程

## 6. 威胁模型总结

| 威胁 | 防线 |
|------|------|
| 仓库泄露凭据 | .gitignore 硬排除 + 仅示例模板 |
| Agent 误执行危险命令 | permission-gate（warn/strict） |
| Agent 访问内网 | web-fetch 内网黑名单 |
| 恶意项目 agent 定义 | subagent confirmProjectAgents |
| 会话数据泄露 | sessions/ 不入库，运行时物理分离 |
| 实验代码污染生产 | staging 快照 + 发布流程 |
| 同步误删配置 | 幂等只增不删 + --dry-run |
