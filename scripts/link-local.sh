#!/bin/bash
# ============================================================
# pi-env link-local.sh — 为本机建立软链接
#
# Linux:
#   ~/.pi/agent ..... → /data/pi-env/linux/
#     └── sessions ... → /data/pi-work/sessions/（运行时分离）
#   各项目 .pi/ ...... → /data/pi-env/projects/<项目>/
#
# Windows (Git Bash / WSL):
#   与 Linux 相同，但 ~/.pi/agent 指向 Windows 适配目录
#
# 用法：
#   ./link-local.sh              # 自动检测 OS（默认 linux）
#   ./link-local.sh --os linux
#   ./link-local.sh --os windows
# ============================================================
set -euo pipefail

OS="${1:-linux}"
PI_WORK="/data/pi-work"

link_agent() {
  local os_dir="/data/pi-env/$OS"
  local sessions_link="$os_dir/sessions"
  local sessions_target="$PI_WORK/sessions"

  if [ ! -d "$os_dir" ]; then
    echo "错误: OS 目录 $os_dir 不存在" >&2
    exit 1
  fi

  echo "--- ~/.pi/agent → $os_dir ---"
  if [ -L ~/.pi/agent ] && [ "$(readlink ~/.pi/agent)" = "$os_dir" ]; then
    echo "[跳过] 已正确"
  else
    if [ -d ~/.pi/agent ] && [ ! -L ~/.pi/agent ]; then
      mv ~/.pi/agent ~/.pi/agent.auto-bak
      echo "已备份 ~/.pi/agent.auto-bak" >&2
    fi
    ln -sfn "$os_dir" ~/.pi/agent
    echo "[OK] ~/.pi/agent → $os_dir"
  fi

  # sessions 软链接
  if [ -L "$sessions_link" ]; then
    echo "[跳过] $sessions_link 已存在"
  else
    if [ -d "$sessions_link" ]; then
      mv "$sessions_link" "${sessions_link}.auto-bak"
      echo "已备份 ${sessions_link}.auto-bak" >&2
    fi
    mkdir -p "$sessions_target"
    ln -sfn "$sessions_target" "$sessions_link"
    echo "[OK] $sessions_link → $sessions_target"
  fi
}

link_project() {
  local proj="$1"
  local src="/data/pi-env/projects/$proj"
  local dst="$HOME/proj/$proj/.pi"

  if [ ! -d "$src" ]; then
    echo "[跳过] /data/pi-env/projects/$proj 不存在"
    return 0
  fi

  if [ -L "$dst" ] && [ "$(readlink "$dst")" = "$src" ]; then
    echo "[跳过] $dst 已正确"
    return 0
  fi

  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv "$dst" "${dst}.auto-bak"
    echo "已备份 ${dst}.auto-bak" >&2
  fi

  ln -sfn "$src" "$dst"
  echo "[OK] $dst → $src"
}

echo "=== 建立本机 pi 软链接（OS: $OS）==="
echo ""

link_agent
echo ""

for proj in mana "本地服务器" pi-exp; do
  link_project "$proj"
done

echo ""
echo "完成。验证: readlink ~/.pi/agent"
echo "       ls ~/.pi/agent/config/"
