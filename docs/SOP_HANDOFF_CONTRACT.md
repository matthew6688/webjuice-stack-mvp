# SOP-1 → SOP-2 数据交接合约

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: `/admin/scoring/sop-1` + `/admin/scoring/sop-2`（双向链接）
**Source code**: `core/leads/discovery-store.js`（schema 唯一定义在这里）

---

## 0. 一句话

SOP-1 写完一个 lead 后，**这份合约定义 SOP-2 能依赖什么字段、可空字段怎么处理、什么是 schema 违规**。改 schema 必须改本文档 + bump `schemaVersion`。

---

## 1. 物理交接

```
┌────────────────────────────────────────────────────────────────┐
│  SOP-1 内部 4 步                                                │
│  ────────────────────                                           │
│  Step 1  Discovery (gosom / image-lead 入口) → entity 写入      │
│  Step 2  Dedup (place_id auto-merge + phone/domain 嫌疑队列)    │
│  Step 3  Enrichment (thin-contact → 5 路 search; Places API)    │
│  Step 4  Handoff payload 落地                                   │
│                                                                  │
│  出口物：                                                        │
│  data/leads/entities/<entityKey>.json    × N 个文件              │
│  data/leads/queues/cheap-site-audit.json (待审计队列)            │
│  data/leads/queues/selected-enrichment.json                     │
│  data/leads/queues/outreach-brief.json                          │
│  data/leads/discovery-events.jsonl       (审计日志)              │
│  data/leads/discovery-index.json         (dedup 索引)            │
│  data/leads/dedup-review-queue.json      (嫌疑撞库)              │
└─────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  SOP-2 读入口                                                   │
│  ────────────                                                   │
│  读上面所有文件; 不直接调 SOP-1 的代码 (松耦合)                  │
│  按 status === 'queued_for_audit' 筛选 → cheap-audit-v2 跑       │
│  按 cheap-audit action === 'audit_candidate' → Stage 2 (SOP-2)  │
└────────────────────────────────────────────────────────────────┘
```

### 1.1 SOP-1 出口承诺（写明合约）

SOP-1 交付给 SOP-2 的每个 entity 都保证：

1. ✅ **Dedup-clean**：`place_id` 唯一、`phone` / `domain` 重复已经过操作员裁决
2. ✅ **Contact-complete**：有 `phone` OR `website`，或者显式 `enrichment_status: 'unenrichable'`
3. ✅ **Schema 合规**：所有必填字段（见 §5）已填或显式 null
4. ✅ **batch_id 已 stamp**：可追溯到来源 batch

如果 SOP-2 拿到 entity 不符合上述任一条 → 是 SOP-1 bug，需要回 SOP-1 修。SOP-2 不该兜底。

**关键设计原则**：
- SOP-1 / SOP-2 **不共享代码**，只共享 JSON 文件
- 这意味着 SOP-1 可以独立替换 backend（gosom → outscraper 等），SOP-2 完全无感
- 反之 SOP-2 升级 audit 规则也不影响 SOP-1

---

## 2. Entity Schema · 每字段详解

### 2.1 顶层字段

| 字段 | 类型 | 必填 | 来源 | SOP-2 怎么用 |
|---|---|---|---|---|
| `schemaVersion` | int | ✅ | 常量 `1` | bump 时跑 migration |
| `entityKey` | string | ✅ | `place_<id>` (gosom) / `image_<slug>_<phone>` (image-lead V2) | 主键 · 所有下游引用 |
| `firstSeenAt` | ISO8601 | ✅ | upsert 时第一次见 | 老 lead 优先级降低 |
| `lastSeenAt` | ISO8601 | ✅ | 最近一次 upsert | 6 个月没动 → 自动 archive |
| `status` | enum (8) | ✅ | V1 状态机 — discovery 写 | 筛 `queued_for_audit` |
| `lastStatusAt` | ISO8601 | ✅ | status 上次变更 | — |
| `phase` | enum (8) | ⚠️ 可空（write-on-transition）| V2 状态机 — `setEntityPhase()` 显式写入；不从 status 隐式推导 | 销售用；缺失 = 尚未进入 V2 phase 状态机 |
| `phaseChangedAt` | ISO8601 | ⚠️ 可空（与 `phase` 同时写）| `setEntityPhase()` 触发时写 | — |

