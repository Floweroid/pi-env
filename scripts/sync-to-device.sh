#!/bin/bash
# ============================================================
# pi-env sync-to-device.sh — 无损同步 pi-env 配置到本机
#
# 设计原则：幂等 · 只增不删 · 本地数据物理隔离
#   - rsync 不带 --delete：目标端已有文件只增不删
#   - --exclude 硬排除设备本地数据：auth.json / trust.json /
#     models-store.json / sessions/ / *.key / *.pem / .env
#   - auth.json 幂等生成：已存在则原样保留，缺失才从 example 创建
#   - 无备份-恢复环节：同步本身不破坏任何本地数据，
#     会话中断（断网/断电/超时）不影响已同步内容与本地数据
#
# 用法：
#   ./sync-to-device.sh                # 同步 linux/ → ~/.pi/agent
#   ./sync-to-device.sh --os windows   # 同步 windows/
#   ./sync-to-device.sh --dry-run      # 预览（不实际写入）
#   PI_AGENT=/tmp/test ./sync-to-device.sh  # 自定义目标目录
# ============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OS="linux"
DRY_RUN=""
PI_AGENT="${PI_AGENT:-$HOME/.pi/agent}"

usage() {
  echo "用法: $0 [--os linux|windows] [--dry-run]" >&2
  echo "环境变量 PI_AGENT 可自定义目标目录" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --os) OS="${2:?}"; shift 2 ;;
    --dry-run) DRY_RUN="-n"; shift ;;
    *) usage ;;
  esac
done

SRC="$REPO_DIR/$OS"
if [ ! -d "$SRC" ]; then
  echo "错误: OS 目录 $SRC 不存在" >&2
  exit 1
fi

mkdir -p "$PI_AGENT"
echo "=== 无损同步 $SRC → $PI_AGENT ==="

# 1) 只增不删（无 --delete）+ 硬排除设备本地数据
#    --exclude 是双保险：即使源仓库未来误加入本地数据文件，也绝不同步
RSYNC_OPTS=(-av)
[ -n "$DRY_RUN" ] && RSYNC_OPTS+=("$DRY_RUN")
rsync "${RSYNC_OPTS[@]}" \
  --exclude='auth.json' \
  --exclude='trust.json' \
  --exclude='models-store.json' \
  --exclude='sessions/' \
  --exclude='*.key' \
  --exclude='*.pem' \
  --exclude='.env' \
  --exclude='.git/' \
  --exclude='*.bak' \
  --exclude='*.swp' \
  "$SRC/" "$PI_AGENT/"

# 2) auth.json 幂等生成：存在即保留，缺失才从 example 创建
#    （rsync 已排除 auth.json，此处处理的是"首次部署"场景）
if [ -f "$SRC/config/auth.json.example" ]; then
  if [ -f "$PI_AGENT/config/auth.json" ]; then
    echo "[保留] auth.json 已存在，未改动"
  elif [ "$DRY_RUN" = "-n" ]; then
    echo "[dry-run] 将生成 auth.json（从 example 复制）"
  else
    mkdir -p "$PI_AGENT/config"
    cp "$SRC/config/auth.json.example" "$PI_AGENT/config/auth.json"
    echo "[生成] auth.json 已从 example 创建，请编辑填入 API key"
  fi
fi

echo "=== 同步完成：本地数据（auth / session 等）未受影响 ==="
