# SOP-1 · 客户发现 Intake & Discovery

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-1`](/admin/scoring/sop-1)
**调研笔记**: [`data/qa/sop-investigations/sop-1.md`](../data/qa/sop-investigations/sop-1.md)
**状态**: ✅ v1.0 · Q2-Q5 检查点已 review，工具 G-1/G-2/G-3 + 入口 G-6 已落地

---

## 1. 目的 · Purpose

SOP-1 覆盖**从"没有 lead"到"entity 已入库 + 有初始信号"**这一段。

**做什么**：
- 用 gosom Docker scraper 从 Google Maps 抓 raw leads（主入口）
- 用 image-lead V2 路径从图片提取 leads（OCR/VLM 入库）
- normalize 字段 → 写入 V2 entity store
- 跑 discovery queue 重建（cheap-site-audit / selected-enrichment / outreach-brief）
- 在 Discord `#lead-discovery-runs` 开 batch thread 记录进度，stamp `batch_id` 到每个 entity

**不做什么**：
- 不做 audit 评分（→ SOP-2）
- 不做 grade 计算（→ SOP-2）
- 不做销售对接（→ SOP-4）
- 不做 master.md / profile 生成（→ SOP-ART-1 / SOP-ART-3）
- 不做 contact identity 多触点扩展（→ SOP-ART-3）

---

## 2. 三个 V2 入口对比

| 入口 | CLI | 输出 | 进 V2 store | 用途 |
|---|---|---|---|---|
| **gosom Docker scraper** (主流量) | `npm run pl:scrape-docker -- --niche X --city Y --count N` | `data/leads/entities/place_<id>.json` | ✅ | 我们去找 Google Maps 上的客户 |
| **image-lead V2** (新入口 · 2026-05-12) | `npm run pl:ingest-image -- --image PATH --business-name X --phone Y --niche --city` | `data/leads/entities/image_<slug>_<phone>.json` | ✅ | 网上只能找到图片格式（名片 / 店面 / 海报）时的 ingest 路径 |
| **关键词 search** | 同主入口（gosom `keywords[]` 参数） | 同主入口 | ✅ | 当前与主入口同源；未来"非 Google Maps search" 是 v0.2 范围 |

### 2.1 image-lead V2 vs V1（重要）

- **V2** (`pl:ingest-image`) — 入 entity store，走 cheap-audit-v2 评级，跟 gosom 同等公民
- **V1** (`scripts/leads/image-lead-discovery.js`) — 旧的"客户送上门"服务模式，写 `clients/<slug>/`，**不进 entity store**。保留用于已付费客户的 single-lead 服务流程。
- 决策：V2 是新发现入口；V1 不下线，但**新发现工作走 V2**。

OCR 自动从图片提取字段（businessName/phone/address）— 当前由调用方手填 `--business-name` 等 flag。自动化是 **G-6.1（待建）**。

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
| image-lead 没 phone | OCR 提不到电话 | 用 `image_<slug>_unknown` 兜底 key + 标 phase: NEEDS_HUMAN |

**SOP-1 范围外**（这些归 SOP-2 拥有，本文档不重述）：
- niche substring 误判 / `relevance_pass` SKIP → 见 [SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)
- 没 website 的 lead → `starter_candidate` 路径 → 见 [SOP-2 §6](SOP_2_LEAD_DISCOVERY_PIPELINE.md#6-容易忽略的点)
- GMB 无 category 时 niche_match SKIP → 见 [SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)

---

## 8. 容易忽略的点（SOP-1 owned）

| # | 坑 | 来源 |
|---|---|---|
| 1 | 同 lead 重复抓 — `place_id` dedup + `mergeLeadIntoEntity` 合并 | SOP-1 owner |
| 2 | image-lead V2 (G-6 ✅) 已 port 到 V2 entity store | SOP-1 owner |
| 3 | `max_time` 必须 ≥ 180 — gosom API hard limit | SOP-1 owner |
| 4 | `sourceQuery` 强制 = `run.query` — bridge 统一来源（§3.4）| SOP-1 owner |
| 5 | Discord channel 必须先建好 6 个 forum tags — bot setup 一次性 | SOP-1 owner |
| 6 | image-lead 没 phone → 用 `image_<slug>_unknown` 兜底 key | SOP-1 owner |

**SOP-1 范围外的坑**（归其他 SOP 拥有，链接见 §7 末）：
- Niche substring 误判 / `relevance_pass` → SOP-2 §3.3
- 没 website 的 lead → SOP-2 §6
- V1 status + V2 phase 两套状态机 → [SOP-X-Handoff §3-§4](SOP_HANDOFF_CONTRACT.md#3-status-状态机v1--discovery-用)
- ContactIdentity 多触点缺失 → SOP-ART-3 (待写)

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

| 项 | 代码 | 本文档 | Admin 页面 |
|---|---|---|---|
| gosom Docker 主入口 + `pl:scrape-docker` | ✅ | ✅ | ✅ |
| image-lead V2 (`pl:ingest-image`) | ✅ | ✅ | ✅ |
| `pl:preflight` (G-2) | ✅ | ✅ | ✅ |
| `entity.latest.batch_id` + `batches[]` (G-3) | ✅ | ✅ | ✅ |
| `pl:pipeline-batch-*` CLI | ✅ | ✅ | ✅ |
| sourceQuery 强制规则 | ✅ (bridge) | ✅ §3.4 | — |
| 跨 niche/city 扩展策略 | n/a | §6 当前实战 | — |

**结论**: code ↔ doc ↔ page 同步。

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