### 2.2 `identifiers` · 多键匹配（dedup 核心）

| 字段 | 类型 | 必填 | 来源 | 用途 |
|---|---|---|---|---|
| `place_id` | string | ⚠️ 强烈推荐 | gosom CSV | 主 dedup key（Google 全球唯一）|
| `cid` | string | 可空 | gosom CSV | secondary Google ID |
| `data_id` | string | 可空 | gosom CSV | tertiary Google ID |
| `websiteDomain` | string | 可空 | normalize from `lead.website` | dedup secondary (跨源撞库)|
| `phoneDigits` | string | 可空 | normalize from `lead.phone`（只 10+ 位数字）| dedup secondary |

**SOP-2 责任**：
- `place_id` 缺失（image-lead 路径）→ 接受，但 cheap-audit 的 niche-match 校验可能 SKIP（[SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)）
- `phoneDigits` 缺失 → cheap-audit reachability = false → 走 `queued_for_enrichment`

### 2.3 `latest` · 最新快照（SOP-2 主要消费）

| 字段 | 类型 | 必填 | 来源 | SOP-2 怎么用 |
|---|---|---|---|---|
| `sourceType` | enum | ✅ | `maps_scraper` / `image_lead` / `places_api` | 不同 source 走不同 audit 子路径 |
| `name` | string | ✅ | normalize | master.md 主标题 |
| `category` | string | ⚠️ 高频缺 | gosom 单 category | niche-substring 判定 (SOP-2) |
| `categories` | array | 可空 | gosom 多 category | 多分类容错 |
| `address` | string | ⚠️ | gosom | 评论搜索 + 域名验证 |
| `city` | string | ⚠️ | gosom 或 run | niche-match scoring (SOP-2) |
| `niche` | string | ✅ | run.niche 强制 | 触发 niche-specific rules |
| `phone` | string | ⚠️ 高频缺 | gosom | outreach + reachability score |
| `website` | string | ⚠️ 高频缺 | gosom | Stage 2 audit 入口 (SOP-2)；缺则起步路径 |
| `google_maps_url` | string | ⚠️ | gosom 或 generated | evidence pack |
| `rating` | float / null | ⚠️ | gosom | grade level 信号 |
| `review_count` | int / null | ⚠️ | gosom | grade A/B 必要条件 (≥ 30) |
| `websiteStatus` | enum | ✅ | normalize (`reachable` / `no_website` / `third_party_landing_page` / ...) | cheap-audit hard triggers |
| `discoveryScore` | float [0, 1] | ✅ | gosom normalize | rescore 排序 |
| `recommendedAction` | enum | ⚠️ | gosom 计算 | cheap-audit 初始假设（会重算）|
| `sourceQuery` | string | ✅ | **bridge 强制 = run.query** | 追溯本 lead 来自哪个 batch query |
| `signals.{hasPhone, hasWebsite, hasImage, ...}` | object | ✅ | normalize | cheap-audit 快查 |
| `batch_id` | string | ⚠️ G-3 新增 | run.batchId 或 lead.batch_id | filter 本批 vs 老批 |
| `places_enrichment` | object / null | 可空（Places API 触发后才有）| Places API Details Basic | 增强 audit（types[] / photos / E.164 phone）|
| `sales_signals.best_contact_time` | object / null | 可空（G-14 · `pl:places-enrich` 后衍生）| `core/leads/sales-contact-time.js`（解析 `places_enrichment.opening_hours_verified.weekday_text`）| 销售推销时段判断：`{ suggested_window, confidence, rationale, weekday_summary }` |
| **`enrichment_status`** | enum | ✅ SOP-1 必写 (自动) | `mergeLeadIntoEntity` 写 | 新 entity 默认 `'pending'`；有 phone OR website 自动升 `'complete'`；`pl:run-enrichment-batch` 跑完后改 `'complete'`/`'partial'`/`'unenrichable'`。**Legacy 缺字段视作 `'complete'`** (backwards-compat) |
| **`contact_identity`** | object / null | 可空 (Phase B `pl:run-enrichment-batch` 后填) | enrichLead() output 合并 | 实际 schema 见下 §2.3.1（real-test 2026-05-12 确认）|

