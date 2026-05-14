# V3 D43+ Bulk Pipeline Plan v2 · 溪水长流

> 状态：PLAN ONLY · 不实施 · 等 Matthew 给开工指令
> v2 修订：2026-05-14 · 撤 dokobot/budget/quiet-hours · 加 GitHub query 源 · #website-tasks 可视化
> 目标：roofing AU 28,800 query · 永续 pipeline · 50/day · 24h · 断电续传 · Discord 可视化

---

## 1. 核心原则

- **永续 stream · 不 burst**：你说停就停，不是 deadline 任务
- **docker 优先 · Places API fallback**（docker 失败 2 次切 Places · 不是常规手段）
- **下游决定上游**：feeder 看 detail-queue + running task 数 · 满了不投
- **任意时刻 kill 安全**：所有状态持久化 · 重启 resume · 孤儿 task 由 reaper 清（cycle-3 已修）
- **可视化在 #website-tasks**：pinned 主帖 edit · per-feed 进同一 thread

---

## 2. 真实速率约束（已读代码核实）

| 来源 | 文件 | 当前限速 | 备注 |
|------|------|---------|------|
| Docker maps scraper | `scripts/leads/maps-scraper-discovery.js` | 无内建 · spawnSync docker | **单 IP 安全 50 query/day**（Matthew 拍板） |
| Tinyfish | `core/extractors/tinyfish.js` | 30/min token bucket | 活的 |
| ~~Dokobot~~ | `core/scrape/dokobot.js` | ~~30/min~~ | **已退役 · 生产代码无 import** |
| Google Places API | ledger `google_places` | 100K req/day (有免费 credit) | docker 2 连失才切 |
| cheap-audit-queue | `core/leads/cheap-audit-queue.js` | 3s gap · 1 concurrent | 已实现 |
| detailed-audit-queue | `core/leads/detailed-audit-queue.js` | 30s gap · 1 concurrent · 优先级 | 已实现 |
| Discord rate (per channel) | discord.js token bucket | 5 burst · 1.2s refill | 已实现 |

**docker 50/day 是真瓶颈。** detail-audit 容量 ~200/day 远大于 50×10×15%=75 需求 → 不会堵。

---

## 2a · Docker scraper 单 query 产量（实测 + 调参）

**关键事实**: `--count` 参数名误导 · 实际映射 gosom 的 `-depth` (scroll 深度) · **不是** 结果硬上限。

### 默认配置 (scripts/cli/pl-scrape-docker.js)
```
count → depth = 10
zoom = 15 (街区级)
max_time = 240s (4 min)
exit-on-inactivity = 3 min
```

### 实测 (data/maps-scraper/runs/ · 2026-05-14)
| 关键词 + 城市 | 传入 count | 实际返回 leads |
|--------------|------------|----------------|
| roofing brisbane | 10 | 5 |
| roofers brisbane | 10 | 4 |
| roofer adelaide | 10 | 9 |
| roofer brisbane | 10 | 7 |

→ 单 query **典型 5-9 leads** · 而非以为的 10。

### Google Maps 自身硬上限
**~120 markers / search** · 滚到底也不再加。即使 depth=20 也拿不到第 121 个。要更多必须**换 query** (附近 suburb / 不同 keyword)。

### 调参（要拿更多 leads/query · 不建议默认上调）
| 调 | 效果 | 副作用 |
|----|------|--------|
| `zoom=12-13` | 视野扩到 city 级 · 40-80 leads/query | 边界外可能进结果 · 跨 suburb |
| `max_time=900s` | 给 gosom 慢慢 scroll · ~80-120 | 单 query 慢 15min · 串行很慢 |
| `--proxies` (env `MAPS_SCRAPER_PROXIES`) | 多 IP 并发 + 不撞 Google 封禁 | 要钱 (residential proxy) 或自建池 |

