# SOP-1 · 客户发现 Intake & Discovery

**版本**: v0.1-draft
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-1`](/admin/scoring/sop-1)
**调研笔记**: [`data/qa/sop-investigations/sop-1.md`](../data/qa/sop-investigations/sop-1.md)
**状态**: 🟡 调研完成 · 待 Matthew 回 6 个检查点后写 v1.0

> ⚠️ **这是 draft。** 此文档为正式 SOP-1 v0.1，部分章节已经基于调研笔记定稿，但 §6 / §7 / §8 仍带 TODO 标记，等 Matthew review 后定稿。代码 ↔ 文档 ↔ 页面三者尚未对齐 — 见 §10 同步状态。

---

## 1. 目的 · Purpose

SOP-1 覆盖**从"没有 lead"到"entity 已入库 + 有初始信号"**这一段。

**做什么**：
- 用 gosom Docker scraper 从 Google Maps 抓 raw leads
- normalize 字段 → 写入 V2 entity store
- 跑 discovery queue 重建（cheap-site-audit / selected-enrichment / outreach-brief）
- 在 Discord `#lead-discovery-runs` 开 batch thread 记录进度

**不做什么**：
- 不做 audit 评分（→ SOP-2）
- 不做 grade 计算（→ SOP-2）
- 不做销售对接（→ SOP-4）
- 不做 master.md / profile 生成（→ SOP-ART-1 / SOP-ART-3）

---

## 2. 三个入口对比

| 入口 | CLI / 工具 | 输出位置 | 是否进 V2 entity store | 状态 |
|---|---|---|---|---|
| **gosom Docker scraper** (主) | `pl:scrape-docker` **(TODO: G-1 未建)** → `npm run leads:maps-scrape` | `data/leads/entities/<key>.json` | ✅ | 主力流量 |
| **image-lead-discovery** (侧门) | `node scripts/leads/image-lead-discovery.js` | `clients/<slug>/lead/discovery-log.jsonl` | ❌ 走 V1 lead-ops | 客户送上门模式 |
| **关键词 search** | 同主入口（gosom `keywords[]` 参数） | 同主入口 | ✅ | 当前与主入口同源 |

**澄清**：当前没有"非 Google Maps 的 search 路径"。如果未来需要直接 Google Web Search → 抓 GMB → 入库，那是 v0.2 范围。

---

## 3. 主入口 · gosom Docker scraper 操作链路

```
[1] POST /api/v1/jobs           (keywords + max_time ≥ 180)
       ↓ 返回 job_id
[2] poll GET /api/v1/jobs/{id}  until status === "ok"  (~3-5 分钟)
       ↓
[3] GET /api/v1/jobs/{id}/download → CSV
       ↓
[4] BRIDGE: parse CSV → rename 3 fields → JSONL   ← G-1 工具 (TODO)
       ↓
[5] data/maps-scraper/runs/<runId>/results.maps.json
       ↓
[6] npm run leads:maps-scrape -- --input <path> --query "..." --niche --city
       ↓
[7] upsertDiscoveryRun → writeEntity + appendEvents + rebuildDiscoveryIndex
       ↓
[8] buildDiscoveryQueues  → queues / cheap-site-audit / selected-enrichment / outreach-brief
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

### 3.3 字段命名差异（CSV vs 旧 JSONL）

| CSV 字段 | 旧 JSONL 字段 |
|---|---|
| `website` | `web_site` |
| `longitude` | `longtitude` (历史拼写错误) |
| `descriptions` | `description` |

`core/leads/maps-scraper-discovery.js#normalizeMapsScraperRow` 已经兼容两种，所以 bridge 步骤只是 cosmetic rename，不动 logic。

---

## 4. 批次任务管理 · Discord forum thread

每个 batch（`pl:pipeline-batch-start` → `pl:pipeline-batch-step` → finalize）：

| 步骤 | 命令 | 副作用 |
|---|---|---|
| 1. 开 batch | `pl:pipeline-batch-start --niche roofing --city sydney --count 10` | `#lead-discovery-runs` 开 forum thread + apply tag `in-progress` + 落 `data/v2/pipeline-batches/<batch-id>.json` |
| 2. 每 stage 完 | `pl:pipeline-batch-step --batch-id X --stage "..." --status ok --summary "..."` | thread 追加 message + 状态文件更新 |
| 3. 结束 | `... --finalize --swap-tag completed` | swap forum tag |

**6 个 forum tag**（`#lead-discovery-runs` 已设好）：🔵 in-progress · ⏸️ paused · ✅ completed · ⚠️ partial-failed · 🔁 retry-pending · ❌ aborted

---

## 5. Entity schema · V2 lead 入库结构

简表（不含全部字段，完整字段定义见 `core/leads/discovery-store.js`）：

| 字段 | 来源 | 用途 |
|---|---|---|
| `entityKey` | `place_${place_id}` | dedup key |
| `firstSeenAt` / `lastSeenAt` | bridge 写入 | 时间追溯 |
| `status` | V1 状态机 (8 值) | discovery 写 |
| `phase` | V2 状态机 (8 phase) | sales 用 |
| `identifiers.{place_id, cid, data_id, websiteDomain, phoneDigits}` | normalize | 多键匹配 |
| `latest.{name, category, address, city, niche, phone, website, rating, review_count, signals}` | normalize | 最新快照 |
| `runs[]` | 每次 discovery run append | 历史溯源 |
| `grade` | SOP-2 写 | A/B/C/D |
| `discord_thread_id` | SOP-2 写（A/B 自动开 thread） | 销售联动 |
| **`batch_id`** | **(TODO: G-3 字段未加)** | 区分本批 vs 老批 |

