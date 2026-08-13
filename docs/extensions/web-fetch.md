# web-fetch — URL 获取与 HTML→Markdown 转换

> 单文件扩展 + package.json。为 Pi 提供**网络访问能力**——抓取 URL 并转换为 Agent 可读的结构化文本。

## 能力清单

| 能力 | 说明 |
|------|------|
| HTTP→HTTPS 自动升级 | 统一走加密通道 |
| 正文提取 | `@mozilla/readability` + `linkedom`，**先提取正文再转换**，去掉导航/广告噪音 |
| HTML→Markdown | `turndown`（ATX 标题、fenced 代码块） |
| HTML→纯文本降级 | `htmlparser2`，Markdown 转换失败时兜底 |
| SPA 页面渲染 | `playwright` headless（`format: html` 或 `headless: true` 时启用），可抓 JS 渲染页面 |
| Cloudflare 机器人检测重试 | 被 CF 拦截时自动重试 |
| 图片类型检测 | 返回图片类型 + 大小信息（支持 base64） |
| 内网 IP 黑名单 | 拒绝内网地址，防 SSRF |
| TTL 缓存 | Map + TTL，相同 URL 15 分钟内不重复请求 |
| 内容截断 | 超 100K 字符自动截断 |
| 超时控制 | 默认 30s，最大 120s |

## 依赖（懒加载）

依赖只在**首次调用时导入**（`await import()`），避免拖慢 Pi 启动：

```
turndown              HTML → Markdown
@mozilla/readability  正文提取
linkedom              DOM 解析
htmlparser2           HTML → 纯文本降级
playwright            SPA headless 渲染（可选，未安装时自动跳过）
```

## 设计要点

| 决策 | 理由 |
|------|------|
| 先提取正文再转 Markdown | 网页噪音（导航/广告）不污染 Agent 上下文 |
| 懒加载依赖 | 启动零开销，用到才 import |
| 内网黑名单 | 防 SSRF——Agent 不应能访问内网资源 |
| SPA 渲染可开关 | 默认快（静态抓取），需要时再 headless |
| TTL 缓存 | 重复抓取同一 URL 不浪费 token |
