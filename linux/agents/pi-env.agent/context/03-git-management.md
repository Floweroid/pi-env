## Git 管理

`/data/pi-env/` 是一个 git 仓库，管理配置文件的版本历史。

### 仓库信息

| 项目 | 说明 |
|------|------|
| 仓库路径 | `/data/pi-env/.git/` |
| 分支 | `master` |
| 首次提交 | 2026-07-25 — 初始化 pi 环境配置中心（77 文件） |
| 第二次提交 | 2026-07-25 — 更新上下文文件（25 文件） |

### .gitignore（排除项）

```
sessions/         # 运行数据，每台设备独立
trust.json        # 路径依赖，各设备不同
node_modules/     # 依赖包，各自 npm install
subagent-logs/    # 运行日志
archive/*         # 其他设备导入的快照
*.bak             # 备份文件
```

### 提交规范

```
<类型>: <简短描述>

<详细说明（可选）>
```

**类型：**
- `feat` — 新增配置或功能
- `update` — 更新现有配置
- `fix` — 修复错误
- `docs` — 文档修改
- `chore` — 日常维护

### 常用操作

```bash
# 查看状态
cd /data/pi-env && git status

# 查看历史
cd /data/pi-env && git log --oneline

# 查看某次变更
cd /data/pi-env && git show <commit-hash>

# 提交变更
cd /data/pi-env
git add -A
git commit -m "<类型>: <描述>"

# 查看未跟踪文件
cd /data/pi-env && git status --short
```

### 注意事项

- 不要在 pi-env 仓库中直接 `git push`（无远程仓库，仅本地版控）
- `auth.json`（API 密钥）在 git 中会被跟踪，注意不要误推
- `planning` 扩展原本是 git 子仓库，已移除其 `.git` 目录后作为普通文件管理
