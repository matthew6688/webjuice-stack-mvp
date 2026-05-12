# Hermes cron scripts · SOP-0 告警闭环

这些脚本被 Hermes cron 调用 (`--no-agent --script`)，stdout 直接 deliver 到 Discord。
**真身位置**：`~/.hermes/profiles/marketer/scripts/` —— 仓库这份是 version-control 副本。
改任意一份后用 `cp` 同步另一边，然后 `hermes cron tick` 验证。

## 文件

| 文件 | 调用方 | Discord 路由 |
|---|---|---|
| `sop0-health-ping.sh` | Hermes cron `SOP-0 hourly health ping` (id `0a3482c05eef`, `0 * * * *`) | `bot-logs` (1493926218574200942) · critical fail 升级 `sop-alert` (1503855265949421658) |
| `sop0-daily-heartbeat.sh` | Hermes cron `SOP-0 daily 09:00 heartbeat` (id `2fad97bcc0c8`, `0 9 * * *`) | `bot-logs` |

## 告警逻辑

```
hourly tick → pl:sop0-doctor --json
  ├─ ok                              → bot-logs: ✅ 健康 · N/N 通过
  ├─ fail #1 (streak 0→1)            → bot-logs: ❌ 不健康 (连续第 1 次)
  ├─ fail #2+ (streak ≥ 2)           → bot-logs: ❌ + ALSO → sop-alert: 🚨 @Matthew
  └─ recovery (streak >0 → 0)        → bot-logs: ✅ + ALSO → sop-alert: 🟢 已恢复

daily 09:00 tick → 同上 + 强制输出 "🌅 早安心跳" (即便健康)
                   dead-man's switch · 没收到 = cron 自己挂了
```

状态文件：`~/.hermes/state/sop0-fail-streak.txt` (单整数, 连续失败次数, 健康时清零)。

## 部署 / 同步

```bash
# 改 ops/hermes-scripts/sop0-health-ping.sh 后:
cp ops/hermes-scripts/sop0-health-ping.sh ~/.hermes/profiles/marketer/scripts/

# 验证:
hermes cron run <job_id>   # 排进下个 tick
hermes cron tick           # 立刻跑

# 看结果:
hermes cron list           # last_run ok / error
```

## 管理 crons

```bash
hermes cron list
hermes cron edit <id> --schedule '*/15 * * * *'   # 改频率
hermes cron rm <id>
```
