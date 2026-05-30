# Pipeline Coherence Map — lead funnel (search → filter → enrich → target)

> **状态**: 2026-05-30 · codex Round 124 ordered (A-first). **有界**：一张端到端地图 + 明确的"过时/冲突契约"findings + "等 identity-resolution 才能做"的清单。**本步不做归档**（归档是 task #4 的后续）。
> **作用**: Hermes/operator/agent 看这一份就知道每个阶段——谁拥有逻辑、哪个 CLI/skill 调它、产出什么、哪里漂移了、什么被阻塞。
> **维护**: 改任何阶段的 owner/CLI/artifact → 更新这张表。

## 端到端阶段表（执行顺序 · 含 Hermes 调用面）

| # | 阶段 | CLI (Hermes target) | Owner 模块/函数 | Skill | 产出 artifact | 状态/漂移 |
|---|---|---|---|---|---|---|
| 0 | **发现/intake** | `pl:scrape-docker` · `pl:places-search-intake` · `pl:pipeline-batch-start`(自动接 scrape) | `core/leads/maps-scraper-discovery.js`(分类+recommendAction) · `discovery-store.js`(upsert) | `profitslocal-lead-discovery`(端到端编排) · `image-lead-discovery` | `data/leads/entities/*.json` · `entity.latest`{name/phone/website/rating/review_count/address/category/websiteStatus} | ✅ Hermes 白名单已含 |
| 1 | **廉价筛选闸**(T0·$0) | (自动入 queue) · `scoring:test-cheap-audit-v2` | **`core/leads/exclusion-filter.js`(真·决策引擎·3层淘汰)** · `cheap-audit-queue.js`(编排) · `core/scoring/cheap-audit-v2.js` · `match-judge.judgeNicheRelevance` | `profitslocal-lead-filter` | `entity.latest.{exclusion_filter, cheap_audit, predict_grade}` · 排除→terminal-archive | ⚠️ **漂移**: skill 把 `predict_grade` 当主契约, 实际决策引擎是 `exclusion-filter`(cycle-23)·predict_grade 只是兼容字段 → 改 skill 表述 |
| 1.5 | **缺联系方式才富集** | `pl:run-enrichment-batch`(needs_enrichment 触发) | `core/leads/enrichment.js`(5-6 路搜索) · `tinyfish-summary.js` | (含在 lead-filter/enrichment) | 找到联系方式 或 terminal-archive | ✅ |
| 2 | **付费富集**(幸存者) | `pl:run-enrichment-batch` · `pl:single-enrich` | `core/enrichment/index.js enrichEntity`(whois/wayback/`abr-abn.js`/`license-lookup.js`/tinyfish) · `match-judge.judgeEnrichmentMatches`(URL 同一家) | `profitslocal-entity-enrichment` | `entity.enrichment.{whois,wayback,abn,license?,tinyfish_*}` + 成本账本 + `_source` | 🔨 **缺口**: identity-match 未接 · license-lookup 未当筛选用 · judgePageIdentity 不存在(见 Q5 阻塞) |
| 3 | **深度审核**(有网站) | `leads:run-pipeline`(run-audit-pipeline 9 段) · `pl:audit-v4` | `scripts/leads/run-audit-pipeline.js` · `core/scoring/detailed-audit.js` · `core/audit/*`(Playwright/PageSpeed/vision) | `site-audit` · `profitslocal-quality-audit` · `website-ui-audit` | `entity.detailedAudit{audit_score,issues,decision}` + `visualAudit` | ✅ Hermes 白名单含 leads:run-pipeline |
| 4 | **评级+资格** | `leads:qualify` · `pl:check-qualification` | `core/scoring/lead-grading.js`(A/B/C/D+tier) · `qualification-scorecard.js` | (含在 lead-discovery) | `entity.grade{investment_level,product_tier}` · qualification verdict | ⚠️ review_count 仍当"真伪门槛"(R117 待降级) |
| 5 | **master.md / 背景** | `leads:build-master-md` | `core/reports/master-md-builder.js` · `core/audit/redesign-brief-builder.js buildCoreExtract` | `profitslocal-build-research-pack` · master-md-refresh | `clients/<slug>/v2/master.md` + `core-extract.json`(narrative · 每条 `_sources`) | ✅ Hermes 白名单含 · 只该吃 verified 身份事实 |
| 6 | **建站/交付**(漏斗末端·非"找客户"范畴) | `pl:compose-editorial` · `pl:ship-customer` · `pl:publish-dir` | composer + publish | `profitslocal-collect` · `profitslocal-assemble-handoff` · `profitslocal-audit-handoff` | `editorial-output/index.html` → `*.pages.dev` | ✅ |

## Q4 · 过时/冲突/缺失的契约（findings · 本步只记录, 不改不删）
1. **`profitslocal-lead-filter` skill 漂移**: 把 `predict_grade`(C/D) 当主输出契约; 实际真决策是 `exclusion-filter`(LEAD-FILTERING-DESIGN cycle-23 删了 5 维 predict 分, predict_grade 现为兼容字段)。skill 应前置 exclusion-filter。
2. **screening 升级未落地**(R116/R117 设计已定, 代码未改): review_count 仍是"真伪门槛"(应降级为付费信号) · license-lookup 未接淘汰闸 · 无 observability 计数器 · `cheap-audit-v2` 的 action 还含 `manual_review`(R117 要求全自动, 应改为自动 drop/skip, 不挂人)。
3. **persona apparatus 已退役**(R114): 任何把 `persona-context` 当默认生成路径的 skill/doc 描述都过时(buyer-lens 已折进 B1/B2/B3 contract)。
4. **无端到端漏斗入口**: 有 `pl:pipeline-batch-start`(建线程+接 scrape) + `run-audit-pipeline`(审核段), 但**没有**一键"跑某 niche/city 全漏斗"命令 → C(`pl:run-funnel` thin controller)是后续。
5. **`pl:pipeline-all` 是建站 checkpoint 跟踪, 不是 lead 漏斗** —— 名字容易误导, 别当漏斗入口。

## Q5 · 等 identity-resolution 落地才能做的（阻塞项）
- **牌照淘汰闸**(Stage 1/2): inactive→kill 必须先有 identity 守门(否则模糊匹配误杀)。
- **"真目标"筛选规则**(Stage 1): "license-active 或 ABN-active + 可达" 取代 review_count 当真伪 —— 需要 identity-verified 的 license/abn。
- **master.md 渲染真牌照号当信任背书**(Stage 5): 只能用 verified 身份事实。
- **judgeEnrichmentMatches / judgePageIdentity 提升为 canonical**: 经 `resolveIdentity` 的 promotable 才写入。

## Q6 · 后续可归档/更新的（指向 task #4 · 本步不动）
- 75 个 docs 已分类(task #4 的归档清单)。
- 阶段 skill 的过时契约(Q4) —— **更新**(不是删除): lead-filter 表述、任何 persona-default 描述。
- 归档/退役留到 A 之后、由 D(skill-contract currency gate)护着做; 本步只标记, 不执行。

## 执行顺序（codex R124 · 全局)
A(本图) → identity 死规矩修复 → identity gold-set harness → judgePageIdentity → 接 resolveIdentity → 牌照闸 → 评论降级+全自动+observability → B 补缺口 → C `pl:run-funnel` thin controller(只编排不重写·复用 batch-thread 状态) → D skill-contract currency gate → 清理归档。
codex 红线: run-funnel 只能是**可恢复的编排器**(one Hermes intent surface · many stage executors · one durable batch state), 不能变成"do everything"巨型脚本。
