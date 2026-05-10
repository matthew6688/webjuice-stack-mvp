# Phase 1 — Block-Level Task List

更新日期：2026-05-10

> Phase 1 的目标：每个 lead 不论从哪个入口进，都能跑完 enrichment + 6 维 audit + visual audit，产出标准化 JSON，并在 `/admin/leads/<slug>` 看到完整 cost rollup。
>
> 推进规则：
> 1. 每块都必须以 **hard evidence** 收尾（真 API 调用、live fixture、结构化输出、可复跑测试），不接受"代码写完了就算 done"
> 2. 块内不停下来等确认，块完成后报 evidence + 等 Matthew 确认再进下一块
> 3. 块之间是 commit-level checkpoint，可独立推线上回退

## Block ✅ DONE — Phase 1.1 ledger 扩展

`e559430` — V2 字段 / 分级 / rollup / hashRequest，11 段断言通过。

## Block ✅ DONE — Block C — V2 lead intake & filter with explainability

完成 commits：`0e41629` (C-1) + `73bc0f4` (C-2) + `1f46435` (C-3) + (next push) (C-4)

子任务：

| 子任务 | 状态 | Commit | 关键 evidence |
|---|---|---|---|
| C-1 V2 scoring config (JSON) + site-quick-scan + cheap-audit-v2 engine + 31-lead test | ✅ | `0e41629` | 10/10 assertions pass; cheap-audit-config.json = single source of truth |
| C-2 enrichment router (5-route search) + 2 live fixtures | ✅ | `73bc0f4` | Regan Brothers + Brisbane Roofing Solutions enriched live; all T0 free; profile-score URL preference picks brand pages over deep links |
| C-3 `/admin/scoring` + `/admin/leads/<slug>` score breakdown | ✅ | `1f46435` + (next push fix) | `npm run build` 110 pages; score breakdown shows all 9 Stage 1 rules; **retro-verified in real Chrome** — fixed h1/h2 leak from global marketing typography (`max-width: 12ch` + serif 98px); screenshots saved to `data/v2/fixtures/admin-ui/`; regression script `npm run admin:screenshot` |
| C-4 rescore CLI + 34-lead comparison report + Stage 0.5 orchestration | ✅ | `1f489b0` | full live run: 30 Tinyfish fetches, 251s total, **27 V1-skip flipped, 10 audit_candidate, 1 starter_candidate, 2 still skip** (Stage 2 confirmed 2 sites OK); report at `docs/v2/autoresearch-results/scoring-v2-vs-v1.md` |
| C-5 admin UI brand alignment + flow diagram + nav link + leads list V2 integration | ✅ | `283d39f` + `6012c2e` + `7060d58` + (next push) | 3 iterations on /admin/scoring + /admin/leads/[slug]: brand tokens → local-style-2026-05-08 attribute opt-in (heavy 2px borders, citrus stat tile, Mondrian grid). Added Lead 分流流程 visual flow diagram on /admin/scoring. Added "算法" nav link. /admin/leads gains "V2 排序" section with all 136 entities scored, top 20 candidates shown with V2 final + decision chip + V1 comparison + fired triggers; all rows link to /admin/leads/<entityKey>. Discovery preview table now also has V2 column + click-through. Real Chrome verified, 10 admin pages screenshotted at `data/v2/fixtures/admin-ui/` |

Block takeaway → V2 cheap audit produces a coherent ladder: Stage 1 GBP triage (always) + Stage 2 site quick scan (when has-website) + Stage 0.5 enrichment fallback (when contact thin) + hard triggers (no_website starter, http+traction obvious win, high_traction_old_site floor). Algorithm definition + flow diagram + per-lead breakdown all visible in admin UI; admin/leads list integrates V2 score column with click-through to detail page. Block D (6-dim 39-item detailed audit on audit_candidates) and Block F (internal audit report HTML) are next.

## Block ✅ DONE — Block A — T0 retrieval 层（Tinyfish + Dokobot + DDG）

完成 commits：`92cc20c` (A.1 Tinyfish + token bucket) + `95e2c36` (A.2 Dokobot + DDG)

Evidence：
- `npm run util:test-token-bucket` — 10/10 token bucket 单元测试过
- `npm run extractors:test-tinyfish-v2` — live API 调用，search 1.0s/10 SERP，fetch 10.8s/8607 chars，rate-limit 本地 + 远端 429 都验证，7/7 断言过
- `npm run scrape:test-dokobot-smoke` — 真本地 Chrome 渲染 rooroofing.com.au 拿 11,370 chars（多于 Tinyfish 30%），23.5s，6/6 断言过
- `npm run scrape:test-ddg-smoke` — 当前被 DDG anti-bot 挡（HTTP 202），smoke 正确 skipped 且 ledger 写了 provider_unavailable 事件
- Fixtures：`data/v2/fixtures/{tinyfish,dokobot,ddg}/`
- Routing 修订：Dokobot 退到 fetch-only（search 要 DOKO_API_KEY），ENRICHMENT_ROUTING.md 同步

