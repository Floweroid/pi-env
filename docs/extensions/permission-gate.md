# permission-gate — 权限门控

> 单文件扩展。给 Agent 的工具执行加**最后一道闸**。

## 三种模式

| 模式 | 行为 | 适用 |
|------|------|------|
| `yolo` | 全部放行 | 完全信任 / 演示场景 |
| `warn` | 仅拦截危险指令（**默认**） | 日常开发 |
| `strict` | 所有修改类工具都需确认 | 生产 / 敏感环境 |

命令：`/perm-mode <yolo|warn|strict>`

## 拦截规则

### 危险命令模式（warn/strict 生效）

| 类别 | 示例 |
|------|------|
| 删除 | `rm -rf`、`rmdir -`、`shred`、`truncate -s` |
| 提权 | `sudo`、`chmod/chown 777` |
| 格式化/磁盘 | `format`、`mkfs`、`fdisk`、`parted`、`dd if=`、`> /dev/sd*` |
| 数据库 | `drop database`、`DROP TABLE/DATABASE` |
| 网络/容器 | `git push --force`、`docker rm`、`kubectl delete` |
| 系统 | `shutdown -`、`reboot`、`halt`、`poweroff`、`iptables -F`、`kill -9 -1`、`chroot`、`mount/umount /dev/` |
| 管道执行 | `curl ... \| sh`、`curl ... \| sudo sh` |
| fork 炸弹 | `:(){ :|:& };:` |

### 敏感路径（warn/strict 生效）

| 类别 | 示例 |
|------|------|
| 环境变量 | `.env`、`.env.*` |
| 系统目录 | `/etc/`、`/boot/`、`/root/` |
| 密钥 | `.ssh/`、`.gnupg/`、`id_rsa` |
| 仓库配置 | `.git/config` |

## 设计要点

| 决策 | 理由 |
|------|------|
| 默认 warn 而非 yolo | 安全优先，但不过度打扰日常开发 |
| 模式可切换 | 同一套配置适配不同信任场景 |
| 正则匹配命令文本 | 零依赖、实现简单，覆盖绝大多数危险操作 |
