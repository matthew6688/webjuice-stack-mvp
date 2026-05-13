#!/usr/bin/env bash
# Open Design 永久启动脚本
# 由 LaunchAgent (开机) + Hermes cron (每小时) 调用 · idempotent
#
# 修哪个坑:
#   Matthew 双击 Electron.app 图标会出 "path-to-app" 错误
#   因为 OD 0.5.0 不通过 Electron 直起 · 必须走 tools-dev (daemon+web+desktop 三件套)
#   这脚本 = 唯一正确启动路径

set -u

# 路径
OD_ROOT="/Users/matthew/Developer/open-design"
LOG_DIR="$HOME/Library/Logs/open-design-startup"
mkdir -p "$LOG_DIR"

TS=$(date "+%Y-%m-%d %H:%M:%S %Z")
LOG="$LOG_DIR/$(date +%Y-%m-%d).log"

# PATH (cron 环境继承不了 shell PATH)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 找 Node 24 (mise) · OD 要 ~24 · 系统当前可能装 25
NODE_24="/Users/matthew/.local/share/mise/installs/node/24.15.0/bin"
if [ -d "$NODE_24" ]; then
  export PATH="$NODE_24:$PATH"
fi

cd "$OD_ROOT" || {
  echo "[$TS] FATAL: cannot cd $OD_ROOT" >> "$LOG"
  exit 1
}

# 'start' 是 idempotent · 已经跑的不重启 · idle 的才启
# corepack 包 pnpm · 不依赖系统 pnpm 版本
OUTPUT=$(corepack pnpm tools-dev start 2>&1)
EXIT=$?

echo "[$TS] tools-dev start exit=$EXIT" >> "$LOG"
echo "$OUTPUT" | /usr/bin/tail -20 >> "$LOG"
echo "" >> "$LOG"

exit $EXIT