**V1 status + V2 phase 共存** — 两套独立状态机：discovery 写 `status`, sales 用 `phase`。详见 SOP-X-PhaseTransitions **(TODO)**。

---

## 6. 跨 niche / city 扩展策略

🟡 **TODO** · 当前没有正式策略 · 等 Matthew 补：
- 一个 batch 抓多少 lead？（目前默认 10）
- niche 怎么 rotate？
- city 怎么 schedule？
- 何时跨 country？

---

## 7. 常见失败 + retry

| 失败模式 | 表现 | mitigation |
|---|---|---|
| `max_time < 180` | API 返回 422 `max time must be more than 3m` | 强制 ≥ 180，实战建议 240-300 |
| Docker 容器死 | `pl:preflight` (TODO: G-2 未建) 应检测 | 手动 `docker restart gmaps-scraper-web` |
| Niche 不准（substring 误判） | `Roofer's Bar` 进库 | cheap-audit `relevance_pass` SKIP，但 entity 仍占库 |
| 同 lead 重复抓 | 多 query 命中同 place_id | `discoveryEntityKey` dedup + `mergeLeadIntoEntity` 合并 |
| 没 website 的 lead | category 类有 phone 没 site | 走 `starter_candidate` 路径（SOP-2 §6 已记） |
| GMB 无 category | `latest.category` 空 | cheap-audit niche_match SKIP，需人工 review |
| Discord forum tag 未建 | `applied_tags` API 422 | 一次性 bot setup |

---

## 8. 容易忽略的点（实战 10 条 · 全部来自调研踩坑）

完整 10 条见 [`data/qa/sop-investigations/sop-1.md` §5](../data/qa/sop-investigations/sop-1.md)。简版：

1. Niche substring 误判（`'oof'` → roofing）— entity 仍入库
2. 同 lead 重复抓 — `place_id` dedup
3. V1 `status` + V2 `phase` 两套状态机共存
4. 没 website 的 lead 进 `starter_candidate`（未完全自动化）
5. image-lead 走 V1，不进 V2 主流程
6. `max_time` 必须 ≥ 180
7. ContactIdentity 多触点缺失（无 social handles）— SOP-ART-3 范围
8. `sourceQuery` 是关键追溯字段 — bridge 强制 `lead.sourceQuery = run.query`
9. Discord channel 必须先建好 6 个 forum tags
10. GMB 无 category 时 niche_match SKIP

---

## 9. SOP-1 实施时要建的工具（gap list）

| ID | 内容 | 工程量 | 状态 |
|---|---|---|---|
| **G-1** | `pl:scrape-docker` CLI (POST job → poll → download CSV → 转 JSONL → 调 leads:maps-scrape) | ~1h | ❌ 未建 |
| **G-2** | `pl:preflight` CLI (容器/PSI/Discord/claude_cli/ollama/磁盘) | ~30min | ❌ 未建 |
| **G-3** | Entity schema 加 `batch_id` 字段 | ~20min | ❌ 未建 |
| **G-4** | `entity.contact_identity` 多触点 + enrichment 强制补 social | — | → SOP-ART-3 |
| **G-5** | Starter_candidate 自动化 | — | → SOP-2 后续 |
| **G-6** | image-lead 是否并入 V2 主流程 | — | 长期 roadmap |

---

## 10. 同步状态 · Code ↔ Doc ↔ Page

| 项 | 代码 | 本文档 | Admin 页面 |
|---|---|---|---|
| gosom Docker 主入口 | ✅ 跑通 | ✅ 描述 | ✅ 描述 |
| image-lead 侧门 | ✅ 存在（V1）| ✅ 描述 | ✅ 描述 |
| `pl:pipeline-batch-*` CLI | ✅ smoke 通过 | ✅ 描述 | ✅ 描述 |
| `pl:scrape-docker` (G-1) | ❌ 未建 | TODO 标记 | TODO 列表 |
| `pl:preflight` (G-2) | ❌ 未建 | TODO 标记 | TODO 列表 |
| `entity.batch_id` (G-3) | ❌ 未建 | TODO 标记 | TODO 列表 |
| 跨 niche/city 扩展策略 | n/a | §6 全 TODO | TODO 列表 |

**结论**: 文档反映**当前真实代码**，未建的东西标 TODO，不冒充已实现。

---

## 11. Decision Records

🟡 **TODO** · 待 Matthew review §8 检查点后填入：
- D-SOP1-1 ?
- D-SOP1-2 ?

---

## 12. Review 检查点（Matthew 回复后写 v1.0）

见 [`data/qa/sop-investigations/sop-1.md` §8](../data/qa/sop-investigations/sop-1.md) 6 条问题：
1. 3 入口现状描述准吗？
2. image-lead-discovery 走 V1 不进 V2 主流程 — 对吗？
3. ContactIdentity 多触点 — 归 SOP-ART-3 还是 SOP-1？
4. `sourceQuery` 强制 = `run.query` — 写进 v0.1 吗？
5. G-1/G-2/G-3 这一轮建还是分到 Phase 2？
6. §7 章节结构 — 加 / 删什么？

回完这 6 个，本文档升 v1.0。
