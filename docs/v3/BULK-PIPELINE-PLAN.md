# V3 D43+ Bulk Pipeline Plan · 溪水长流

> 状态：PLAN ONLY · 不实施 · 等 Matthew review + 拍板 5 件事
> 创建：2026-05-14 cycle-3 后
> 目标：3500 query × 平均 10 lead = 35K entity · 永续 pipeline · 不烧 mac · 断电续传

---

## 1. 核心原则

- **不是 burst·是 stream**：不一次跑完，每天细水投递
- **docker 优先 · Google Places fallback**（成本理由 + Matthew 决策）
- **下游决定上游**：detailed-audit-queue 瓶颈 5-10min/entity，上游永远跟着下游节奏
- **任意时刻 kill 安全**：所有状态持久化，重启 resume，孤儿 task 由 reaper 清
- **可视化第一**：看不到的进度不算进度

---

## 2. 真实速率约束（已读代码核实）

| 来源 | 文件 | 当前限速 | 备注 |
|------|------|---------|------|
| Docker maps scraper | `scripts/leads/maps-scraper-discovery.js` | 无内建 · spawnSync docker | 单 IP 经验值 ~50 query/day · 有 `MAPS_SCRAPER_PROXIES` env 可冲量 |
| Tinyfish | `core/extractors/tinyfish.js` | 30/min token bucket | `TINYFISH_RATE_PER_MIN` env 可调 |
| Dokobot | `core/scrape/dokobot.js` | 30/min token bucket | `DOKOBOT_RATE_PER_MIN` env 可调 |
| Google Places API | ledger `google_places` | 100K req/day (付费) | fallback 用 |
| cheap-audit-queue | `core/leads/cheap-audit-queue.js` | 3s gap · 1 concurrent | `CHEAP_AUDIT_INTER_MS` |
| detailed-audit-queue | `core/leads/detailed-audit-queue.js` | 30s gap · 1 concurrent · 优先级排序 | `DETAIL_AUDIT_INTER_MS` |
| Discord (listener emit) | discord.js token bucket | 5 burst · 1.2s refill / channel | |

**真正的瓶颈：detailed-audit（5-10min/entity · 单线程）。**  
35K entity × 15% A/B 比例 × 7min = **~600 小时 = 25 天连跑**（白天 16h）= 约 3-4 个月跑完。

---

## 3. 体系架构（4 层）