Takeaway：T0 search + fetch 两条链都跑通，ledger 全打通，每条调用都带 V2 fields（leadId/stage/purpose/tier/requestHash）。Block C 的 router 可以直接 import 这些 helper。

**为什么先做这块：** 所有付费 provider 都是 fallback；T0 三个 provider 跑通后，绝大多数 enrichment 任务零成本。

子任务：

- A1. `core/extractors/tinyfish.js` 扩展：
  - 加 `search({ query, location, language })` 调 `api.search.tinyfish.ai`
  - 加 `fetchUrls({ urls, format })` 调 `api.fetch.tinyfish.ai`
  - 内置本地 token-bucket（默认 30 req/min，env `TINYFISH_RATE_PER_MIN` 可调）
  - 每次调用写 `tinyfish_search` / `tinyfish_fetch` ledger event（`tier: T0`，`amount: 0`，`units: 1`）
  - 429 → 写 `provider_rate_limited` event，抛特定 error 让上层换档
- A2. `core/scrape/dokobot.js`（新建）：
  - 包装 `dokobot read --local`、`doko search`、`doko research` CLI
  - 检测 daemon / 设备可用性，写 `dokobot` category ledger
  - 失败 graceful（CLI 不存在 / device 离线）→ 抛特定 error
- A3. `core/scrape/ddg.js`（新建）：
  - 用 Playwright 抓 DDG SERP（已有 Playwright 依赖）
  - 简单 SERP 解析返回标准 `{position, title, snippet, url}` 数组
  - 写 `ddg_local` category ledger（`tier: T0`）

**Hard evidence：**

1. `scripts/extractors/test-tinyfish-v2.js` —— 真调 Tinyfish search + fetch 一次，验证：
   - search 返回 ≥5 SERP 结果，schema 匹配预期
   - fetch 返回非空 markdown，title 非空
   - 两次调用都写 ledger，category/tier/leadId/purpose 字段正确
   - rate-limit 模拟（mock 31 次连续调用 → 至少 1 次 `provider_rate_limited`）
2. `scripts/scrape/test-dokobot-smoke.js` —— `dokobot --version` 返回 2.x；smoke read 一个简单 URL 拿到非空 text
3. `scripts/scrape/test-ddg-smoke.js` —— DDG search "roofing brisbane" 返回 ≥5 结果
4. 三个 fixture 输出落到 `data/v2/fixtures/<provider>/<query-or-url-slug>.json`
5. 跑一次 `npm run finance:report -- --tier T0 --json` 看到 3 个 provider 的事件聚合

完成度 = 三个测试 + npm 注册 + ledger fixtures 都进 git。

## Block B — T2 retrieval/synthesis with key rotation

**为什么放这里：** 有了 T0 兜底，再挂 T2 才安全。

子任务：

- B1. `core/llm/key-rotation.js`（新建）：通用 least-loaded 选 key + cooldown
- B2. `data/admin/provider-keys.json`（gitignored）：keys 元数据 store（label/cap/spend/status）
- B3. `core/extractors/firecrawl.js` 扩展：接 rotation，保持现有单 key 调用 100% 兼容
- B4. `core/llm/perplexity.js`（新建）：sonar-medium-online，用 rotation；写 `perplexity` ledger（含 tokens_in/out + 真实 USD cost）

**Hard evidence：**

1. `scripts/llm/test-key-rotation.js` —— mock 3 个 key，验证 least-loaded 选择 + 429 cooldown + 80% cap stop + 全 cooldown 时抛 `provider_quota_exhausted`
2. `scripts/extractors/test-firecrawl-rotation.js` —— 真调 Firecrawl 一次（最低成本 URL，已有免费额度），ledger 写入 `keyId` 非空
3. `scripts/llm/test-perplexity-smoke.js` —— 真调 Perplexity 一次（最便宜 sonar-small，<$0.01），返回有内容 + ledger 准确记录 tokens 和 cost
4. 现有 firecrawl 调用（`scripts/extractors/firecrawl.js` 等）跑一次 smoke，确认未破

## Block C — Enrichment router + 第一个真实 lead 端到端

