#!/usr/bin/env bash
# SOP-0 daily heartbeat wrapper · 调主脚本 --daily 模式
# Hermes cron 不支持 script positional args · 用 wrapper 注入 flag
exec "$(dirname "$0")/sop0-health-ping.sh" --daily
