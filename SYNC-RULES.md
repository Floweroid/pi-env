# pi-env 同步安全规则（SYNC-RULES）

> **适用对象**：pi-agent（LLM）执行 pi-env 配置同步时的硬性约束。
> **核心原则**：同步必须**无损**——不删除、不覆盖设备本地数据，从根上不需要"备份-恢复"。

---

## 为什么没有"备份-恢复"环节？

跨会话的"先备份 → 再同步 → 后恢复"是脆弱设计：

- 备份与恢复不在同一原子操作内，会话一旦中断（断网 / 断电 / 超时），恢复永远不会执行，备份形同虚设
- 正确做法：**同步动作本身不破坏任何数据**，因此不存在"需要恢复"的场景

---

## 铁律（违反即失败）

1. **禁止破坏性同步**
   不得使用 `rm -rf`、rsync `--delete`、`git reset --hard`、`git checkout -- .`、覆盖式 `cp -r` 等会删除或清空目标内容的操作。

2. **本地数据硬排除**（永不同步、永不覆盖、永不删除）
   | 文件 | 原因 |
   |------|------|
   | `auth.json` | API 凭证，各设备不同 |
   | `trust.json` | 信任配置，各设备不同 |
   | `models-store.json` | 模型目录缓存，设备特定 |
   | `sessions/` | 会话历史，运行时数据 |
   | `*.key` / `*.pem` / `.env` | 密钥类 |

3. **幂等**
   重复执行结果一致。`auth.json` 已存在则**原样保留**；缺失时才从 `auth.json.example` 生成，并提示用户填写 key。

4. **优先调用脚本**
   执行同步必须调用 `scripts/sync-to-device.sh`，不得自行发明同步命令。

5. **会话中断零影响**
   同步脚本不含删除 / 覆盖本地数据的步骤，任意一步中断：已同步的模板到位，本地数据原封不动。

---

## 同步命令速查

```bash
# 标准同步（linux → ~/.pi/agent，幂等无损）
/data/pi-env/scripts/sync-to-device.sh

# 预览（不实际写入）
/data/pi-env/scripts/sync-to-device.sh --dry-run

# 指定 OS
/data/pi-env/scripts/sync-to-device.sh --os windows
```

---

## 场景对照

| 场景 | 正确做法 | 禁止 |
|------|---------|------|
| 新设备初始化 | clone 仓库 → 运行 sync-to-device.sh → 填 auth.json | 把仓库整体覆盖到 ~/.pi/agent |
| 更新配置 | 运行 sync-to-device.sh（幂等） | rsync --delete / 先删后放 |
| 已有本地数据 | 直接同步，auth.json / sessions 不受影响 | 先删 auth / session 再同步 |
| 会话中断 | 无影响，重跑脚本即可 | — |
