#!/bin/bash
# ============================================================
# pi-env export.sh — 导出 pi 配置供其他设备使用
#
# 用途：从 /data/pi-env/<os>/ 打包配置，
#       排除运行时数据（sessions、node_modules），
#       供 Termux / Windows 或其他设备通过 SSH 拉取使用。
#
# 用法：
#   ./export.sh [--os linux|windows] [--full] [输出文件]
#
# 选项：
#   --os <name>       指定操作系统（默认 linux）
#   --full            包含运行时数据（sessions、node_modules）
#   输出文件          可选输出路径，默认 stdout
#
# 示例：
#   本地保存： ./export.sh --os linux pi-linux.tar.gz
#   SSH 拉取： ssh server /data/pi-env/scripts/export.sh | tar xz -C ~/.pi/agent/
# ============================================================
set -euo pipefail

OS="linux"
FULL=false
OUTFILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --os|-o)
      OS="$2"
      shift 2
      ;;
    --full|-f)
      FULL=true
      shift
      ;;
    *)
      OUTFILE="$1"
      shift
      ;;
  esac
done

SOURCE="/data/pi-env/$OS"

if [ ! -d "$SOURCE" ]; then
  echo "错误：OS '$OS' 的配置目录不存在: $SOURCE" >&2
  echo "可用 OS 目录:" >&2
  ls -d /data/pi-env/*/ 2>/dev/null | xargs -I{} basename {} | grep -v -E '^(scripts|docs|staging|archive|projects)$' >&2 || echo "  （无）" >&2
  exit 1
fi

echo "=== pi 配置导出工具 ===" >&2
echo "OS: $OS" >&2
echo "来源: $SOURCE" >&2

EXCLUDES=()
if [ "$FULL" = false ]; then
  EXCLUDES+=(--exclude="sessions" --exclude="node_modules")
  echo "排除: sessions/ node_modules/" >&2
else
  echo "模式: 完整（含 sessions、node_modules）" >&2
fi
echo "" >&2

TAR_ARGS=(
  czf
  "${OUTFILE:-/dev/stdout}"
  "${EXCLUDES[@]}"
  --dereference
  -C "$SOURCE"
  .
)

if [ -n "$OUTFILE" ]; then
  tar "${TAR_ARGS[@]}"
  echo "已导出到: $OUTFILE" >&2
  echo "大小: $(du -h "$OUTFILE" | cut -f1)" >&2
else
  tar "${TAR_ARGS[@]}"
fi

echo "完成。" >&2
