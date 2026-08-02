## 桌面环境与桌面自动化

### 本机桌面环境

| 项目 | 详情 |
|------|------|
| **桌面** | XFCE |
| **显示协议** | X11（`$DISPLAY=:0.0`） |
| **无障碍** | AT-SPI2（`at-spi-bus-launcher` + `at-spi2-registryd` 运行中） |
| **D-Bus** | `unix:path=/run/user/1000/bus` |
| **显示管理器** | LightDM（`graphical.target`） |

> 虽然基于 Ubuntu Server 安装，但实际运行了完整的 XFCE 桌面环境，支持图形界面操作和桌面自动化。

### 关键依赖状态

```bash
# AT-SPI2 是否运行
pgrep -a at-spi          # at-spi-bus-launcher + at-spi2-registryd

# 桌面会话确认
echo $XDG_CURRENT_DESKTOP  # XFCE
echo $XDG_SESSION_TYPE     # x11
echo $DISPLAY              # :0.0
```

### 与桌面相关的 Pi 插件

| 插件 | 包名 | 说明 | 安装状态 |
|------|------|------|:--:|
| **pi-computer-use** | `@injaneity/pi-computer-use` | 操控桌面应用（点击/输入/截图），支持 macOS/Win/Linux，1.6k ⭐ | ❌ 未安装 |
| **pi-agent-browser-native** | `pi-agent-browser-native` | 浏览器自动化，13.2K/mo | ❌ 未安装 |
| **pire-browser** | `pire-browser` | Firefox 桥接浏览器自动化 | ❌ 未安装 |
| **@narumitw/pi-chrome-devtools** | `@narumitw/pi-chrome-devtools` | Chrome DevTools Protocol 集成 | ❌ 未安装 |

### pi-computer-use 详情

- **仓库：** [github.com/injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use)
- **许可：** MIT
- **语言：** Rust（原生 helper）+ TypeScript（pi 扩展）
- **安装：** `pi install npm:@injaneity/pi-computer-use`

**核心工具（8 个）：**
| 工具 | 用途 |
|------|------|
| `find_roots` | 发现桌面窗口和浏览器页面 |
| `observe_ui` | 捕获窗口 UI 树结构 + stateId |
| `search_ui` | 搜索界面中的文本/按钮/控件 |
| `expand_ui` | 展开某个 UI 节点的局部上下文 |
| `inspect_ui` | 查看节点字段、坐标、可用操作 |
| `act_ui` | 执行点击/输入/滚动/按键（支持事务） |
| `read_text` | 读取节点文本 |
| `wait_for` | 等待 UI 条件满足 |

**浏览器工具（3 个）：** `launch_browser`、`navigate_browser`、`evaluate_browser`

**Linux 要求：** X11 图形会话 + AT-SPI2（本机均满足 ✅）

### 开发与测试后的特别提示

本机虽是 XFCE 桌面，但 pi-computer-use 的某些操作（如坐标点击）在 X11 下需 XTEST 支持。如果需要 headless 策略（不抢焦点/不移动鼠标），功能会受限——仅支持语义操作（AT-SPI2），不支持截图和物理输入。
