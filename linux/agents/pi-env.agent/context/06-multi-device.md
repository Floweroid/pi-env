## 多设备同步

### 支持的场景

| 设备 | 系统 | Pi 安装方式 | 同步方式 |
|------|------|-------------|---------|
| 本机 | Ubuntu 24.04 + XFCE (X11) | npm 全局安装 | 软链接到 `/data/pi-env/linux/` |
| 移动设备 | Termux (Android) | npm install | SSH 从本机拉取配置 |

### Termux 配置同步

**首次设置（在 Termux 上）：**
```bash
# 1. 安装 pi
npm install -g @earendil-works/pi-coding-agent

# 2. 创建 agent 目录
mkdir -p ~/.pi/agent

# 3. 从本机拉取配置
ssh user@<pi-server-ip> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/

# 4. 安装扩展依赖
cd ~/.pi/agent/extensions/web-fetch && npm install
```

**日常同步（在 Termux 上）：**
```bash
ssh user@<pi-server-ip> /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/
```

### 反向同步（从设备导入本机）

如果某台设备上修改了配置（如自定义快捷键），想导入本机：

```bash
# 在本机执行
ssh user@device "tar czf - -C ~/.pi/agent ." | /data/pi-env/scripts/import.sh --os nexus5
```

> 导入的配置会保存在 `/data/pi-env/archive/<OS 名>-<时间戳>/`，不上线到主配置。

### 注意事项

| 内容 | 是否同步 | 原因 |
|------|---------|------|
| `settings.json` | ✅ 同步 | 全局配置，所有设备共享 |
| `auth.json` | ✅ 同步 | API 密钥，每台设备都需要 |
| `models-store.json` | ✅ 同步 | 模型配置 |
| `extensions/` 源码 | ✅ 同步 | 扩展共享 |
| `sessions/` | ❌ 排除 | 设备独立，无需同步 |
| `node_modules/` | ❌ 排除 | 各自 npm install |
| `trust.json` | ❌ 排除 | 路径依赖，各设备不同 |
| `keybindings.json` | ✅ 同步（如存在） | 快捷键配置共享 |
| `SYSTEM.md` | ✅ 同步（如存在） | 系统提示词共享 |

### 网络连接检查

同步前确认网络和代理正常：

```bash
# 本机 IP
hostname -I

# 代理主机是否在线
ping -c 1 <proxy-ip>

# 代理端口是否可达
nc -zv <proxy-ip> 10809
```