### 2.3.1 `latest.contact_identity` 完整 schema（real-test 验证 2026-05-12）

**Source**: `enrichLead()` 返回的 `profile.contact` + adjacent fields, 合并到 entity 时按此 shape:

```js
entity.latest.contact_identity = {
  phone:    string,    // profile.contact.phone (可能与 latest.phone 一致或更准)
  website:  string,    // profile.contact.website (5 路 search 后可能仍空)
  social: {
    facebook:  string | '',
    instagram: string | '',
    linkedin:  string | '',
  },
  decision_maker:        null | { name, title, source },   // 多数 entity 为 null
  third_party_reviews:   [],   // hipages/yelp/productreview/truelocal/houzz
  evidence_sources: [          // 审计轨迹 - 哪个 route 给的哪个字段
    { field, source, route, url, title, profile_score }
  ],
  enriched_at: ISO8601,
}
```

### 2.3.2 `enrichment_status` 决定逻辑（real-test 确认）

`pl:run-enrichment-batch` 跑完每个 entity 后按此规则写状态:

```js
const hasContact = !!(profile.contact.phone || profile.contact.website);
const hasSocial  = Object.values(profile.contact.social || {}).some(Boolean);
const succeeded  = profile.enrichment_trace.queries_succeeded;

if (hasContact || hasSocial)  → 'complete'
else if (succeeded > 0)        → 'partial'    // 跑了但没拿到联系方式
else                            → 'unenrichable' // 所有 route 都失败
```

**Real-test evidence** (Regan Brothers Roofing, 2026-05-12):
- 6/6 routes succeeded · cost $0 · 22 total results
- Found: phone (GBP), social.instagram, social.facebook
- Website 仍为空（不是所有商家都有官网）
- Status: `'complete'`（满足 hasContact + hasSocial）
- Fixture: `data/v2/fixtures/enrichment/place_chijd28ojc37k2sr-3f5yimly-4.json`

### 2.4 `runs[]` · 历史 discovery runs

每个元素：
```
{ runId, query, runPath, at (ISO8601), discoveryScore, recommendedAction }
```
- 至多 20 条，超出截断
- SOP-2 用途：审计哪个 run 抓到这个 lead

### 2.5 `batches[]` · 累计被哪些 batch 抓到（G-3）

字符串数组，最多 20 个 batch_id

### 2.6 `history[]` · 事件流

```
{ at, event, ... }
```
事件类型：
- `seen_in_discovery_run` — 每次 upsert
- `places_enrichment_added` — G-7
- `grade_assigned` — SOP-2 写
- `discord_thread_opened` — SOP-2 A/B 自动写
- ...
至多 100 条

### 2.7 SOP-2 写入字段（SOP-1 不读这些）

| 字段 | 时机 | 写法 |
|---|---|---|
| `grade` | gradeLead 完成 | `{ investment_level: A/B/C/D, product_tier: T1/T2/T3, recommended_pricing, skip_reasons, graded_at }` |
| `discord_thread_id` | A/B 自动开 thread | string |
| `discord_profile_message_id` | A/B 开 thread 后 | string |
| `audit` | Stage 2 完成 (SOP-2) | `{ score, dimension_scores, decision, hard_triggers, issues, audited_at }` |
| `visual_audit` | claude vision 完成 | `{ score, findings, audited_at }` |

