## FAQ — 常见问题

### Q1: `~/.pi/agent` 软链接断裂了怎么办？

**现象：** `ls ~/.pi/agent` 提示 No such file or directory，或显示为红色闪烁。

**原因：** `/data` 未挂载、软链接被误删或指向不存在的目录。

**修复：**
```bash
/data/pi-env/scripts/link-local.sh
```

脚本会自动重建 `~/.pi/agent` → `/data/pi-env/linux/` 以及各项目软链接。

---

### Q2: pi 启动时报错 `ENOENT: sessions 目录不存在`

**原因：** sessions 软链接（`linux/sessions` → `/data/pi-work/sessions/`）断裂，或 `/data/pi-work/sessions/` 不存在。

**修复：**
```bash
# 确保 /data/pi-work/sessions/ 存在
mkdir -p /data/pi-work/sessions

# 重建软链接
ln -sfn /data/pi-work/sessions /data/pi-env/linux/sessions
```

---

### Q3: 扩展修改后不生效？

**常见原因：**
1. 未 `/reload` — 修改扩展后需要执行 `/reload` 重新加载
2. 全局扩展和项目级扩展冲突 — 项目级 `.pi/extensions/` 的优先级高于全局
3. 语法错误 — 检查扩展文件是否有 TypeScript 报错

**排查：**
```bash
# 检查扩展文件位置
readlink -f ~/.pi/agent/extensions/<name>  # 确认设备路径
readlink -f .pi/extensions/<name>           # 确认项目路径
```

---

### Q4: 想回退 git 中的某个配置怎么办？

```bash
cd /data/pi-env

# 查看历史
git log --oneline

# 恢复到某个版本的某个文件
git checkout <commit-hash> -- linux/settings.json

# 或整体回退到上一个版本（谨慎）
git reset --soft HEAD~1
```

---

### Q5: `/data/pi-env/` 空间不够了？

```bash
# 查看大小分布
du -sh /data/pi-env/*/ | sort -rh

# 清理 sessions（运行时数据，请保留近期）
ls /data/pi-work/sessions/
rm -rf /data/pi-work/sessions/--旧的会话目录--

# 清理 staging
ls /data/pi-env/staging/
rm -rf /data/pi-env/staging/旧的日期目录/
```

空间主要来自：
- extensions/node_modules/（已被 .gitignore 排除）
- sessions/（在 /data/pi-work/，已分离）

---

### Q6: 如何新建一个设备？

```bash
# 1. 新建设备目录
mkdir -p /data/pi-env/devices/nexus5

# 2. 从现有设备复制基础配置
cp /data/pi-env/linux/settings.json /data/pi-env/devices/nexus5/
cp /data/pi-env/linux/auth.json /data/pi-env/devices/nexus5/
# ... 按需复制

# 3. 提交 git
cd /data/pi-env
git add devices/nexus5/
git commit -m "feat: 新建 nexus5 设备配置"
```

---

### Q7: `export.sh` 导出后目标设备上扩展不工作？

```bash
# 目标设备上需要安装扩展的 node_modules
cd ~/.pi/agent/extensions/web-fetch && npm install
```

`export.sh` 默认排除 `node_modules/`，需要各设备自行 `npm install`。

---

### Q8: 如何查看当前的 agent 详细信息？

```bash
# 查看 agent 列表
/agent list

# 项目级 agent 的 context 文件
ls .pi/agents/ops.agent/context/
ls .pi/agents/pi-env.agent/context/

# 内建 test agent
ls ~/.pi/agent/extensions/agent-manager/agents/
```

---

### Q9: 集群管理方案在哪？

社区讨论的设计文档：

```
/home/user/proj/mana/docs/pi-remote-cluster-management.md
```

涵盖：pi-remote SSH 扩展设计、主机清单、context 动态注入、集群巡检等。
状态：方案设计，未实现。
