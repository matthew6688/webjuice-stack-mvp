# SOP-1 调研笔记 / Investigation Note · 客户发现 Intake & Discovery

调研日期：2026-05-12
作者：Claude（4-step protocol Step 1）
对应 SOP：SOP-1 客户发现 / Intake & Discovery
状态：**待 Matthew review — 确认现状描述正确后，才写 SOP-1 v0.1**

---

## 调研方法

- 读了 `core/leads/discovery-store.js` / `core/leads/maps-scraper-discovery.js` / `scripts/leads/maps-scraper-discovery.js` / `scripts/leads/image-lead-discovery.js` / `scripts/cli/pl-pipeline-batch-*.js` / `core/funnel/pipeline-batch-thread.js`
- 探了正在跑的 Docker 容器 `gmaps-scraper-web` (gosom/google-maps-scraper:latest, 0.0.0.0:8080)
- 读了 OpenAPI spec `http://localhost:8080/static/spec/spec.yaml`
- 实测：跑了一个 verify scrape (job id `742a120c-f7c9-4dde-9fe2-f784010b28d9`)，20 个 roofing sydney leads，CSV 输出 3 分钟
- 读了 `data/leads/entities/<key>.json` 1 个真实样本（FIX MY ROOF）

---

## 1. 现状：3 个入口

### 1.1 主入口 · gosom Docker scraper

**这是日常主力流量。** 跑通过的实际数据：roofing+sydney 20 leads / 3 分钟，CSV 34 列字段全。

容器现状：
```
container:  gmaps-scraper-web (running, up 2 days)
image:      gosom/google-maps-scraper:latest
ports:      0.0.0.0:8080 → 8080
mounts:     ./data/maps-scraper/webdata → /gmapsdata (SQLite jobs.db 落地)
env:        PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
```

API（OpenAPI 3.0）：
- `POST /api/v1/jobs` → 创建 scrape 任务，body `{ name, keywords:[], lang, zoom, depth, max_time, fast_mode, radius, email, proxies }`，返回 `{ id }`
- `GET /api/v1/jobs` → 列所有
- `GET /api/v1/jobs/{id}` → 单 job 状态 (working / ok)
- `GET /api/v1/jobs/{id}/download` → 下载 CSV
- `DELETE /api/v1/jobs/{id}` → 删除

**已知限制**：
- `max_time` ≥ 180 秒（< 180 返回 422 `"max time must be more than 3m"`）
- 输出是 **CSV**（不是 JSONL）

CSV 字段（实测）：
```
input_id, link, title, category, address, open_hours, popular_times,
website, phone, plus_code, review_count, review_rating,
reviews_per_rating, latitude, longitude, cid, status, descriptions,
reviews_link, thumbnail, timezone, price_range, data_id, place_id,
images, reservations, order_online, menu, owner, complete_address,
about, user_reviews, user_reviews_extended, emails
```

字段与 V1 历史 JSONL 格式的**命名差异**：
- `website` (CSV) ↔ `web_site` (JSONL)
- `longitude` (CSV) ↔ `longtitude` (JSONL · 历史拼写错误)
- `descriptions` (CSV, 复数) ↔ `description` (JSONL, 单数)

`core/leads/maps-scraper-discovery.js#normalizeMapsScraperRow` 已经兼容两种命名（`row.web_site || row.website` / `row.longtitude || row.longitude`），所以 CSV → JSONL 转换是 cosmetic（重命名 3 字段），不动 logic。

### 1.2 补充入口 · image-lead-discovery

CLI: `node scripts/leads/image-lead-discovery.js --input data/lead-image.json`

输入 schema：
```json
{ "businessName": "...", "phone": "...", "image_path": "...", "clientSlug": "?" }
```

调用链：
- 读 input
- 调 `core/evidence/evidence.js` 建 evidence pack
- 调 `core/leads/lead-ops.js#runLeadOps` 跑 V1 lead-ops 流程
- 输出：
  - `clients/<slug>/lead/discovery-log.jsonl`
  - `clients/<slug>/evidence/`
  - `clients/<slug>/outreach/`