---

## 3. Status 状态机（V1 · discovery 用）

10 个值（`DISCOVERY_ENTITY_STATUS`，`core/leads/discovery-store.js` L38-48；外加 `merged` 由 `pl:dedup-merge` 写入）：

1. `discovered` — 初始
2. `scored` — discoveryScore 算完
3. `queued_for_audit` — cheap-audit decision=audit_candidate ✅ SOP-2 入口筛
4. `queued_for_enrichment` — 没 contact，待补
5. `ready_for_outreach_brief` — enrichment 完成 + grade 已写，待销售
6. `promoted` — 已升入销售流程
7. `skipped` — niche 不准 / 太差
8. `manual_review` — 30-69 分边界 / 异常 fallback
9. `contacted` — 销售已触达
10. `merged` — 被 `pl:dedup-merge` 合并到 winner（loser 标记）

**升级规则** (`shouldPromoteStatus`): status 单向往"更深"走，不可回退（除非 archive 重启）。`STATUS_RANK` 见同文件 L68-78。

---

## 4. Phase 状态机（V2 · sales 用）

8 个 phase (`ENTITY_PHASE` enum，`core/leads/discovery-store.js` L55-64)。**字面值为小写连字符**（操作员复制粘贴写入时注意）：

1. `awaiting` — 等销售触达
2. `outreach-active` — 销售在跟
3. `replied` — 客户回复
4. `proposal-sent` — 报价已发
5. `nurture` — 长线培育
6. `paid` — 成交
7. `archived` — 归档
8. `needs-human` — 需要人工介入

A/B grade → 自动 `awaiting`，C → 不动（批量轻触），D → `archived`。

---

## 5. SOP-2 入口必填校验

SOP-2 跑 cheap-audit-v2 前应该校验：

| 字段 | 必填 | 缺失行为 |
|---|---|---|
| `entityKey` | ✅ | 跳过（不可能）|
| `latest.name` | ✅ | 跳过 + 推警报 |
| `latest.niche` | ✅ | 跳过（normalize bug）|
| `latest.sourceQuery` | ✅ | 跳过（bridge bug）|
| `latest.websiteStatus` | ✅ | 默认 `no_website` |
| `identifiers.place_id` | ⚠️ | OK（image-lead 没有）|
| `latest.phone` | ⚠️ | OK，标 reachability=false |
| `latest.website` | ⚠️ | OK，触发 `no_website_with_contact` hard trigger |
| `latest.rating` / `review_count` | ⚠️ | OK，gradeLead 用 0 兜底 |

**未来工作 G-8.1**: 写 `pl:handoff-verify --entity-key X` CLI，输入 entity 输出"SOP-2 是否能安全处理"判定 + 缺什么字段。

---

## 6. Schema 版本协议

- 当前 `schemaVersion: 1`
- 改 schema 必须：
  1. 改 `discovery-store.js` 写入
  2. bump `schemaVersion`
  3. 写 migration script `scripts/migrations/<n>-to-<n+1>.js`
  4. 改本文档章节 2
  5. 通知 SOP-2 owner（页面顶 banner 标 stale 直到 SOP-2 校验完）

---

## 7. 实战字段缺失统计（live snapshot）

详见 `/admin/scoring/sop-1` "Merged Entity Schema" section（B2 阶段加，TODO）

---

## 8. 相关文档

- SOP-1 详细: [`SOP_1_INTAKE_DISCOVERY.md`](SOP_1_INTAKE_DISCOVERY.md)
- SOP-2 详细: [`SOP_2_LEAD_DISCOVERY_PIPELINE.md`](SOP_2_LEAD_DISCOVERY_PIPELINE.md)
- 工具矩阵: [`SOP_X_TOOLING.md`](SOP_X_TOOLING.md)
