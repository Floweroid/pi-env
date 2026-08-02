#!/bin/bash
# ============================================================
# pi-env publish-from-exp.sh — 将 pi-exp 实验扩展发布到稳定目录
#
# 用法：
#   ./publish-from-exp.sh agent-manager          # 发布到 linux
#   ./publish-from-exp.sh agent-manager --os windows
#   ./publish-from-exp.sh --all                  # 发布所有到 linux
#
# 流程：
#   pi-exp/.pi/extensions/<name>
#     → 覆盖 staging/<日期>/<name>（快照，git 可回溯）
#     → 覆盖 <os>/extensions/<name>（稳定版）
# ============================================================
set -euo pipefail

EXP_EXT="$HOME/proj/pi-exp/.pi/extensions"
OS="linux"
STAGING_DIR="/data/pi-env/staging/$(date +%Y%m%d)"

publish_one() {
  local name="$1"
  local src="$EXP_EXT/$name"
  local stable_ext="/data/pi-env/$OS/extensions"
  local dst="$stable_ext/$name"

  if [ ! -d "$src" ] && [ ! -f "$src" ]; then
    echo "错误: pi-exp 中找不到 '$name'" >&2
    return 1
  fi

  # 覆盖 staging 快照
  mkdir -p "$STAGING_DIR"
  rm -rf "$STAGING_DIR/$name"
  cp -a "$src" "$STAGING_DIR/$name"
  echo "[staging] 快照 → $STAGING_DIR/$name"

  # 覆盖稳定目录
  mkdir -p "$stable_ext"
  rm -rf "$dst"
  cp -a "$src" "$dst"
  echo "[发布] '$name' ($OS) → $dst"
}

# 解析参数
names=()
while [ $# -gt 0 ]; do
  case "$1" in
    --os|-o)
      OS="$2"
      shift 2
      ;;
    --all)
      names+=(--ALL--)
      shift
      ;;
    *)
      names+=("$1")
      shift
      ;;
  esac
done

if [ ${#names[@]} -eq 0 ]; then
  echo "用法: $0 <name|--all> [--os linux|windows]" >&2
  echo "可用扩展:" >&2
  ls "$EXP_EXT" >&2
  exit 1
fi

for name in "${names[@]}"; do
  if [ "$name" = "--ALL--" ]; then
    echo "警告: 将发布 pi-exp 中所有扩展到 $OS 稳定目录" >&2
    for item in "$EXP_EXT"/*; do
      publish_one "$(basename "$item")"
    done
  else
    publish_one "$name"
  fi
done
