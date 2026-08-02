## Pi 官方资源与本地路径

### 官方资源

| 资源 | 链接 |
|------|------|
| 🌐 **官网** | [https://pi.dev](https://pi.dev) |
| 📦 **npm 包** | [https://www.npmjs.com/package/@earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) |
| 🐙 **GitHub 仓库** | [https://github.com/earendil-works/pi](https://github.com/earendil-works/pi) |
| 🐛 **Issue 追踪** | [https://github.com/earendil-works/pi/issues](https://github.com/earendil-works/pi/issues) |
| 💬 **Discord 社区** | [https://discord.com/invite/3cU7Bz4UPx](https://discord.com/invite/3cU7Bz4UPx) |
| 📥 **安装脚本** | `curl -fsSL https://pi.dev/install.sh \| sh` |
| 📄 **CHANGELOG** | `/usr/lib/node_modules/@earendil-works/pi-coding-agent/CHANGELOG.md` |

### 本地文档（30+ 篇）

所有文档在 `/usr/lib/node_modules/@earendil-works/pi-coding-agent/docs/`：

| 文档 | 说明 |
|------|------|
| `index.md` | 文档索引首页 |
| `quickstart.md` | 快速开始 |
| `usage.md` | 基础用法 |
| `settings.md` | 配置说明 |
| `extensions.md` | 扩展开发 |
| `packages.md` | 包管理 |
| `skills.md` | 技能系统 |
| `prompt-templates.md` | 提示模板 |
| `themes.md` | 主题定制 |
| `keybindings.md` | 快捷键配置 |
| `providers.md` | 提供商配置 |
| `models.md` | 模型管理 |
| `custom-provider.md` | 自定义提供商 |
| `sessions.md` | 会话管理 |
| `session-format.md` | 会话文件格式 |
| `security.md` | 安全指南 |
| `development.md` | 开发指南 |
| `termux.md` | Termux (Android) 配置 |
| `tmux.md` | tmux 集成 |
| `terminal-setup.md` | 终端设置 |
| `shell-aliases.md` | Shell 别名 |
| `windows.md` | Windows 配置 |
| `containerization.md` | 容器化部署 |
| `compaction.md` | 上下文压缩 |
| `rpc.md` | RPC 模式 |
| `sdk.md` | SDK 集成 |
| `json.md` | JSON 输出模式 |
| `tui.md` | TUI 界面 |
| `images/` | 文档图片 |

### 本地安装路径

| 路径 | 说明 |
|------|------|
| `/usr/bin/pi` | 可执行文件（symlink → `../lib/node_modules/.../dist/cli.js`） |
| `/usr/lib/node_modules/@earendil-works/pi-coding-agent/` | 包根目录（169MB） |
| `/usr/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js` | CLI 入口 |
| `/usr/lib/node_modules/@earendil-works/pi-coding-agent/docs/` | 离线文档 |
| `/usr/lib/node_modules/@earendil-works/pi-coding-agent/examples/` | 80+ 扩展示例 |

### 插件市场

| 资源 | 链接 |
|------|------|
| 🛒 **官方插件目录** | [https://pi.dev/packages](https://pi.dev/packages)（5400+ 包） |
| 🔍 **搜索方式** | `pi install npm:<包名>` 或浏览器访问 pi.dev/packages |

插件类型：extension（扩展）、skill（技能）、prompt（提示模板）、theme（主题）

安装示例：
```bash
pi install npm:@injaneity/pi-computer-use   # 桌面自动化
pi install npm:pi-web-access                # 网页搜索/抓取
pi install npm:@narumitw/pi-lsp             # LSP 集成
```

### 当前版本

- **pi v0.80.10**（npm 全局安装）
- 默认 provider：deepseek / deepseek-v4-flash
- 默认 model：`deepseek-v4-flash`
- 备用 model：`deepseek-v4-pro`

### pi 命令速查

| 命令 | 说明 |
|------|------|
| `pi --help` | 查看所有选项 |
| `pi install <source> [-l]` | 安装扩展 |
| `pi remove <source> [-l]` | 移除扩展 |
| `pi update [source\|self\|pi]` | 更新 pi 或扩展 |
| `pi list` | 列出已安装扩展 |
| `pi config [-l]` | 启用/禁用扩展资源 |
| `pi -p <prompt>` | 非交互模式 |
| `pi -c` | 继续上次会话 |
| `pi --session <path>` | 指定会话文件 |
| `pi --fork <path>` | 派分会话 |