### 正确的 scaling 方式 · profitslocal-leads 仓库设计
仓库 `search_queue.csv` 用 **city × suburb × service_keyword 笛卡尔积** · 不是想办法从单 query 榨 120 个：
- "roofing contractor Brisbane QLD"
- "metal roofing Brisbane QLD"
- "roof repair Gold Coast QLD"
- ...

3517 QLD roofing query × 5-9 leads/query ≈ **~30K raw leads** (matches our pipeline target)。

### 命名歧义 (待后续修)
`--count 10` 实际是 `depth=10` · 当下 docs 注释承认歧义但没改。
未来:
- rename `--count` → `--scroll-depth` (明确语义)
- 新增 `--target-leads N` (循环 query · 累积到 N 停 · 真正按数量)
- 或保持现状 · 接受 "1 query = 5-20 leads · 数量靠 query 数 scale"

### 对 bulk pipeline 的影响

| 参数 | 数值 |
|------|------|
| Daily docker cap | 50 query/day |
| 单 query 实测产量 | ~5-9 leads |
| 每日 raw leads | 250-450 |
| 排除式 filter 后 (LEAD-FILTERING-DESIGN ~50%) | 125-225 survivors/day |
| Detail audit 容量 (5-10 min/entity · 单线程) | ~144-288/day |
| 瓶颈 | **detail audit · 不是 docker scrape** |

→ docker 50/day 配 detail audit 单线程 · 容量基本匹配 · 不需要并发 audit (保 mac 凉)。

---

## 3. 查询源（external）

**Repo:** `https://github.com/matthew6688/profitslocal-leads`

```
search_queue_act_canberra_roofing.csv
search_queue_nsw_metro_roofing.csv
search_queue_nsw_regional_roofing.csv
search_queue_nt_darwin_roofing.csv
search_queue_qld_regional_roofing.csv   (+ search_queue.csv = qld_metro 3517)
search_queue_sa_metro_roofing.csv
search_queue_tas_hobart_roofing.csv
search_queue_tas_launceston_roofing.csv
search_queue_vic_metro_roofing.csv
search_queue_vic_regional_roofing.csv
search_queue_wa_metro_roofing.csv
search_queue_wa_regional_roofing.csv
```

**只 roofing niche** · 13 region 全消费 · 合计 ~28,800 query
**消费顺序：P1 全 region → P2 全 region → P3 全 region**
**CSV schema:** `id, search_query, location_type, city, suburb, postcode, state, service_keyword, priority, score, status`
**CSV `status` 列 = gosom 进度（他们的）· 我们不读不写**

### Repo 同步
- 初始：`git clone https://github.com/matthew6688/profitslocal-leads data/bulk/leads-repo`
- Sentinel 每 **6h** `git pull`
- 拉完触发 `pl-bulk-pool-rebuild` 合并 13 CSV → `pool-snapshot.json`
- 新增 query 自动入池

---

## 4. 体系架构（4 层 · 与现有 V3 无缝集成）

