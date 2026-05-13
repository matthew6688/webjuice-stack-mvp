# Open Design · 永久启动 / 自愈

## 你之前踩的坑

双击 `Electron.app` 图标 → "To run a local app, execute the following on the command line: $ /Users/matthew/Developer/open-design/node_modules/.pnpm/electron@41.3.0/.../Electron path-to-app"

**根因**: OD 0.5.0 用 `pnpm tools-dev` 启 **3 个组件** (daemon · web · desktop) · 这三个共同提供完整 GUI。直接跑 Electron 二进制只启了一个空壳 · 没指定 app 入口 · 所以出 "path-to-app" 兜底文案。

**永远不要双击 Electron.app**。

## 永久 fix · 装了 2 道防线

### 防线 1 · 登录自启 (LaunchAgent)

```
~/Library/LaunchAgents/ai.profitslocal.open-design.plist
  ↓ RunAtLoad
ops/od/od-startup.sh
  ↓ cd /Users/matthew/Developer/open-design
  ↓ corepack pnpm tools-dev start (idempotent)
daemon + web + desktop · 全 3 个起来
```

登录 Mac · OD 自己起来 · 不用点任何东西。

### 防线 2 · 每小时自愈 (Hermes cron)

```
Hermes cron 0552a0bf3348 · '0 * * * *'
  ↓
ops/od/od-healthcheck.sh
  ↓ corepack pnpm tools-dev status
  ↓ 看到 idle 组件
  ↓ corepack pnpm tools-dev start (只启 idle 的)
  ↓ 输出 "✅ OD 自愈成功" 到 #bot-logs (健康时静默)
```

任意组件被杀 / sleep 后挂 · 最多等 1 小时自愈。

## 文件

| 路径 | 用途 |
|---|---|
| `ops/od/od-startup.sh` | 登录时跑 · 启全 3 · idempotent |
| `ops/od/od-healthcheck.sh` | 每小时跑 · 自愈 idle 组件 |
| `~/Library/LaunchAgents/ai.profitslocal.open-design.plist` | LaunchAgent · 登录触发 |
| `~/.hermes/profiles/marketer/scripts/od-healthcheck.sh` | Hermes cron 真身 (从 ops/ 同步) |

## 操作

```bash
# 手工立刻启 (不等登录 / cron)
ops/od/od-startup.sh

# 手工查状态
cd /Users/matthew/Developer/open-design && corepack pnpm tools-dev status

# 手工自愈
ops/od/od-healthcheck.sh

# 日志
tail -f ~/Library/Logs/open-design-startup/$(date +%Y-%m-%d).log
```

## Hermes cron 控制

```bash
hermes cron list                    # 看
hermes cron run 0552a0bf3348        # 触发一次
hermes cron edit 0552a0bf3348 --schedule '0 9 * * *'   # 改 daily
hermes cron rm 0552a0bf3348         # 删
```

## 当前实测证据 (2026-05-13)

- 杀 desktop PID 72031 → healthcheck → 自动 restart → PID 78512 → "✅ OD 自愈成功 · 1 个 idle 组件已重启"
- LaunchAgent 装了 (`launchctl list | grep open-design` → PID 79069 一过性)
- Hermes cron `0552a0bf3348` last_run = ok

## 次要警告 (不阻塞)

Node 版本警告: OD 要 `node ~24` · 你系统 `v25.6.1`。当前所有 smoke 都过 · 是 warning 不是 error。脚本里通过 `/Users/matthew/.local/share/mise/installs/node/24.15.0/bin` 优先 PATH 已 nudge。如果未来某次 OD 升级真不兼容 25 · 我们再处理。
