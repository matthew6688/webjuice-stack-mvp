#!/usr/bin/env bash
# SOP-0 health ping · Hermes cron 调用
#
# Modes:
#   (default)   每小时跑 · 输出健康行 → bot-logs (Hermes deliver)
#               连续 ≥ 2 次 ❌ → 直发 #sop-alert + @Matthew (绕过 Hermes deliver)
#   --daily     每天 09:00 · 强制 "🌅 早安心跳" 行 (即便健康) → bot-logs
#               dead-man's switch · 没收到 = 出事了
#
# 状态文件 ~/.hermes/state/sop0-fail-streak.txt 记录连续失败次数。

set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO="/Users/matthew/Developer/google-map-website"
STATE_DIR="$HOME/.hermes/state"
STREAK_FILE="$STATE_DIR/sop0-fail-streak.txt"
TS=$(date "+%Y-%m-%d %H:%M %Z")
MODE="${1:-hourly}"

ALERTS_CHANNEL="1503855265949421658"   # #sop-alert (critical, @Matthew)
MATTHEW_USER_ID="964646126902988852"

mkdir -p "$STATE_DIR"
STREAK=$(cat "$STREAK_FILE" 2>/dev/null || echo 0)

cd "$REPO" || {
  echo "❌ SOP-0 健康检查无法运行 · 仓库目录不存在: $REPO · ${TS}"
  exit 0
}

# doctor 内部已 5-20s 超时
RESULT=$(npm run --silent pl:sop0-doctor -- --json 2>/dev/null)

PARSED=$(node -e "
  let d;
  try { d = JSON.parse(process.argv[1]); } catch (e) {
    console.log('PARSE_FAIL'); process.exit(0);
  }
  if (d.ok) {
    console.log('OK ' + d.passed + '/' + d.total);
  } else {
    const failed = d.checks.filter(c => !c.ok).map(c => c.name + ' (' + c.detail + ')').join(' · ');
    console.log('FAIL ' + d.passed + '/' + d.total + ' :: ' + failed);
  }
" "$RESULT" 2>/dev/null)

# 直发 Discord (给 critical escalation 绕过 Hermes deliver)
post_to_discord() {
  local channel="$1"
  local content="$2"
  local token
  token=$(/usr/bin/grep -E "^WEBSITE_TASKS_DISCORD_BOT_TOKEN=" "$REPO/.env.local" | /usr/bin/cut -d= -f2-)
  [ -z "$token" ] && return 1
  local body
  body=$(node -e 'console.log(JSON.stringify({content: process.argv[1]}))' "$content")
  /usr/bin/curl -sS -m 10 \
    -X POST \
    -H "Authorization: Bot $token" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "https://discord.com/api/v10/channels/$channel/messages" >/dev/null 2>&1
}

case "$PARSED" in
  OK*)
    PASSED="${PARSED#OK }"
    # 健康 · 之前 streak > 0 → 发恢复通知到 #sop-alert (闭环)
    if [ "$STREAK" -gt 0 ]; then
      post_to_discord "$ALERTS_CHANNEL" "🟢 **SOP-0 已恢复** · ${PASSED} 通过 · 此前连续失败 ${STREAK} 次 · ${TS}"
    fi
    echo 0 > "$STREAK_FILE"
    # 输出到 bot-logs (Hermes deliver)
    if [ "$MODE" = "--daily" ]; then
      echo "🌅 SOP-0 早安心跳 · ${PASSED} 通过 · ${TS}"
    else
      echo "✅ SOP-0 健康 · ${PASSED} 通过 · ${TS}"
    fi
    ;;
  FAIL*)
    DETAIL="${PARSED#FAIL }"
    STREAK=$((STREAK + 1))
    echo "$STREAK" > "$STREAK_FILE"
    echo "❌ SOP-0 不健康 (连续第 ${STREAK} 次) · ${DETAIL} · ${TS}"
    if [ "$STREAK" -ge 2 ]; then
      post_to_discord "$ALERTS_CHANNEL" "🚨 <@${MATTHEW_USER_ID}> **SOP-0 持续异常** · 连续 ${STREAK} 次失败 · ${TS}
${DETAIL}

请在本机跑 \`npm run pl:sop0-doctor\` 看完整诊断 · 每个失败项都附了 fix 命令。"
    fi
    ;;
  *)
    STREAK=$((STREAK + 1))
    echo "$STREAK" > "$STREAK_FILE"
    echo "⚠️ SOP-0 doctor 输出解析失败 (连续第 ${STREAK} 次) · ${TS} · raw=${RESULT:0:200}"
    if [ "$STREAK" -ge 2 ]; then
      post_to_discord "$ALERTS_CHANNEL" "🚨 <@${MATTHEW_USER_ID}> **SOP-0 doctor 自身出错** · 连续 ${STREAK} 次无法解析输出 · ${TS} · 多半是脚本坏了 / npm/node 路径问题"
    fi
    ;;
esac
exit 0