**重要观察**：这条路**走的是 V1 lead-ops（不是 V2 entity store）**，不会进 `data/leads/entities/<key>.json`，也**不会走 cheap-audit-v2 评级**。是直入服务模式（单 lead 个性化）。

### 1.3 实验入口 · 关键词 search

**当前状态**：实际上"关键词 search"就是 gosom Docker scraper 的 `keywords:[]` 参数。Matthew 说这条是"可以 search 某些词"——本质和主入口同源。

未来如果 Matthew 想加一条"非 Google Maps 的 search 路径"（例如直接 Google search → 抓 GMB → 入库），那是 SOP-1 v0.2 范围，目前不存在。

---

## 2. 现状：从 scrape 输出到 entity store 的完整链路

```
[1] POST /api/v1/jobs  (POST keywords + maxtime)
       ↓ 返回 job_id
[2] poll GET /api/v1/jobs/{id}  until status === "ok"
       ↓ (通常 3-5 分钟)
[3] GET /api/v1/jobs/{id}/download → CSV
       ↓
[4] BRIDGE: parse CSV → rename 3 fields → JSONL
   (这一步当前没有 CLI! 是 SOP-1 实施时要建的 pl:scrape-docker 桥脚本)
       ↓
[5] write to data/maps-scraper/runs/<runId>/results.maps.json
       ↓
[6] npm run leads:maps-scrape -- --input <path> --query "..." --niche --city
       ↓ 跑 readMapsScraperJsonl + normalizeMapsScraperRow + buildMapsScraperDiscoveryRun
       ↓
[7] upsertDiscoveryRun(run, { storeRoot })
       ↓
       ├─ writeEntity()  → data/leads/entities/<key>.json
       ├─ appendEvents() → discovery-events.jsonl
       └─ rebuildDiscoveryIndex() → discovery-index.json
       ↓
[8] buildDiscoveryQueues({ storeRoot })
       ↓
       └─ writes data/leads/queues/{queues, cheap-site-audit,
            selected-enrichment, outreach-brief}.json
```

**步骤 4 的"桥"是当前缺失的部分**。当前要从 Docker scraper 拿 lead 到 entity store，需要手动跑 curl + 转换 + 移动文件。`pl:scrape-docker` CLI 是 SOP-1 实施时建的工具。

---

## 3. Entity schema (实测样本 FIX MY ROOF)

```json
{
  "schemaVersion": 1,
  "entityKey": "place_chijn587yc79k2sr7vyvy-egoam",
  "firstSeenAt": "2026-05-09T14:36:00Z",
  "lastSeenAt": "2026-05-11T18:43:00Z",
  "status": "queued_for_audit",     ← V1 状态字段 (8 个值)
  "lastStatusAt": "...",
  "phase": "needs-human",            ← V2 状态字段 (8 phase)
  "phaseChangedAt": "...",
  "identifiers": {
    "place_id": "ChIJ...",
    "cid": "11790712864532420333",
    "data_id": "0x6b93fd2e603b9f9f:0xa3a106e1631556ed",
    "websiteDomain": "billdu.me",
    "phoneDigits": "0410607076"
  },
  "latest": {
    "sourceType": "maps_scraper",
    "name": "FIX MY ROOF Total Roof Restorations",
    "category": "Roofing contractor",
    "categories": [...],
    "address": "...",
    "city": "Brisbane",
    "niche": "roofing",
    "phone": "...",
    "website": "http://billdu.me/...",
    "google_maps_url": "...",
    "rating": 5,
    "review_count": 127,
    "websiteStatus": "third_party_landing_page",
    "discoveryScore": 0.85,
    "recommendedAction": "audit_candidate",
    "sourceQuery": "roof restoration in Brisbane",
    "signals": { hasPhone, hasWebsite, ... }
  },
  "runs": [ ... 历史 discovery runs ],
  "history": [ ... 事件流 ],
  "grade": { ... },                  ← Stage 2 grade 写入
  "discord_thread_id": "...",        ← A/B 自动开 thread 后写
  "discord_profile_message_id": "..."
}
```

