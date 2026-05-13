#!/usr/bin/env bash
# Open Design 健康自检 + 自愈
# 由 Hermes cron 每小时调 · 看 3 组件状态 · idle 的自动启
# 静默 healthy · 异常时输出告警字符串 (Hermes deliver 到 Discord)

set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
NODE_24="/Users/matthew/.local/share/mise/installs/node/24.15.0/bin"
[ -d "$NODE_24" ] && export PATH="$NODE_24:$PATH"

OD_ROOT="/Users/matthew/Developer/open-design"
LOG_DIR="$HOME/Library/Logs/open-design-startup"
LOG="$LOG_DIR/$(date +%Y-%m-%d).log"
mkdir -p "$LOG_DIR"

TS=$(date "+%Y-%m-%d %H:%M:%S %Z")

cd "$OD_ROOT" || {
  echo "❌ OD 健康检查无法运行 · cd $OD_ROOT 失败 · $TS"
  exit 0
}

STATUS=$(corepack pnpm --silent tools-dev status 2>&1 | /usr/bin/tail -10)

IDLE_COUNT=$(echo "$STATUS" | /usr/bin/grep -cE ": idle$" || echo 0)
IDLE_COUNT=${IDLE_COUNT//[^0-9]/}
[ -z "$IDLE_COUNT" ] && IDLE_COUNT=0

if [ "$IDLE_COUNT" -eq 0 ]; then
  echo "[$TS] OD healthy · all 3 running" >> "$LOG"
  exit 0
fi

# 有 idle · 自愈
echo "[$TS] OD found $IDLE_COUNT idle component(s) · auto-starting" >> "$LOG"
echo "$STATUS" >> "$LOG"

START_OUTPUT=$(corepack pnpm tools-dev start 2>&1 | /usr/bin/tail -10)
START_EXIT=$?
echo "$START_OUTPUT" >> "$LOG"

# 再 check 一次确认恢复
sleep 3
RESTATUS=$(corepack pnpm --silent tools-dev status 2>&1 | /usr/bin/tail -5)
NEW_IDLE=$(echo "$RESTATUS" | /usr/bin/grep -cE ": idle$" || echo 0)
NEW_IDLE=${NEW_IDLE//[^0-9]/}
[ -z "$NEW_IDLE" ] && NEW_IDLE=0

if [ "$NEW_IDLE" -eq 0 ]; then
  echo "✅ OD 自愈成功 · $IDLE_COUNT 个 idle 组件已重启 · $TS"
else
  echo "❌ OD 自愈失败 · 仍有 $NEW_IDLE 个 idle 组件 · 需人工 · $TS"
  echo "$RESTATUS"
fi