```
┌─ Layer 0 · Query Pool (durable, resume-safe) ──────────────────┐
│  data/bulk/query-pool.jsonl                                    │
│  { query, niche, city, fed_at, status,                         │
│    attempts, last_error, leads_found }                         │
│  · 3500 行 · static · 投过的标 fed_at · 永不重复               │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─ Layer 1 · Feeder daemon (永动) ───────────────────────────────┐
│  scripts/cli/pl-bulk-feeder.js                                 │
│  ai.profitslocal.v3.bulk-feeder.plist (KeepAlive)              │
│                                                                │
│  每 5min 醒来：                                                │
│   1. 读 5 个 gauge (见 §4)                                     │
│   2. 任一红 → 写日志 + sleep                                   │
│   3. 全绿 → 读下一个 fed_at=null query                         │
│   4. createTask(kind=intake, cli=leads:maps-scrape, args=...)  │
│   5. 写 fed_at + quota -1                                      │
│   6. 失败 attempts++ · 3 次后切 Places API fallback            │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼ task (走现有 pipeline · 不动)
       discovery → cheap-audit-queue → predict-grade
         · D → archived
         · A/B → detailed-audit-queue (优先级)
         · C → cold backlog
       → detailedAudit → demo-build → publish
                       │
                       ▼
┌─ Layer 2 · Sentinel (hourly cron) ─────────────────────────────┐
│  scripts/cli/pl-bulk-sentinel.js                               │
│  ai.profitslocal.v3.bulk-sentinel.plist (StartCalendarInterval)│
│                                                                │
│  每小时跑一次：                                                │
│   · pgrep feeder · 死了拉起来                                  │
│   · 调用 lead-journey-doctor (10 不变量)                       │
│   · grade 分布 (last 24h) · D 占比 > 90% 警告                  │
│   · 预算 today (ledger) · > 80% warning · > 100% pause feeder  │
│   · 发 hourly heartbeat 到 bot-log                             │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼ visualization
┌─ Layer 3 · Visualization (4 处) ───────────────────────────────┐
│  (a) #lead-discovery-runs · per-day thread · live edit message │
│  (b) #website-leads · per-entity thread (已实现 D43)           │
│  (c) terminal dashboard · pl-bulk-status (watch friendly)      │
│  (d) bot-log · sentinel hourly + alert on red gauge            │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Feeder 的 5-Gauge 决策

任一红 → sleep · 全绿 → 投一个

| Gauge | 数据源 | 红线 | 默认 |
|-------|--------|------|------|
| **docker 今日配额** | `data/bulk/quota.json` 计数器 | 当日 ≥ DAILY_DOCKER_CAP | 50 (单 IP) |
| **running tasks** | `core/tasks listTasks({status:'running'})` | > 3 | 3 |
| **detail-queue pending** | `data/leads/queues/detailed-audit-pending.jsonl` 行数 | > 20 | 20 |
| **today spend** | `data/finance/ledger.jsonl` filter today sum | > DAILY_CAP_USD | $5 |
| **mac CPU** | `os.loadavg()[0]` | > 4.0 | 4.0 |

所有阈值走环境变量，不写死。

---

## 5. 持久化 & 断电续传

| 状态 | 文件 | 重启行为 |
|------|------|---------|
| Query pool | `data/bulk/query-pool.jsonl` | 读 fed_at=null 的下一个 |
| Daily quota | `data/bulk/quota.json` (`{date, docker_used, places_used}`) | 跨天自动 reset |
| Cheap-audit queue | `data/leads/queues/cheap-audit-pending.jsonl` | `loadQueueOnStart` 已实现 |
| Detail-audit queue | `data/leads/queues/detailed-audit-pending.jsonl` | 同上 |
| Task state | `data/tasks/*.json` | dispatcher reaper 清孤儿 (cycle-3 fix) |
| Feeder cursor | 写 `fed_at` 到 query-pool 那一行 | 重启不重复投 |

**唯一会浪费的：detailedAudit 跑到一半被 SIGKILL → reaper 标 failed → 自动重试入队。**  
单 entity 最多浪费 ~5min，可接受。

---

## 6. 可视化设计（4 层）

### (a) `#lead-discovery-runs` per-day thread
每天 00:00 sentinel 开一条 thread：`Bulk Pipeline · Day N · YYYY-MM-DD`。
Feeder 每投一个 query 都 **edit 同一条 message**（不刷屏）。Sentinel 每小时追加快照。

```
🌊 Bulk Pipeline · Day 23 / 25
Pool         2842 / 3500 fed (81%) · 658 remaining
Today        8 queries · 96 entities · 14 audited
  Predict    A=2 B=4 C=3 D=3 (today)
Audit queue  detail pending 14 · running 1 · ETA 7h
Spend        $2.14 / $5.00 today · $87.20 all-time
Health       ✓ feeder ✓ dispatcher ✓ docker · 1 warn (Tinyfish 429 once)
```

### (b) `#website-leads` per-entity thread
**不动**。D43 已实现：每 entity 开 thread，5 stage message 推进。

### (c) Terminal dashboard `pl-bulk-status`
单文件输出（box-drawing），可 `watch -n 30` 跑。和 (a) 内容一样但本地秒级刷新。

### (d) `bot-log` 心跳 + 警报
- 每小时 sentinel 投 1 行心跳（不刷屏）
- 任意 gauge 变红 → 立即 alert + 详细原因 + suggested action

---

## 7. 失败 / 限速 / 异常处理

| 场景 | 自动行为 | 通知 |
|------|---------|------|
| Docker 失败（IP block 等） | attempts++ · 3 次失败切 Google Places API · 全失败标 query.status=failed | Discord alert |
| Tinyfish 429 (远端) | 已有 backoff · feeder 不投新 query 直到下次轮询 | hourly heartbeat 记 |
| 预算超 daily cap | feeder 自动 pause（不投新的）· 已 enqueue 的继续跑 | Discord alert |
| Mac CPU > 4.0 持续 10min | feeder sleep 30min | hourly heartbeat 记 |
| Dispatcher 死 | launchd 自动拉起 + reaper 清孤儿 | daemon-doctor 报警 |
| Grade 分布异常（D > 90%） | sentinel 自动 pause feeder · 等人 review niche 配置 | Discord alert |
| 队列单 entity stuck > 30min | reaper timeout 后标 failed · 重新入队 | log warn |

---

## 8. 启动 / 暂停 / 紧急停

| 操作 | 命令 |
|------|------|
| 启动 | `launchctl load ~/Library/LaunchAgents/ai.profitslocal.v3.bulk-feeder.plist` |
| 优雅暂停 | `touch data/bulk/STOP` → feeder 下次醒来看到 STOP 文件就 sleep（已 enqueue 的继续跑） |
| 恢复 | `rm data/bulk/STOP` |
| 紧急停 | `launchctl unload ai.profitslocal.v3.bulk-feeder.plist` |
| 完全清空 | unload feeder + sentinel · 队列 jsonl 自然 drain · 不丢数据 |

---

## 9. Query Pool 生成

需要 Matthew 拍板：
1. **niche 列表**（roofer, plumber, dentist, restaurant, ...）— 几个？
2. **city 列表**（brisbane, melbourne, sydney, ...）— 哪些 AU 城市？
3. **粒度**（suburb 级 vs city 级）— suburb 量大 + 命中率高但 Google 限速风险
4. **3500 query 怎么算**：niche × city / suburb 矩阵填到 3500

候选生成方式：
- (i) 手写一份 `niches.txt` + `cities.txt` → 笛卡尔积
- (ii) 复用 `data/leads/queries/` 已有 query 列表（如果有）

---

## 10. 整合点（不重写已有）

| 已有 | 复用方式 |
|------|---------|
| `core/util/token-bucket.js` | feeder 自身限速 `getBucket('bulk-feeder', { ratePerMinute: 0.2 })` |
| `core/finance/ledger.js` | feeder 写 `category:'bulk_feeder'` 跟踪 |
| `core/tasks/task-store.js` | createTask 直接复用 · 不绕 listener |
| reaper (cycle-3 fix) | 孤儿 task 自动清 |
| `cheap-audit-queue` + `detailed-audit-queue` | 自动 backpressure |
| `core/funnel/lead-thread-sync.js` | per-entity thread 已实现 |
| `scripts/cli/pl-lead-journey-doctor.js` | sentinel 调用做健康检查 |
| `data/leads/discovery-events.jsonl` | sentinel 算 grade 分布 |
| launchd plist 模式 | 仿照 `pl-task-dispatcher.launchd.plist` |

**不需要重写：scoring · grading · audit · demo build · publish · Discord embeds。**

---

## 11. 时间预估

| 阶段 | 投速 | entity 产出 | A/B 占比 | detailed 完成 |
|------|------|------------|---------|--------------|
| 每天 | 8 query/day | ~96 entity/day | ~15% = 14 | ~14 detailed/day |
| 25 天 | 3500 query 投完 | ~35K entity | ~5K A/B | ~5K detailed pending |
| 3-4 个月 | — | — | — | 全部 A/B audited |

调投速：DAILY_DOCKER_CAP 调大（前提是有 proxy 池 / IP 不被封）

---

## 12. 要 Matthew 拍板的 5 件事

| # | 决策 | 默认建议 |
|---|------|---------|
| 1 | DAILY_DOCKER_CAP (单 IP query/day) | 50 |
| 2 | DAILY_CAP_USD (每日预算软上限) | $5 |
| 3 | 运行时段 | 8am–10pm (夜间 mac 降温) |
| 4 | Query pool 怎么生成？niche × city 你给清单还是我推？ | 等指示 |
| 5 | 可视化优先级 (a)(c) 先做哪个？ | (a) Discord thread（你不用开终端） |

---

## 13. 待实施清单（5 个新文件 · 2 plist · 不动现有）

```
scripts/cli/pl-bulk-feeder.js          (~250 行)
scripts/cli/pl-bulk-sentinel.js        (~200 行)
scripts/cli/pl-bulk-status.js          (~150 行 dashboard)
scripts/bulk/generate-query-pool.js    (~80 行 · 从 niche+city 生成 pool)
data/bulk/quota.json                   (state · feeder 写)
data/bulk/query-pool.jsonl             (3500 行 · static)
~/Library/LaunchAgents/ai.profitslocal.v3.bulk-feeder.plist
~/Library/LaunchAgents/ai.profitslocal.v3.bulk-sentinel.plist
```

零修改现有代码（除非发现 bug）。

---

## 14. 实施顺序（拍板后）

1. 生成 query-pool.jsonl（Matthew 给 niche+city）
2. 写 feeder + sentinel + status · DRY_RUN 模式跑通
3. Matthew 看 dashboard + Discord visualization 一天 dry-run
4. 改成真 createTask · launchd load
5. 第一周天天看 dashboard · 调阈值
6. 稳定后只看 sentinel 的 Discord 警报

---

## 15. 不做的事

- ❌ 一次性梭哈跑完
- ❌ 自动改预算 / 自动 force-push
- ❌ 看到 429 硬冲重试
- ❌ 夜间跑（不让 mac mini 烧）
- ❌ 重写 scoring / audit / demo build
- ❌ 自动越过 Google Places API 配额上限
- ❌ 自动接受 niche 异常（D > 90% 强制 pause 等人）