```
┌─ Layer 0 · Query Pool (external + local state) ────────────────┐
│ data/bulk/leads-repo/*.csv      ← read-only · git pull 6h      │
│ data/bulk/pool-snapshot.json    ← 合并 13 CSV · P1→P2→P3 排序  │
│ data/bulk/feed-state.jsonl      ← append-only · 真相源         │
│ data/bulk/feed-cursor.json      ← 快照 (last_fed_id, today_n)  │
│ data/bulk/quota.json            ← {date, docker_used}          │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─ Layer 1 · Feeder daemon (永动) ───────────────────────────────┐
│ scripts/cli/pl-bulk-feeder.js                                  │
│ ai.profitslocal.v3.bulk-feeder.plist (KeepAlive · 24h)         │
│                                                                │
│ 每 30 min 醒来：                                               │
│  1. 检查 STOP 文件 · 存在则 sleep                              │
│  2. 4 个 gauge 检查 (§5) · 任一红停                            │
│  3. 全绿 → 读 pool-snapshot 下一个 fed_at=null query           │
│  4. createTask(kind:intake, cli:leads:maps-scrape, args:...)   │
│  5. append feed-state.jsonl · update cursor + quota            │
│  6. 失败 attempts++ · 2 次失败切 Places API                    │
│  7. 更新 #website-tasks pinned message + 发 1 行 reply         │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼ task (走现有 pipeline 不动)
       intake → cheap-audit-queue → predict-grade
         · D → archived
         · A/B → detailed-audit-queue (优先级 100/75)
         · C → cold backlog
       → detailedAudit → demo-build → publish
                       │
                       ▼
┌─ Layer 2 · Sentinel (hourly cron) ─────────────────────────────┐
│ scripts/cli/pl-bulk-sentinel.js                                │
│ ai.profitslocal.v3.bulk-sentinel.plist (StartCalendarInterval) │
│                                                                │
│ 每小时跑一次：                                                 │
│  · pgrep feeder · 死了 launchd 自动拉起 · 检测 heartbeat       │
│  · 6h 一次 git pull leads-repo + rebuild pool-snapshot         │
│  · 调用 pl-lead-journey-doctor (10 不变量)                     │
│  · grade 分布 (last 24h) · D 占比 > 90% 警告                   │
│  · ledger 今日 free credit 用量记录 (visibility 不当 gauge)    │
│  · 任意红 gauge → #website-tasks 独立 alert message            │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼ Discord
┌─ Layer 3 · Visualization (#website-tasks 集中 · 一处看全) ─────┐
│  (a) Pinned message · feeder edit · LIVE 主显示                │
│  (b) Per-feed reply · 同一 thread · audit trail                │
│  (c) Sentinel hourly heartbeat · 同 thread 末尾                │
│  (d) Red-gauge alert · 独立 message (不 edit pinned)           │
│  (e) Per-entity thread → #website-leads (已实现 D43)           │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Feeder 的 4-Gauge 决策（任一红 → sleep · 全绿 → 投一个）

| Gauge | 数据源 | 红线 | 默认值 |
|-------|--------|------|--------|
| **docker 今日配额** | `data/bulk/quota.json` | ≥ DAILY_DOCKER_CAP | **50** |
| **running tasks** | `listTasks({status:'running'})` | > 3 | 3 |
| **detail-queue pending** | `detailed-audit-pending.jsonl` 行数 | > 20 | 20 |
| **mac CPU loadavg[0]** | `os.loadavg()[0]` | > 4.0 | 4.0 |

~~budget gauge~~ — codex CLI / Claude Code CLI = 订阅；Places API = free credits → 不需要。ledger 只用于 visibility。

阈值全部环境变量，不写死：
- `DAILY_DOCKER_CAP=50`
- `FEEDER_MAX_RUNNING_TASKS=3`
- `FEEDER_MAX_DETAIL_PENDING=20`
- `FEEDER_MAX_CPU_LOAD=4.0`
- `FEEDER_WAKE_INTERVAL_MS=1800000` (30min)

---

## 6. 持久化 & 断电续传（真相源 = `feed-state.jsonl`）

```jsonl
{"ts":"2026-05-14T22:00Z","event":"fed","query_id":"qld_metro:42","task_id":"20260514-220000-abc123","query":"roof restoration Brisbane QLD","city":"Brisbane","niche":"roofing"}
{"ts":"2026-05-14T22:05Z","event":"completed","query_id":"qld_metro:42","leads":11,"a":1,"b":2,"c":4,"d":4}
{"ts":"2026-05-14T22:35Z","event":"failed","query_id":"qld_metro:43","attempt":1,"error":"docker exit 1 timeout"}
{"ts":"2026-05-14T22:36Z","event":"retry","query_id":"qld_metro:43","attempt":2}
{"ts":"2026-05-14T22:38Z","event":"fallback_places","query_id":"qld_metro:43","reason":"docker 2x fail"}
```

| 状态 | 文件 | 重启行为 |
|------|------|---------|
| Query pool | `pool-snapshot.json` | 6h 重建 · 永远不丢 query |
| Feed events | `feed-state.jsonl` (append-only) | replay 出 Set(fed_id) 排除已投 |
| Cursor cache | `feed-cursor.json` | 丢了从 jsonl 重建 |
| Daily quota | `quota.json` | 跨天 reset |
| Cheap-audit queue | `data/leads/queues/cheap-audit-pending.jsonl` | loadQueueOnStart 已实现 |
| Detail-audit queue | `data/leads/queues/detailed-audit-pending.jsonl` | 同上 |
| Task state | `data/tasks/*.json` | reaper 清孤儿 (cycle-3 fix) |
| Discord pinned msg ID | `data/bulk/pinned-message.json` | 重启读 ID 继续 edit · 丢了重 post 新 pinned |

**单 query 最多浪费：** docker SIGKILL 中段 → reaper 标 failed → 重试 attempt=2 → 切 Places API。损失 ~1-2min。

---

## 7. #website-tasks 可视化设计（核心 · 你日常看的）

### (a) Pinned 主帖（feeder edit · 永远活的）

```
🛠 Bulk Pipeline · Roofing AU · LIVE

Status        ✅ running · last fed 12 min ago
Pool          1247 / 28,820 fed (4.3%) · P1 (2/13 region 完)
Today         8 / 50 queries · 96 entities · 14 A/B audited
Now           "roof restoration Brisbane QLD" → run 20260514-2317
Next ETA      ~17 min

Health        feeder ✓ · dispatcher ✓ · docker ✓ · detail-queue 14
Throttle      —

Last 5 fed
  ✓ 23:17  "roof restoration Brisbane QLD"      → 11 leads · A=1 B=2 C=4 D=4
  ✓ 22:48  "metal roofing Gold Coast QLD"       →  9 leads · B=2 C=3 D=4
  ✓ 22:19  "emergency roof repair Sunshine"     →  7 leads · A=0 B=1 C=2 D=4
  ✓ 21:50  "roof leak repair Brisbane QLD"      → 13 leads · A=2 B=3 C=4 D=4
  ✓ 21:21  "roofing contractor Moreton Bay"     →  8 leads · B=1 C=3 D=4

Day 24 · 26 天稳定运行 · 更新 5 min 前
```

### (b) Per-feed reply（feeder 每投一个发 1 行 · 同一 thread）

Feeder 在 pinned 主帖 reply：
```
🌊 23:47 fed · "ridge capping Brisbane QLD"
   task 20260514-2347-a3f1 · run #lead-discovery-runs/3092
```

完成时再回一条（短）：
```
✓ 23:51 done · 8 leads · A=0 B=2 C=3 D=3
```

### (c) Sentinel hourly heartbeat（同 thread · 1 行）
```
💓 00:00 · feeder ✓ · today 14/50 · D 占比 65% (正常) · all green
```

### (d) Red-gauge alert（独立 message · 不 edit pinned · 不在 thread）
```
⚠ 03:14 · BULK PIPELINE PAUSED
  Reason: docker 5 次连续失败 (IP block 嫌疑)
  Action: 已切 Places API fallback · 下次轮询 03:44 重试 docker
  Manual: rm data/bulk/STOP 强制恢复 · 或 launchctl unload 紧急停
```

### Discord 实现细节
- Pinned message ID 存 `data/bulk/pinned-message.json`
- Feeder 用 discord.js `channel.messages.edit(id, content)` 更新
- 主帖如果被删 / 不可访问 → 自动重 post 新的 pinned
- 走现有的 `core/funnel/discord.js` token bucket · 不会刷屏

---

## 8. 失败 / 限速 / 异常处理（完整矩阵）

| 场景 | 自动行为 | 通知 |
|------|---------|------|
| docker exit !=0 / timeout | retry 1 次（同 query） | feed-state 记 attempt=1 |
| docker 第 2 次失败 | 切 Places API fallback 跑同 query | event=fallback_places |
| docker 全天连失 5 次 | feeder pause 1h | #website-tasks red alert |
| Places API quota 用完 | 标 query.status=blocked 跳过 | red alert |
| Tinyfish 429 (cheap-audit) | 已有 backoff (现有代码) | hourly heartbeat 记 |
| dispatcher 死 | launchd KeepAlive 拉起 + reaper 清孤儿 | daemon-doctor 下次跑报警 |
| Feeder 死 | launchd KeepAlive 拉起 | sentinel 检测 heartbeat 缺 > 2 周期 → alert |
| Mac CPU > 4.0 持续 1 hour | feeder pause 30min | hourly heartbeat 记 |
| Mac 睡眠/重启 | 醒后 launchd 全自动恢复 | 无特殊处理 |
| Grade 异常 (D > 90% / 24h) | sentinel auto-pause feeder · 等人 review | red alert |
| GitHub repo 拉不到 | 用本地缓存 pool-snapshot | 24h 没拉到才 alert |
| Discord API 429 | discord.js bucket 自动 backoff | 静默处理 |
| 队列单 entity stuck > 30min | reaper 标 failed · 现有逻辑 | log warn |

---

## 9. 启动 / 暂停 / 紧急停 / 手动操作

| 操作 | 命令 |
|------|------|
| **启动** | `launchctl load ~/Library/LaunchAgents/ai.profitslocal.v3.bulk-feeder.plist` |
| **优雅暂停** | `touch data/bulk/STOP`（feeder 下次醒来看到就 sleep） |
| **恢复** | `rm data/bulk/STOP` |
| **紧急停** | `launchctl unload ai.profitslocal.v3.bulk-feeder.plist` |
| **手动投 N 个** | `npm run bulk:feed -- --count 5` |
| **查状态** | `npm run bulk:status`（或看 #website-tasks pinned） |
| **dry-run（不真投）** | `BULK_DRY_RUN=1 npm run bulk:feed -- --count 1` |
| **强制 git pull** | `npm run bulk:pool-rebuild` |
| **清今日 quota（重置）** | `rm data/bulk/quota.json` |

---

## 10. 整合点（复用现有 · 不重写）

| 已有模块 | 怎么用 |
|---------|--------|
| `core/util/token-bucket.js` | feeder 内部限速 |
| `core/finance/ledger.js` | 跟踪 free credit 消耗（visibility） |
| `core/tasks/task-store.js` createTask | 直接调用 · 复用 dispatcher + reaper |
| `core/tasks/task-store.js` reapStaleRunningTasks (cycle-3) | 孤儿 task 自动清 |
| `cheap-audit-queue` / `detailed-audit-queue` | 自动 backpressure |
| `core/funnel/lead-thread-sync.js` | per-entity thread 已实现 |
| `core/funnel/discord.js` | pinned message edit · per-feed reply |
| `scripts/cli/pl-lead-journey-doctor.js` | sentinel 调用做健康检查 |
| `data/leads/discovery-events.jsonl` | sentinel 算 grade 分布 |
| `data/leads/queues/*.jsonl` | feeder 监控 detail backlog |
| launchd plist 模式 | 仿照 `pl-task-dispatcher.launchd.plist` |

**0 重写。** 唯一新增是 Layer 0-3 的几个新文件。

---

## 11. 时间预估（保守）

| 阶段 | 时间 |
|------|------|
| 每天 | 50 query × 10 lead = 500 entity · 75 A/B → 75 audit ✓ |
| P1 全 region (≈ 2000 query) | **40 天** |
| 全 roofing 28,820 | **~1.6 年** |
| Detail audit 容量 | 200/day · 永远跟得上 50/day intake |

**不是 deadline 任务。** Matthew 说停就停。

---

## 12. 实施文件清单（5 新文件 · 2 plist · 0 改动现有）

```
# 新增（实施时才写 · 现在零代码）
scripts/cli/pl-bulk-feeder.js            ~300 行
scripts/cli/pl-bulk-sentinel.js          ~200 行
scripts/cli/pl-bulk-pool-rebuild.js      ~150 行
scripts/cli/pl-bulk-status.js            ~100 行 (npm run bulk:status)
scripts/bulk/discord-pinned-message.js   ~150 行 (主帖 edit 逻辑)

# State 文件（feeder/sentinel 写）
data/bulk/leads-repo/                    git clone
data/bulk/pool-snapshot.json
data/bulk/feed-state.jsonl
data/bulk/feed-cursor.json
data/bulk/quota.json
data/bulk/pinned-message.json
data/bulk/STOP                           (touch 即生效)

# Launchd
~/Library/LaunchAgents/ai.profitslocal.v3.bulk-feeder.plist
~/Library/LaunchAgents/ai.profitslocal.v3.bulk-sentinel.plist

# package.json scripts
"bulk:feed":          "node scripts/cli/pl-bulk-feeder.js"
"bulk:sentinel":      "node scripts/cli/pl-bulk-sentinel.js"
"bulk:pool-rebuild":  "node scripts/cli/pl-bulk-pool-rebuild.js"
"bulk:status":        "node scripts/cli/pl-bulk-status.js"
```

---

## 13. 实施顺序（拍板后）

1. `git clone` leads-repo · 验证 13 CSV 可读
2. 写 `pl-bulk-pool-rebuild.js` · 跑一次输出 `pool-snapshot.json` · 检查排序 P1→P2→P3
3. 写 `pl-bulk-feeder.js` · `BULK_DRY_RUN=1` 模式跑通 · 不真 createTask
4. 写 `discord-pinned-message.js` · 在 #website-tasks 发测试 pinned · edit 验证
5. 切 dry-run off · launchctl load feeder · 看 1 个真 query 跑通
6. 写 `pl-bulk-sentinel.js` · launchctl load sentinel
7. 观察 24h · 调阈值
8. 稳定后只看 Discord 警报

---

## 14. 不做的事（红线）

- ❌ 一次性梭哈跑完
- ❌ 自动改 docker daily cap
- ❌ 看到 429 硬冲重试
- ❌ 跑 non-roofing niche（Matthew 拍板了只 roofing）
- ❌ 重写 scoring / audit / demo build
- ❌ 自动越过 Places API 配额上限
- ❌ 自动接受 niche 异常（D > 90% 强制 pause 等人）
- ❌ 修改 leads-repo 的 CSV（只读消费）

---

## 15. 检查清单 · 实施前最后过

- [x] Dokobot 已退役 · 确认 Tinyfish 活的
- [x] docker daily cap = 50（Matthew 拍板）
- [x] 撤 budget gauge（codex/claude CLI 订阅 · Places 免费 credit）
- [x] 24h 跑 · 撤 quiet hours · 保留 CPU gauge 防烧
- [x] Query 源 = `github.com/matthew6688/profitslocal-leads`
- [x] 只 roofing · 13 region CSV 全消费
- [x] 排序 P1 → P2 → P3
- [x] 可视化在 #website-tasks（existing channel）
- [x] Per-feed reply 同一 thread (cleaner)
- [x] feed-state.jsonl append-only · 100% 断电续传
- [x] 复用现有 cycle-3 reaper · 8-key dedup · queue throttle
- [x] 0 改动现有代码

---

## 16. 待 Matthew 开工指令

文档完整 · 0 决策悬而未决 · 等一句「开工」就动手按 §13 顺序实施。

期间任何 Matthew 想调的：DAILY_DOCKER_CAP / 阈值 / pinned 格式 / 警报触发 · 都改 plan 不动代码。
