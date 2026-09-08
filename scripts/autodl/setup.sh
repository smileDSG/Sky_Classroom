#!/usr/bin/env bash
# =============================================================================
# 智眸无界 (OpenMAIC) — AutoDL 无卡实例 一键环境准备
#
# 用法（在 AutoDL 的 JupyterLab Terminal 里，整块粘贴执行）：
#   bash /root/autodl-tmp/OpenMAIC/scripts/autodl/setup.sh
#
# 做了什么：
#   1. 检查内存，不够就自动加 8G swap
#   2. 装 Node 22 + pnpm 10.28.0
#   3. 装系统依赖（原生模块编译工具 + LibreOffice + 中文字体）
#   4. 换 npmmirror 国内镜像
#   5. pnpm install（10~20 分钟）
#   6. pnpm build
#
# 幂等：中途失败可以随时重跑，已完成的步骤会跳过。
# =============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/root/autodl-tmp/OpenMAIC}"
REPO_URL="${REPO_URL:-https://github.com/THU-MAIC/OpenMAIC.git}"
NODE_MAJOR=22
PNPM_VERSION=10.28.0
SWAP_FILE=/root/swapfile

log() { printf '\n\033[1;36m[%-2s]\033[0m %s\n' "$1" "${*:2}"; }

# ---------------------------------------------------------------- 1. 内存 / swap
log 1 "检查内存"
TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "  物理内存: ${TOTAL_MB} MB"
if [ "$TOTAL_MB" -lt 7000 ]; then
  if swapon --show | grep -q "$SWAP_FILE"; then
    echo "  swap 已存在，跳过"
  else
    echo "  内存不足 7G，创建 8G swap（build 阶段必需，否则会 Killed）..."
    fallocate -l 8G "$SWAP_FILE" || dd if=/dev/zero of="$SWAP_FILE" bs=1G count=8
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE"
    swapon "$SWAP_FILE"
    echo "  swap 已启用"
  fi
else
  echo "  内存充足，无需 swap"
fi

# ---------------------------------------------------------------- 2. Node + pnpm
log 2 "配置 Node ${NODE_MAJOR} 与 pnpm ${PNPM_VERSION}"
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "  安装 nvm..."
  curl -fsSL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

if ! nvm ls "$NODE_MAJOR" >/dev/null 2>&1; then
  echo "  安装 Node ${NODE_MAJOR}..."
  nvm install "$NODE_MAJOR"
fi
nvm use "$NODE_MAJOR" >/dev/null
echo "  node $(node -v)"

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
echo "  pnpm $(pnpm -v)"

# ---------------------------------------------------------------- 3. 系统依赖
log 3 "安装系统依赖（编译工具 / LibreOffice / 中文字体）"
if ! command -v soffice >/dev/null 2>&1 || ! fc-list | grep -qi noto.*cjk; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    python3 build-essential g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libreoffice \
    fonts-noto-cjk fonts-wqy-zenhei
  fc-cache -f >/dev/null 2>&1 || true
  echo "  完成"
else
  echo "  已存在，跳过（如需重装请手动 apt-get install）"
fi
echo "  LibreOffice: $(soffice --version 2>/dev/null || echo '未安装')"

# ---------------------------------------------------------------- 4. 国内镜像
log 4 "配置 npm 镜像"
pnpm config set registry https://registry.npmmirror.com
echo "  registry = $(pnpm config get registry)"

# ---------------------------------------------------------------- 5. 取源码
log 5 "准备源码 -> ${APP_DIR}"
mkdir -p "$APP_DIR"
if [ ! -f "$APP_DIR/package.json" ]; then
  echo "  clone ${REPO_URL} ..."
  # 目录里可能已经有手动上传的 scripts/autodl/*，不能直接 clone 进去，
  # 所以先 clone 到临时目录再拷过来（cp -a 不会删掉已存在的文件）
  TMP_CLONE="$(mktemp -d)"
  git clone "$REPO_URL" "$TMP_CLONE/repo"
  cp -a "$TMP_CLONE/repo/." "$APP_DIR/"
  rm -rf "$TMP_CLONE"
  echo "  源码就绪"
else
  echo "  源码已存在，跳过 clone"
fi
cd "$APP_DIR"

# ---------------------------------------------------------------- 6. 环境变量
log 6 "检查 .env.local"
if [ ! -f .env.local ]; then
  if [ -f scripts/autodl/env.autodl.prefilled ]; then
    # 预填版已含 API key，直接用，不打断流程
    cp scripts/autodl/env.autodl.prefilled .env.local
    echo "  ✓ 已使用预填配置（含 API key），无需手动编辑"
  elif [ -f scripts/autodl/env.autodl.template ]; then
    # 模板版是空的，必须让人填了再继续
    cp scripts/autodl/env.autodl.template .env.local
    echo "  已从模板生成 .env.local"
    echo "  \033[1;33m>>> 现在必须编辑它：nano $APP_DIR/.env.local\033[0m"
    echo "  \033[1;33m>>> 至少填一个大模型 API KEY，然后重跑本脚本继续\033[0m"
    echo "  \033[1;33m>>> 零密钥也能跑（只能播内置演示课），可直接重跑\033[0m"
    exit 0
  else
    echo "  未找到模板，跳过（可稍后 cp .env.example .env.local）"
  fi
else
  echo "  .env.local 已存在，跳过"
fi

# ---------------------------------------------------------------- 7. 装依赖
log 7 "pnpm install（这一步 10~20 分钟，会现场编译 4 个本地包）"
pnpm install --frozen-lockfile

# ---------------------------------------------------------------- 8. 编译
log 8 "pnpm build"
NODE_OPTIONS=--max-old-space-size=6144 pnpm build

# ---------------------------------------------------------------- 收尾
cat <<EOF

\033[1;32m================ 环境准备完成 ================\033[0m

接下来只需一条命令启动：

    bash $APP_DIR/scripts/autodl/start.sh

然后回到 AutoDL 控制台 → 实例卡片 → 自定义服务，打开弹出的 https 地址。
（若自定义服务不可用，改用 SSH 隧道：
   ssh -p <端口> root@<host> -L 6006:127.0.0.1:6006 -N
   本地浏览器打开 http://127.0.0.1:6006）

EOF
