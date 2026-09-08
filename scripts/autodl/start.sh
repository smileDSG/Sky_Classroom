#!/usr/bin/env bash
# =============================================================================
# 智眸无界 (OpenMAIC) — AutoDL 启动 / 重启（每次开机后跑这条就够）
#
# 用法：
#   bash /root/autodl-tmp/OpenMAIC/scripts/autodl/start.sh
#
# 端口固定 6006（AutoDL 公网只映射 6006 / 6008，用 3000 外网访问不到）
# =============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/root/autodl-tmp/OpenMAIC}"
PORT="${PORT:-6006}"
LOG="$APP_DIR/app.log"

log() { printf '\n\033[1;36m[%-2s]\033[0m %s\n' "$1" "${*:2}"; }

# ---------------------------------------------------------------- 环境
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if [ ! -d "$APP_DIR" ]; then
  echo "找不到项目目录 $APP_DIR —— 请先跑 setup.sh"
  exit 1
fi
cd "$APP_DIR"

if [ ! -d .next ]; then
  echo "还没编译 —— 请先跑 setup.sh（或手动 pnpm build）"
  exit 1
fi

# ---------------------------------------------------------------- 清理旧进程
log 1 "清理旧进程"
pkill -f "next start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "  \033[1;33m端口 ${PORT} 仍被占用，强制释放...\033[0m"
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 2
fi

# ---------------------------------------------------------------- 启动
log 2 "启动服务（端口 ${PORT}）"
nohup env \
  PORT="$PORT" \
  HOSTNAME=0.0.0.0 \
  NODE_ENV=production \
  pnpm start > "$LOG" 2>&1 &

echo $! > "$APP_DIR/.app.pid"
echo "  PID $(cat "$APP_DIR/.app.pid")"

# ---------------------------------------------------------------- 自检
log 3 "等待服务就绪"
OK=0
for i in $(seq 1 40); do
  sleep 2
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/"; then
    OK=1
    break
  fi
  printf '.'
done
echo

if [ "$OK" -eq 1 ]; then
  cat <<EOF

\033[1;32m================ 启动成功 ================\033[0m

  本机地址： http://127.0.0.1:${PORT}
  日志：     tail -f $LOG

  公网访问（二选一）：
  A. AutoDL 控制台 → 实例卡片 → 自定义服务 → 打开弹出的 https 地址
  B. 你自己的电脑上执行：
     ssh -p <端口> root@<host> -L ${PORT}:127.0.0.1:${PORT} -N
     然后浏览器打开 http://127.0.0.1:${PORT}

EOF
else
  cat <<EOF

\033[1;31m================ 启动失败 ================\033[0m

最后 40 行日志：
------------------------------------------------
$(tail -n 40 "$LOG")
------------------------------------------------
完整日志： $LOG

EOF
  exit 1
fi