**两个状态字段共存**（V1 status + V2 phase）。**目前没有 batch_id 字段**——这是 SOP-1 实施时要扩展的：每个 batch 跑下来的 lead 都 tag 上 batch_id 区分本批 vs 老批。

---

## 4. Discord ops 视角 · 批次发现任务怎么发布

现状：`pl:pipeline-batch-start` + `pl:pipeline-batch-step` 已经建好（smoke test 通过）。

每个 batch：
1. `pl:pipeline-batch-start --niche roofing --city sydney --count 10`
   - 在 `#lead-discovery-runs` (channel ID `1503513633756283070`) 开 forum thread
   - apply tag `in-progress`
   - 落 `data/v2/pipeline-batches/<batch-id>.json` state file
2. 每 stage 完跑 `pl:pipeline-batch-step --batch-id X --stage "..." --status ok --summary "..."`
3. 末尾 `--finalize --swap-tag completed`

**6 个 forum tag 已经在 channel 配好**：
- 🔵 in-progress · ⏸️ paused · ✅ completed · ⚠️ partial-failed · 🔁 retry-pending · ❌ aborted

---

## 5. 容易忽略的点（实战中踩过的坑）

### 5.1 Niche 不准
- `core/scoring/cheap-audit-v2.js` 用 `category.includes('oof')` 这种 substring 判 roofing
- 偶尔抓到 "Roofer's Bar" 这种被误判进
- mitigation: cheap-audit 阶段 `relevance_pass` 校验会 SKIP，不会污染 audit pipeline
- **但 entity 仍入库**——所以 entity 数 ≠ 真实候选数

### 5.2 同 lead 重复抓
- 不同 query 可能抓到同一个 place_id
- `discoveryEntityKey(lead)` = `place_${place_id}` 是 dedup key
- `readEntity()` 优先复用，`mergeLeadIntoEntity()` 合并历史
- `entity.runs[]` 累计所有抓到它的 query

### 5.3 V1 vs V2 状态二元
- `entity.status`（V1, 8 值）和 `entity.phase`（V2, 8 phase）是两套独立状态机
- discovery 写 `status`，sales 状态机用 `phase`
- 两套都得维护——SOP-X-PhaseTransitions 必须把这个讲清楚

### 5.4 没有 website 的 lead
- 不会直接 skip
- cheap-audit-v2 输出 `starter_candidate`（如果 reachable + gbp_quality ≥ 30）or `queued_for_enrichment`（contact 也缺）
- starter_candidate 路径目前**未完全自动化**（已记入 SOP-2 §6 容易忽略的点）

### 5.5 Image lead 不进 V2 主流程
- image-lead-discovery.js 走 V1 lead-ops，不入 V2 entity store
- 不走 cheap-audit-v2 评级
- 是"客户直接送上门"模式，不是"我们去找"模式
- SOP-1 要明确这是**侧门**，不是主入口

### 5.6 max_time 必须 ≥ 180 秒
- gosom API hard limit
- 试过 `max_time: 60` 直接 422
- 实战建议 240-300 秒（roofing+city 跑下来需要 2-3 min）

### 5.7 ContactIdentity 多触点缺失
- 当前 entity 只记 phone + website + google_maps_url
- 没记 social handles (FB/IG/LinkedIn)、contact-us URL
- enrichment 路径（cheap-audit `queued_for_enrichment`）能补，但触发条件是"没 phone 也没 website"
- A/B/C 级有 phone+website 的 lead **不会触发 enrichment**，所以 social handles 仍缺
- 这影响 SOP-4 销售对接的多触点能力
- → **SOP-ART-3 Profile/ContactIdentity 必须扩展 entity schema 强制补 social handles**（即使触发 enrichment 路径外）

