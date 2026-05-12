# SOP-1 · 客户发现 Intake & Discovery

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-1`](/admin/scoring/sop-1)
**调研笔记**: [`data/qa/sop-investigations/sop-1.md`](../data/qa/sop-investigations/sop-1.md)
**状态**: ✅ v1.0 · Q2-Q5 检查点已 review，工具 G-1/G-2/G-3 + 入口 G-6 已落地

---

## 1. 目的 · Purpose

SOP-1 覆盖**从"没有 lead"到"dedup-clean + enrichment-complete 的 entity 入库"**这一段。

**SOP-1 出口承诺给 SOP-2**：交付的每个 entity 都是：
- 已去重（place_id auto-merge + phone/domain 嫌疑过审核）
- 联系方式齐全（有 phone OR website，或显式 `enrichment_status: 'unenrichable'`）
- 字段 schema 符合 [SOP-X-Handoff](SOP_HANDOFF_CONTRACT.md)

**做什么**（4 步）：
1. **Discovery 入口** — gosom Docker scraper / image-lead V2 写入 entity store
2. **Dedup** — auto-merge by place_id + 检测 phone/domain 嫌疑入队列（协议详解 → [SOP-X-Dedup](SOP_X_DEDUP.md)）
3. **Enrichment** — thin-contact (`!phone && !website`) → 5 路 search 补全 / Places API 增强 (3b)
4. **Handoff** → 把 entity 交给 SOP-2

**不做什么**：
- 不做 audit 评分 / grade 计算（→ SOP-2）
- 不做销售对接（→ SOP-4）
- 不做 master.md / profile 生成（→ SOP-ART-1 / SOP-ART-3）

---

## 2. 两个 Discovery 入口

> ⚠ **Places API 不是入口** — 它是 §3 Step 3b 的 **增强工具**，作用于已经入库的 entity，不产生新 lead。

| 入口 | CLI | 输出 | 用途 |
|---|---|---|---|
| **gosom Docker scraper** (主流量) | `npm run pl:scrape-docker -- --niche X --city Y --count N` | `data/leads/entities/place_<id>.json` | 我们去找 Google Maps 上的客户 |
| **image-lead V2** | `npm run pl:ingest-image -- --image PATH --business-name X --phone Y --niche --city` | `data/leads/entities/image_<slug>_<phone>.json` | 网上只能找到图片格式（名片 / 店面 / 海报）时的 ingest 路径 |

### 2.1 image-lead V2 vs V1（重要）

- **V2** (`pl:ingest-image`) — 入 entity store，走 SOP-1 全流程，跟 gosom 同等公民
- **V1** (`scripts/leads/image-lead-discovery.js`) — 旧的"客户送上门"服务模式，写 `clients/<slug>/`，**不进 entity store**。保留用于已付费客户的 single-lead 服务流程。
- 决策：V2 是新发现入口；V1 不下线，但**新发现工作走 V2**。

OCR 自动从图片提取字段（businessName/phone/address）— 当前由调用方手填 `--business-name` 等 flag。自动化是 **G-6.1（待建）**。

### 2.2 Scraper Fallback Strategy（🟡 TODO · G-11）

**当前问题**：gosom Docker 容器离线 → 整个发现链断了。

**计划的 fallback chain**（尚未实现）：

```
gosom Docker (本地, T0)
   ↓ 失败 / 离线
Outscraper / Apify (T2 metered, ~$0.001-0.005/record · 待接)
   ↓ 失败
Google Places API Text Search (T0, 在配额内·部分覆盖)
   ↓ 失败
报警停止 + 等修复
```

`ops:health-check` 已经会检测 gosom Docker 离线 + 推 Discord。
后续 G-11 实施时，`pl:scrape-docker` 会自动 fall-over 到下一级 provider。

详见 [SOP-X-Tooling §1.1](SOP_X_TOOLING.md#11-discovery--scraping) fail-over 表 + overview backlog G-11。

---

## 3. 主入口操作链路 · gosom Docker scraper

```
[1] POST /api/v1/jobs           (keywords + max_time ≥ 180)
       ↓ 返回 job_id
[2] poll GET /api/v1/jobs/{id}  until status === "ok"  (~3-5 分钟)
       ↓
[3] GET /api/v1/jobs/{id}/download → CSV
       ↓
[4] BRIDGE: parse CSV → rename 3 fields → JSONL
       ↓ (pl:scrape-docker 桥脚本完成 1+2+3+4)
[5] data/maps-scraper/runs/<runId>/results.maps.json
       ↓