**为什么放这里：** Block A+B 的 building block 拼起来跑通真实流程，是 Phase 1 最重要的可见产出。

子任务：

- C1. `core/leads/enrichment.js`（新建）：实现三个 routes（search / fetch / synthesis）的 fail-soft 串联，返回标准化 `EnrichmentResult` schema
- C2. `core/leads/business-profile.js`（新建）：从 enrichment 结果归一到 V2 PRD 的 `business_profile` schema（[docs/v2/source/json-schemas-spec.json](source/json-schemas-spec.json) 第一段）
- C3. `scripts/leads/run-enrichment.js`（新建）：CLI 入口，吃 `--client <slug>` 或 `--lead-id <id>`，跑完整 enrichment 写到 `clients/<slug>/v2/enrichment.json`

**Hard evidence：**

1. 选一个真实 lead，跑：
   ```
   npm run leads:run-enrichment -- --client roo-roofing-brisbane --query "roofing brisbane"
   ```
2. 产出文件：
   - `clients/roo-roofing-brisbane/v2/enrichment.json` —— 标准 `EnrichmentResult`
   - `clients/roo-roofing-brisbane/v2/business-profile.json` —— V2 schema
3. ledger 里至少 5 条事件（search + fetch + 可能的 fallback），全部带 `leadId / stage / purpose`
4. `summarizeLeadSpend(events, leadId)` 返回 totalCost = $0（全走 T0）或 < $0.05（如果 fallback 触发）
5. 整个调用产生的 trace 落到 `data/v2/traces/<leadId>.json`，每一档调用的 latency / status / fallback 原因都在

## Block 🔨 IN PROGRESS — Block D — 6 维 39 项 detailed audit + Vision LLM + 报告

完成 commits：`c4ae442` (D iter 1) + `ffc1741` (D iter 2) + `b67f618` (D iter 3)

子任务进度：

| 子任务 | 状态 | Commit | 关键 evidence |
|---|---|---|---|
| iter 1 引擎 + 6 维 39 规则 + 单元测试 | ✅ | `c4ae442` | 3 个真 audit_candidate 跑通；schema 全合规 |
| iter 2 Playwright 全 fetch (HTML+perf+screenshots) | ✅ | `ffc1741` | 3/3 fetch 成功；Brisbane Roof Restoration 70 → low_priority（V2 纠正 cheap audit 误判） |
| iter 3 lead detail 页可视化 detailed_audit | ✅ | `b67f618` | 6 维 Mondrian 网格 + critical/major issue strip + 折叠分项 |
| iter 4 Block E vision autoresearch — 可教学输出（why/correct/fix） | ✅ | `3f2300c` + `62b4d48` | qwen-nothink 击败 gemma3（gemma 在空白截图上幻觉 4 issue） |
| iter 5 Block F internal audit HTML 报告（含 vision + 占位 review/video） | ✅ | `3f2300c` + `effda6a` | 自包含 HTML，brand-aligned，3 个 lead 全部产出 |
| iter 5.1 per-issue 硬证据 — cropped 截图 + 慢速 4G 加载视频 | ✅ | (this commit) | Brisbane 5/5 issue 都有 on-target 证据；Queensland 站点崩溃自动触发「⚠ 加载失败」证据卡 |
| iter 6 review mining (按需，仅高价值 lead) | ✅ | (this commit) | Google Places 5 reviews/lead × Ollama qwen-nothink 分析 → themes + quotable cards + redesign hooks，3/3 lead 强信号 |

## Block D — 原计划（保留供参考）

**为什么放这里：** Block C 拿到了 business profile，下一步就是详细 audit。

子任务：

- D1. `core/leads/site-audit-detailed.js`（新建）：6 维 39 项规则按 [scoring spec](source/workflow-summary.md) 实现，输入网站 URL，输出 PRD `audit_result` schema
- D2. 子模块：
  - `core/audit/lighthouse.js`：调本地 Lighthouse（T0），出 performance / mobile / CWV / accessibility / best-practices / seo
  - `core/audit/dom-checks.js`：cheerio / Playwright 抓页面，跑 H1 / title / meta / alt / schema / favicon / table-layout / form-validation
  - `core/audit/gbp-audit.js`：用 Block C 的 business-profile 数据 + GBP fields 跑 8 项规则
- D3. 评分加权聚合：6 维分 → total_score → decision（strong_redesign / moderate_candidate / low_priority / not_qualified）+ hard triggers + critical/major/minor 分级

**Hard evidence：**