### 5.8 sourceQuery 是关键追溯字段
- `entity.latest.sourceQuery` 记录抓到这个 lead 的搜索词
- 跨 niche / city 扩展时，靠这字段筛选
- 但 normalize 时 `lead.sourceQuery || run.query` 优先取 lead-level（如果 gosom 输出含），fallback run-level
- → 建议在 bridge 脚本里**强制** `lead.sourceQuery = run.query`，统一来源

### 5.9 Discord channel 必须先建好 forum tags
- 6 个 tag 不存在时 `applied_tags` API 调用会 422
- 一次性 setup：用 bot PATCH channel.available_tags
- 当前 `#lead-discovery-runs` 已设好（lead-discovery-runs 创建时跑过 setup 脚本）

### 5.10 Niche category 字段读不到
- 当 GMB 没设 category 时 `entity.latest.category` 为空字符串
- cheap-audit-v2 的 niche_match 会 SKIP
- 真实碰到过 1-2 次（某些老 GMB profile）
- mitigation: 手动 enrichment 补 niche，或人工 review

---

## 6. 当前没解决 / SOP-1 实施时要建的东西

| ID | 内容 | 工程量 |
|---|---|---|
| **G-1** | `pl:scrape-docker` CLI (POST job → poll → download CSV → 转 JSONL → 调 leads:maps-scrape) | ~1h |
| **G-2** | `pl:preflight` CLI (容器存活 / PSI / Discord / claude_cli / ollama / 磁盘检查) | ~30min |
| **G-3** | Entity schema 加 `batch_id` 字段（mergeLeadIntoEntity + bridge 透传）| ~20min |
| **G-4** | (跨 SOP) `entity.contact_identity` 多触点字段 + enrichment 强制补 social | SOP-ART-3 范围 |
| **G-5** | Starter_candidate 自动化（SOP-2 §6 已记） | SOP-2 后续优化 |
| **G-6** | image-lead-discovery 是否要并入 V2 主流程 | 长期 roadmap |

---

## 7. SOP-1 v0.1 应该包含的章节（写完调研后的提议）

1. **目的** — 这一段流程做什么 / 不做什么
2. **3 入口对比表** — Docker / image / search (当前都是 keyword)
3. **Docker scrape 完整操作步骤** (8 步链路图)
4. **批次任务管理** (Discord forum thread + state file)
5. **Entity schema** (含 V1 status + V2 phase + 待加的 batch_id)
6. **常见失败 + retry** (Docker 死 / API timeout / niche 不准 / max_time<180)
7. **跨 niche / city 扩展策略** (待 Matthew 补；目前没有正式策略)
8. **容易忽略的 10 条** (§5 全部)
9. **维护协议** (改流程 → 改 SOP-1 doc + admin/scoring/sop-1 页)
10. **Decision records**

---

## 8. Review 检查点（给 Matthew）

请你确认或纠正：

1. **3 入口现状描述准吗**？特别"关键词 search"我理解成就是 gosom keywords 参数——你说"可以 search 某一些词，后续我再完善"，是这个意思吗？还是有其他 search 路径？
2. **image-lead-discovery 走 V1 不进 V2 主流程**——这个判断对吗？还是它已经 ported 到 V2 我没找到？
3. **5.7 ContactIdentity 多触点缺失**——你说"客户的 profile 我们是要包括 social 还有 contact us 页面"——这个 gap 应该归到 SOP-ART-3 还是 SOP-1 里展开？
4. **5.8 sourceQuery 强制 = run.query**——这个 normalize 规则要不要写进 SOP-1 v0.1？
5. **6.G-1 / G-2 / G-3 三个工具 SOP-1 实施时建**——OK 吗？还是分离到 Phase 2（先写 SOP-1 文档，工具下一轮再建）？
6. **§7 章节结构**——还要加什么 / 删什么？

回这 6 个，我写 SOP-1 v0.1。