[6] npm run leads:maps-scrape -- --input <path> --query "..." --niche --city --batch-id X
       ↓ (pl:scrape-docker 自动调用)
[7] upsertDiscoveryRun → writeEntity + appendEvents + rebuildDiscoveryIndex
       ↓
[8] buildDiscoveryQueues  → queues / cheap-site-audit / selected-enrichment / outreach-brief
```

**1 行命令跑完全链路**：
```
npm run pl:scrape-docker -- --niche roofing --city sydney --count 20 --batch-id roofing-syd-20260512
```

### 3.1 容器现状

```
container:  gmaps-scraper-web   (gosom/google-maps-scraper:latest)
ports:      0.0.0.0:8080 → 8080
mounts:     ./data/maps-scraper/webdata → /gmapsdata
spec:       http://localhost:8080/static/spec/spec.yaml
```

### 3.2 API 速查

| 操作 | endpoint |
|---|---|
| 创建 scrape | `POST /api/v1/jobs` body `{ name, keywords:[], lang, zoom, depth, max_time, fast_mode, radius }` |
| 状态 | `GET /api/v1/jobs/{id}` |
| 下载 CSV | `GET /api/v1/jobs/{id}/download` |
| 删除 | `DELETE /api/v1/jobs/{id}` |

### 3.3 字段命名规整（CSV vs JSONL）

`pl:scrape-docker` 自动完成 3 个字段重命名：

| CSV 字段 | JSONL 字段 |
|---|---|
| `website` | `web_site` |
| `longitude` | `longtitude` (历史拼写错误，保留兼容) |
| `descriptions` | `description` |

`core/leads/maps-scraper-discovery.js#normalizeMapsScraperRow` 已兼容两套命名。

### 3.4 sourceQuery 规则

**Bridge 强制 `lead.sourceQuery = run.query`**。下游不依赖 lead-level 推断，统一来源 = batch query。这避免"这 lead 是哪个 query 抓的"歧义。

---

## 3.5 Pipeline Step 2 · Dedup

**触发**：每个 batch finalize 之后（自动 hook 进 `pl:pipeline-batch-step --finalize`，G-X 待实现）。
**协议详解** → 见 [SOP-X-Dedup](SOP_X_DEDUP.md)。
**SOP-1 范围**：保证 entity store 不再有 place_id 重复 + 把 phone/domain 嫌疑入 review queue。

执行：
- `place_id` 撞 → `mergeLeadIntoEntity` 已经自动合并（写入路径既有逻辑）
- `phone` / `domain` 撞 → 写 `data/leads/dedup-review-queue.json`，由操作员决策（合并 / 不同 / 跳过）

---

## 3.6 Pipeline Step 3 · Enrichment

**职责**：保证每个交付给 SOP-2 的 entity 都有完整的联系方式，或显式标 `unenrichable`。

### 3.6.1 thin-contact predicate

在 SOP-1 内部判定，不依赖 SOP-2:

```js
function isThinContact(entity) {
  return !entity.latest.phone && !entity.latest.website;
}
```

如果 `isThinContact(entity)` 为 true → 触发 Step 3a 5 路 search 补全。

### 3.6.2 Step 3a · Contact enrichment (5 路 search · T0)

**目的**：补 social handles + contact-us URL + 真正的网站。

**5 路并行**：
1. 官方 URL search（lead 可能 GMB 没挂网站但实际有）
2. Facebook handle
3. Instagram handle
4. LinkedIn handle / decision-maker name
5. 3rd-party review aggregators (hipages / yelp / productreview / truelocal / houzz)