1. `scripts/leads/test-detailed-audit.js` —— 用 `clients/od-native-clean-roofer-smoke-v2` 已有的 evidence 文件作为输入（避免再调网络），跑出完整 6 维分 + 39 项明细
2. 输出对照 PRD `audit_result` schema 校验（用 ajv 或手写 validator）
3. 跑真实 URL：`npm run leads:run-detailed-audit -- --url https://www.rooroofing.com.au/`，产出落 `data/v2/audits/<entity-key>/<timestamp>.json`
4. 至少 3 个真实 lead 跑完，分数 / 决策 / 阻塞触发条件落 fixture

## Block E — Visual auditor + autoresearch（model 选型）

**为什么放这里：** Block D 拿到结构化分数，visual audit 是下一层。这块同时回答 "vision 模型选哪个" 这个开放问题。

子任务：

- E1. `core/leads/visual-audit.js`（新建）：吃截图（desktop + mobile），调 vision LLM 出 `visual_audit` schema（freshness/trust/conversion 1-10 + design_age + issues + evidence）
- E2. `scripts/leads/capture-site-screenshots.js`（新建）：Playwright 截图 1440×900 + 375×667
- E3. **autoresearch**：5 个 fixture（不同设计年代 / 行业 / 国家），跑 4 个候选模型：
   - Kimi vision（T1，订阅内）
   - Claude Code subscription（T1）
   - GPT-4o-mini（T2，便宜）
   - GPT-4o（T3，参考上限）
- E4. 用一个固定 judge prompt 自动 + 人工各打一次分；测量 latency / token / cost / quality

**Hard evidence：**

1. `docs/v2/autoresearch-results/visual-auditor.md` —— 4 模型 × 5 fixture 矩阵，含每格的 latency / tokens / USD / judge score / 人工 1-5 分
2. 选定模型 + 决策理由 + cost-per-lead 估算
3. `core/llm/route.js`（新建）记录 `task → tier/model` 的官方映射，本任务作为第一条 entry
4. 决策落到 `core/leads/visual-audit.js` 默认配置

## Block F — 入口统一 + roofer-smoke-v2 端到端

**为什么收尾：** Block A-E 都是单点能力；Block F 把它们串成"任何入口的 lead 都能跑完整 V2 Phase 1"。

子任务：

- F1. 改 `scripts/leads/intake.js`：手工 / 导入 / referral 入口先写 discovery store entity，调 enrichment，落到 `enriched` stage
- F2. 改 `core/leads/discovery-store.js` / `lead-registry.js`：识别新增 V2 字段 + V2 stage（`enriched`）
- F3. 状态机：`core/funnel/stage-config.js` 加 `enriched` 进 `LEAD_STAGE_META` + `LEAD_PIPELINE_STAGES`
- F4. 端到端 fixture：用 `clients/od-native-clean-roofer-smoke-v2` 重跑 V2 Phase 1（不动它已有 OD 输出，只产生 V2 上游产物）

**Hard evidence：**

1. `scripts/leads/test-v2-phase1-e2e.js` —— 一个 npm 命令跑完：intake → enrichment → business-profile → 6 维 audit → visual audit，产生：
   - `clients/od-native-clean-roofer-smoke-v2/v2/enrichment.json`
   - `clients/od-native-clean-roofer-smoke-v2/v2/business-profile.json`
   - `clients/od-native-clean-roofer-smoke-v2/v2/audit-result.json`
   - `clients/od-native-clean-roofer-smoke-v2/v2/visual-audit.json`
   - 对应 ledger 事件链 + 单 lead 总成本 < $0.10
2. `clients/od-native-clean-roofer-smoke-v2/v2/lead-trace.json` —— 全链 trace（每档调用的 latency/status/fallback）
3. `/admin/leads/od-native-clean-roofer-smoke-v2` 页面能看到 V2 数据 + 累计 cost rollup（admin 视图改动也含在这块）

## 节奏建议

- 单次 Matthew 确认 = 一个 Block 完成 → 看 evidence → 进下一块
- 块内子任务我连续推，commit 数量一块约 2-4 个（中间状态可推可不推，按合理性切）
- 估时（粗）：A ≈ 1 天 / B ≈ 1 天 / C ≈ 1 天 / D ≈ 2 天 / E ≈ 1 天 / F ≈ 0.5 天

## 维护规则

- 每块完成后更新本文档对应段："✅ DONE — commit hash + evidence 列表"
- 任何决策回退（block 重做 / 顺序调整）→ 在文档顶部写一段 "Decision log"
- Phase 1 全部完成 → 在 [V2_UPGRADE_PLAN.md](V2_UPGRADE_PLAN.md) Phase 1 段标 ✅，写一句 takeaway 给 Phase 2 用
