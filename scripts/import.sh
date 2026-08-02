#!/bin/bash
# ============================================================
# pi-env import.sh — 导入其他设备的 pi 配置快照
#
# 从其他设备导入配置到本机存档。
#
# 用法：
#   从文件导入： ./import.sh /path/to/config.tar.gz --os linux
#   从 stdin：    cat config.tar.gz | ./import.sh --os windows
# ============================================================
set -euo pipefail

ARCHIVE_DIR="/data/pi-env/archive"
OS="unknown"
SOURCE_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --os|-o)
      OS="$2"
      shift 2
      ;;
    *)
      SOURCE_FILE="$1"
      shift
      ;;
  esac
done

mkdir -p "$ARCHIVE_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$ARCHIVE_DIR/${OS}-${TIMESTAMP}"

mkdir -p "$DEST"

if [ -n "$SOURCE_FILE" ] && [ -f "$SOURCE_FILE" ]; then
  tar xzf "$SOURCE_FILE" -C "$DEST"
elif [ ! -t 0 ]; then
  tar xzf - -C "$DEST"
else
  echo "用法: $0 [--os <linux|windows>] [文件路径]" >&2
  echo "       cat config.tar.gz | $0 --os linux" >&2
  exit 1
fi

echo "已导入 $OS 的配置到: $DEST" >&2
echo "大小: $(du -sh "$DEST" | cut -f1)" >&2
ls -la "$DEST" >&2