**Provider**：DDGS (T0) → Tinyfish (T2) fall-over。详见 [SOP-X-Tooling §1.1](SOP_X_TOOLING.md#11-discovery--scraping)。

**输出**：写到 `entity.latest.contact_identity`（schema 字段见 SOP-X-Handoff）+ 写 `data/v2/fixtures/enrichment/<entityKey>.json` 审计轨迹。

### 3.6.3 Places API 增强 · 不属于 SOP-1 主链（post-handoff · 由 SOP-2 触发）

> ⚠ **不在 SOP-1 4 步主链里**。Places API 补全（photos / types[] / E.164 phone / verified opening_hours）只在 grade ≥ B 之后由 SOP-2 回流调起 — 详见 [SOP-2](SOP_2_LEAD_DISCOVERY_PIPELINE.md)。
>
> SOP-1 出口承诺只到 `contact_identity` + `enrichment_status` — Places 增强是销售素材层，不阻塞 handoff。

涉及的工具（供查阅，**调用方是 SOP-2 / 销售流，不是 SOP-1**）：
- `pl:places-enrich --entity-key X` — Place Details Basic（multi-key rotation G-12 ✅；月配额 11K hard cap，见 [SOP-X-Tooling §2](SOP_X_TOOLING.md#2-places-api--成本控制详)）；输出写 `entity.latest.places_enrichment`
- **G-14 sales-contact-time** (✅ 2026-05-12) — `pl:places-enrich` 自动衍生：解析 `opening_hours_verified.weekday_text` → `entity.latest.sales_signals.best_contact_time`（详见 `core/leads/sales-contact-time.js`）
- **G-13 photo pipeline** (✅ 2026-05-12) — `pl:download-places-photos`：Place Photos API → Cloudinary → `entity.latest.places_enrichment.photo_urls[]` → master.md "一(a) 商户视觉素材" 段

### 3.6.4 Enrichment status

**实现** (C5-Phase-A · 2026-05-12)：

`mergeLeadIntoEntity` 写入 `entity.enrichment_status`:

| 值 | 触发 |
|---|---|
| `pending` | 默认（新 entity，无 phone 也无 website）|
| `complete` | 有 phone OR website 自动升级；或 `pl:run-enrichment-batch` 跑完成功 |
| `unenrichable` | `pl:run-enrichment-batch` 跑完仍无联系方式（待 C5-Phase-B 实现）|
| `partial` | 备用值 — 当前未自动写入 |

**Backwards-compat**：旧 entity 没此字段 → `buildDiscoveryQueues` 视作 `'complete'`（legacy default），不阻塞 SOP-2 audit。

**Queue gate** (`isEnrichmentReady`) 在 `buildDiscoveryQueues` 生效：只有 `'complete'` 或 `'unenrichable'` 才进 `cheap-site-audit.json`。`'pending'` entity 等 `pl:run-enrichment-batch` 跑完才能进。

SOP-2 收到 entity 时**只 care** 这个 status，不重新跑 enrichment 判定。

---

## 4. 批次任务管理 · Discord forum thread

每个 batch（`pl:pipeline-batch-start` → `pl:pipeline-batch-step` → finalize）：

| 步骤 | 命令 | 副作用 |
|---|---|---|
| 1. 开 batch | `pl:pipeline-batch-start --niche roofing --city sydney --count 10` | `#lead-discovery-runs` 开 forum thread + apply tag `in-progress` + 落 `data/v2/pipeline-batches/<batch-id>.json` |
| 2. 每 stage 完 | `pl:pipeline-batch-step --batch-id X --stage "..." --status ok --summary "..."` | thread 追加 message + 状态文件更新 |
| 3. 结束 | `... --finalize --swap-tag completed` | swap forum tag |

**6 个 forum tag** (`#lead-discovery-runs` 已设好)：🔵 in-progress · ⏸️ paused · ✅ completed · ⚠️ partial-failed · 🔁 retry-pending · ❌ aborted

### 4.1 batch_id 传播

`pl:pipeline-batch-start` 生成 batch_id（如 `roofing-syd-20260512-0942`）→ 透传到 `pl:scrape-docker --batch-id` → 每个 entity 的 `latest.batch_id` 字段被 stamp。

**用途**：Hermes / Discord 可以靠 `entity.latest.batch_id === X` 筛选"本批的 lead"，不用扫所有 entity。

---

## 5. SOP-1 写入 entity store 的字段（视角：写入侧）

> ⚠ **完整 entity schema 不在本文档**。schema 字段定义、status/phase 状态机、必填校验 → 见 [`SOP_HANDOFF_CONTRACT.md`](SOP_HANDOFF_CONTRACT.md)（**SOP-X-Handoff owns**）。
>
> 本节只列 **SOP-1 自己关心的字段**（即 SOP-1 写入的那些）：

| 字段 | SOP-1 怎么写 |
|---|---|
| `entityKey` | gosom: `place_<id>` · image-lead V2: `image_<slug>_<phone>` |
| `latest.sourceType` | `maps_scraper` / `image_lead` / `places_api`（看入口）|
| `latest.sourceQuery` | **强制 = `run.query`**（bridge 统一，见 §3.4）|
| `latest.batch_id` | 从 `pl:scrape-docker --batch-id` 传入；G-3 字段 |
| `batches[]` | 累计被哪些 batch 抓到（最多 20，de-dup）|
| `runs[]` | 每次 upsert append；最多 20，自动截断 |
| `status` | 初始 `discovered` → cheap-audit-v2 升级到 `queued_for_audit`（**status 完整 8 值 + 升级规则在 [Handoff §3]**）|
| `latest.places_enrichment` | 仅 `pl:places-enrich` 触发后写入（G-7）— 子对象结构在 [Handoff §2.3]|

**SOP-1 不写**：`grade` / `phase` / `audit` / `visual_audit` / `discord_thread_id`（这些 SOP-2 拥有写入权）。

---

## 6. 跨 niche / city 扩展策略

🟡 **当前默认 + 待补**:
- 每个 batch 默认抓 **10-20 lead**（`--count`）
- niche 列表：roofing / plumbing / pest control / lawn care / cleaning（实战常用）
- city schedule：手动指定，无 cron 自动 rotate
- 跨 country：当前只跑 AU（Sydney/Brisbane/Melbourne），US/CA 待 SOP-1 v1.1 设定

待定义的策略（这里只描述当前实战，不强制）：
- daily quota：每天跑多少 batch？
- backoff：相同 niche+city 上次抓后多久才重抓？
- 优先级：高 grade 批 vs 探索批的算力分配

---

## 7. 常见失败 + retry（SOP-1 范围内）

| 失败模式 | 表现 | mitigation |
|---|---|---|
| `max_time < 180` | API 返回 422 `max time must be more than 3m` | `pl:scrape-docker` 内置 `Math.max(180, ...)` 强制下限 |
| Docker 容器死 | 8080 端口连接拒绝 | `pl:preflight` 检测 + 提示 `docker restart gmaps-scraper-web`；同时 `ops:health-check` 会推 Discord |
| 同 lead 重复抓 | 多 query 命中同 place_id | `discoveryEntityKey` dedup + `mergeLeadIntoEntity` 合并 |
| Discord forum tag 未建 | `applied_tags` API 422 | 一次性 bot setup |
| image-lead 没 phone | OCR 提不到电话 | 用 `image_<slug>_nophone` 兜底 key + 标 phase: NEEDS_HUMAN |

**SOP-1 范围外**（这些归 SOP-2 拥有，本文档不重述）：
- niche substring 误判 / `relevance_pass` SKIP → 见 [SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)
- 没 website 的 lead → `starter_candidate` 路径 → 见 [SOP-2 §6](SOP_2_LEAD_DISCOVERY_PIPELINE.md#6-容易忽略的点)
- GMB 无 category 时 niche_match SKIP → 见 [SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)

---

## 8. 容易忽略的点（SOP-1 owned）

| # | 坑 | 范围 |
|---|---|---|
| 1 | place_id 撞库 auto-merge 已经发生在 mergeLeadIntoEntity，**Step 2 dedup 不会再处理它**，只看 phone/domain | SOP-1 §3.5 |
| 2 | image-lead V2 (G-6 ✅) 已 port 到 V2 entity store | SOP-1 §2.1 |
| 3 | `max_time` 必须 ≥ 180 — gosom API hard limit | SOP-1 §7 |
| 4 | `sourceQuery` 强制 = `run.query` — bridge 统一来源 | SOP-1 §3.4 |
| 5 | Discord channel 必须先建好 6 个 forum tags — bot setup 一次性 | SOP-1 §4 |
| 6 | image-lead 没 phone → 用 `image_<slug>_nophone` 兜底 key | SOP-1 §2.1 |
| 7 | thin-contact predicate 是 SOP-1 内部判，**不再依赖 SOP-2 cheap-audit-v2** | SOP-1 §3.6.1 |
| 8 | Places API 月度配额 hard cap (11K calls)，超 → enrichment 3b 暂停 | SOP-X-Tooling §2 |

**SOP-1 范围外的坑**（归其他 SOP 拥有）：
- Niche substring 误判 / `relevance_pass` → SOP-2 §3.3
- 没 website 的 lead `starter_candidate` → SOP-2 §6
- V1 status + V2 phase 状态机 → [SOP-X-Handoff §3-§4](SOP_HANDOFF_CONTRACT.md)
- ContactIdentity 多触点超 social 的扩展 → SOP-ART-3 (待写)

---

## 9. 工具实现状态

| ID | 内容 | 状态 |
|---|---|---|
| **G-1** | `pl:scrape-docker` CLI (POST → poll → CSV → bridge → leads:maps-scrape) | ✅ 2026-05-12 |
| **G-2** | `pl:preflight` CLI (容器/PSI/Discord/claude_cli/ollama/磁盘) | ✅ 2026-05-12 |
| **G-3** | Entity schema 加 `latest.batch_id` + `batches[]` | ✅ 2026-05-12 |
| **G-6** | image-lead V2 入口 (`pl:ingest-image`) | ✅ 2026-05-12 |
| **G-6.1** | image-lead OCR/VLM 自动 extract（当前 caller 手填）| ❌ backlog |
| **G-4** | `entity.contact_identity` 多触点 + 强制补 social | → SOP-ART-3 |
| **G-5** | Starter_candidate 自动化 | → SOP-2 后续 |

---

## 10. 同步状态 · Code ↔ Doc ↔ Page

### 10.1 已实现 + 同步

| 项 | 代码 | 本文档 | Admin 页面 |
|---|---|---|---|
| gosom Docker 主入口 + `pl:scrape-docker` | ✅ | ✅ §3 | ✅ flow Step 1 |
| image-lead V2 (`pl:ingest-image`) | ✅ | ✅ §2.1 | ✅ flow Entry 2 |
| `pl:preflight` (G-2) | ✅ | ✅ §7 | — |
| `entity.latest.batch_id` + `batches[]` (G-3) | ✅ | ✅ §5 | ✅ payload viz |
| `pl:pipeline-batch-*` CLI | ✅ | ✅ §4 | — |
| sourceQuery 强制规则 | ✅ bridge | ✅ §3.4 | ✅ payload viz |
| Places enrichment (G-7) | ✅ `pl:places-enrich` | ✅ §3.6.3 | ✅ flow Step 3b |
| Places API 多账号 rotation (G-12) | ✅ `pl-places-enrich.js` multi-key | ✅ §3.6.3 | — |
| Places photos → master.md asset library (G-13) | ✅ `pl:download-places-photos` (done 2026-05-12) | ✅ §3.6.3 | — |
| opening_hours → sales-time signal (G-14) | ✅ `core/leads/sales-contact-time.js` (done 2026-05-12) | ✅ §3.6.3 | — |
| **isThinContact predicate** (C5) | ✅ `core/leads/thin-contact.js` | ✅ §3.6.1 | ✅ flow decision diamond |
| **出口契约字段 + gate** (C5-Phase-A) | ✅ mergeLeadIntoEntity + buildDiscoveryQueues | ✅ §3.6.4（字段 schema 见 Handoff §2.3） | ✅ payload viz |
| **`pl:dedup-audit` finalize hook** (C5-Phase-A) | ✅ pl-pipeline-batch-step.js | ✅ §3.5 | — |
| **`pl:run-enrichment-batch`** (C5-Phase-B) | ✅ new CLI | ✅ §3.6 | — TODO admin trigger 页 |
| **分层模型 fallback 注释** (C5-Phase-C) | ✅ inline 注释 (详情 → SOP-2) | ✅ §3.6 | — |

### 10.2 未实现（pending — 见 §12 Backlog）

| 项 | 状态 |
|---|---|
| G-11 scraper fallback chain (outscraper/apify) | ❌ |
| G-6.1 image-lead OCR/VLM 自动 extract | ❌ |
| G-18 Hermes cron 注册周期检查任务 (详 → SOP-X-Tooling) | 🔵 cron 骨架已建（SOP-0 v1.7）· ops:health-check job 未注册 |
| 跨 niche/city rotation 正式策略 | ❌ (§6 仅当前实战) |

**结论**: SOP-1 出口契约（dedup-clean + enrichment-complete）端到端可执行。Backlog 见 §12。

---

## 11. Decision Records

| ID | 决策 | 日期 |
|---|---|---|
| D-SOP1-1 | image-lead **port 到 V2**（不是侧门），与 gosom 平级。OCR auto-extract 是后续增强 G-6.1。 | 2026-05-12 |
| D-SOP1-2 | ContactIdentity 多触点 → **SOP-ART-3**（不在 SOP-1 范围）。SOP-1 只记 phone+website+gmb_url。 | 2026-05-12 |
| D-SOP1-3 | `sourceQuery` 强制 = `run.query`，bridge 时统一。下游不依赖 lead-level 推断。 | 2026-05-12 |
| D-SOP1-4 | G-1 / G-2 / G-3 / G-6 同一 sprint 落地，不分阶段。 | 2026-05-12 |
| D-SOP1-5 | V1 image-lead-discovery.js 保留（已付费客户 single-lead 服务模式仍用），不下线。 | 2026-05-12 |

---

## 12. Backlog (SOP-1 v1.1+)

- **G-6.1** OCR/VLM 自动从图片提取 businessName/phone/address（用 Claude vision 或 Tesseract）
- **跨 country**：US/CA niche+city schedule
- **cross-batch dedup**：同 batch_id 内 dedup vs 跨 batch dedup 策略
- **starter_candidate 自动化**（→ SOP-2 后续 G-5）
- **跨 niche rotation cron**：daily quota + backoff schedule
