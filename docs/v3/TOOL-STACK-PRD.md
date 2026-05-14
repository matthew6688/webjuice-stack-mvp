# V3 Tool Stack PRD · 第三方 API + LLM + Infra · SoT

> **作用域**: V3 业务链条用到的所有付费/免费第三方工具 · LLM cascade · quota · fail/fallback 顺序。
> **owner**: 跨 M1-M5 模块 · 任何新加 provider 必须更新本文档。
> **status**: D36 (2026-05-14) 第一版。

---

## 0. TL;DR

```
20+ API/provider · 分 4 个 tier (T0 免费/本地 · T1 订阅 · T2 metered · T3 premium)
7 个 LLM cascade 决策点 · 都有 fail/fallback 兜底
日成本预估 (10 客户全跑 M1+M2+M3): ~$10-15
未来 (M4 outreach 启动): +Resend ~$0.10/email · +M4 link tracker
```

---

## 1. 全部 Tool 清单 (按 tier 分类)

### T0 · 免费 / 本地 / 一次性付清

| Tool | 用途 | V3 模块 | 限制 |
|---|---|---|---|
| **Ollama** (qwen3.5:9b) | 本地 LLM (text + vision) | M1 (intent-router 兜底) · M2 (visual fallback) | macOS GPU · 单核 · ~3-5s/req |
| **gosom docker scraper** | gmaps maps scrape | M1 (`pl:scrape-docker` intake) · M2 (`reviews-adapter` docker 优先) | 本地 docker · 单实例 |
| **Playwright** | 浏览器自动 (audit + 截图 + 录屏) | M2 (`detailed-audit` Stage 1) | 本地 · 单实例 |
| **Cloudflare Pages** | 静态 demo 部署 | M3 (`pl:publish-demo`) | Free tier · 1 deploy 单位/客户 (~500 projects/account) |
| **GitHub Pro** ($4/mo) | repo 托管 + actions | All | 一次性付清 |
| **Discord Bot** | forum thread / message | All channel | 免费 |

### T1 · 订阅 (一次性付 · token 跟踪)

| Tool | 用途 | V3 模块 | quota 注意 |
|---|---|---|---|
| **Anthropic Claude CLI** (sonnet-4-5) | text + vision · 高质量 LLM | M1 intent-router · M2 vision · M3 build/audit/optimize | Claude Max 订阅 |
| **OpenAI Codex CLI** | text · 同 Claude tier | 同上 · cascade 兜底 | ChatGPT Plus 订阅 |

### T2 · Metered API (月度 quota · 跨 key 分散)

| Tool | 用途 | V3 模块 | 成本 / quota |
|---|---|---|---|
| **Google Places API** (Text Search + Details + Photos) | 商家 GBP 数据 | M1 (`pl:places-search-intake` + `pl:single-enrich`) · M2 (`reviews-adapter` fallback) | ~$0.017/req · **11k req/月/key** · 多 key 分散 (per `GOOGLE_PLACES_API_KEY_2..N`) |
| **Google PageSpeed API** | 网站速度审计 | M2 (`detailed-audit` Stage 1) | 25k req/天/key · free |
| **Google Geocoding API** | 城市 → 坐标 | M1 (`pl:scrape-docker` pre-step) | 同 Places key |
| **Firecrawl** | web scrape fallback | M2 (reviews · pagespeed alt) | $20/mo · 500 pages/mo |
| **Tinyfish** | cheap-audit-v2 scrape (Stage 0) | M2 (rescore-v2 每 niche) | Free tier 一次性试用 (近用完) |
| **OpenAI API** (gpt-image-1) | image 生成 | M3 reference family 制图 (一次性) | $0.04/image · 用得少 |
| **Cloudinary** | image CDN + transformations | M2 (photos download) · M3 (publish assets) | **25 GB free** → $89/mo |
| **Resend** | email 发送 (M4 启动后) | M4 (待启动) | $20/mo · 50k emails |
| **Tally** | 表单托管 (paid 客户付款表单) | M5 (待启动) | $29/mo |

### T3 · Premium / 高单价 (用得少)

| Tool | 用途 | V3 模块 | 成本 |
|---|---|---|---|
| **Perplexity API** | autoresearch · 多轮 fact check | M2-D9 customer-audience loop · M3 optimize-internal-report | $5/1k req · 用 5 round/客户 ~$0.05 |
| **Kimi** (Moonshot K2) | 中文 LLM · 备用 | (待启用 · M2/M3 中文优化场景) | ~$0.001/k tokens |
| **Moonshot** | 同 Kimi · 别名 | 同上 | 同上 |
| **Google Generative AI** (Gemini) | LLM 备用 | (待启用) | $0.005/k tokens |

### Infrastructure (固定费 / SaaS)

| Tool | 用途 | 成本 |
|---|---|---|
| **Stripe** | 支付 webhook · M5 入口 | 2.9% + $0.30/txn |
| **Hermes** (本地 cron) | 自动 cron + skill 调用 | 0 (本地) |
| **launchd** (macOS) | daemon 管理 | 0 |
| **Tunnels (Cloudflare Tunnel)** | tasks.profitslocal.com SOP-0 API | 0 (CF free tier) |

---

## 2. LLM Cascade 系统 (7 个决策点)

每个 cascade 都遵循 "first success wins" · 失败自动 fallback · 全失败有兜底。

### 2.1 Intent-Router (D27 · paid-first)
**位置**: `core/tasks/intent-router.js#routeIntent`

```
default cascade: codex_cli → claude_cli → ollama → regex
                 ↑ T1            ↑ T1        ↑ T0      ↑ 兜底
```

- env 覆盖: `INTENT_ROUTER_CASCADE=ollama,regex`
- **regex 必兜**: 即使所有 LLM 挂 · regex 解析 NICHE_KEYWORDS + CITY_KEYWORDS 永远工作 (intake-doctor check #5 守)
- 失败处理: 任一 provider throw → 试下一个 · 全失败 → `kind=ops` + `target_cli=null` → human gate

### 2.2 Text-Adapter (T0/T1/T3 tier-aware)
**位置**: `core/llm/text-adapter.js`

| Tier | Cascade | 用于 |
|---|---|---|
| T0 (default) | `ollama → claude_cli → codex_cli` | 廉价场景 (cheap-audit / regex 用不上时) |
| T1 | `claude_cli → codex_cli → ollama` | 中等质量需求 · M2 visual prompt 等 |
| T3 | `claude_cli only` | 强质量 · 不 fallback · M3 build-from-reference |

env 覆盖: `TEXT_PROVIDER=ollama|claude_cli|codex_cli` · `TEXT_FALLBACK=false` 禁兜底

### 2.3 Vision-Adapter
**位置**: `core/llm/vision-adapter.js`

```
claude_cli → codex_cli → ollama
↑ best       ↑ ok        ↑ 30% 准确率下降 · 兜底
```

- 输入: PNG/JPG screenshot
- 失败处理: 全失败 → `visual_freshness=null` (master.md 标 — · 不阻断 audit pipeline)

### 2.4 Reviews-Adapter (M2-D2 · 评论抓取)
**位置**: `core/leads/reviews-adapter.js`

```
gosom docker (-extra-reviews) → Google Places API (5 max)
↑ T0 · 全 reviews          ↑ T2 · cap 5
```

- 失败处理: docker 失败 → places fallback · places quota 用完 → 返 `[]` (M2 不阻断)
- Bug 17 修过 · `refit-docker-reviews.mjs` 兜底 force-docker

### 2.5 Hard-Skip Rules (Lead Grading)
**位置**: `core/scoring/lead-grading.js#HARD_SKIP_RULES`

```
8 规则 first-match-wins:
  niche_mismatch → recent_redesign → enterprise_size →
  too_many_pages → too_many_categories → relevance_fail →
  fully_managed → not_qualified_decision
```

任一 match → `investment_level='D'` → archive

### 2.6 Discovery Score (M1-D2)
**位置**: `core/leads/discovery-score.js`

不 cascade · 直接 sum (8 signal · 每个 5-20 分) → 0-100 score。

### 2.7 Dedup Scorer (M1-D1)
**位置**: `core/leads/dedup-scorer.js`

```
8-key weighted score:
  place_id 60 · phone 25 · domain 25 · name 20 · coords 15 ·
  address 15 · hours 8 · categories 5
≥60 自动合并 · 30-60 LLM judge · <30 新建
```

LLM judge 用 ollama (qwen3.5:9b) · 失败时回 "different" (不合并 · 保守)

---

## 3. Per-Module 工具使用映射

### M1 · intake
- **LLM**: intent-router cascade (codex/claude/ollama/regex)
- **API**:
  - `pl:places-search-intake` → Google Places (Text Search + Details + Photo refs)
  - `pl:scrape-docker` → gosom docker · Geocoding (city pre-step)
  - `pl:single-enrich` → Google Places Find Place + Details
  - `pl:ingest-image` → Vision LLM (claude/codex/ollama) · 名片图 OCR
- **成本**: ~$0.05-0.30 per intake batch
- **Doctor**: `pl:intake-doctor` check #2-#3 守 docker + Places key

### M2 · audit
- **LLM**:
  - text-adapter T0 (cheap-audit-v2 简单规则)
  - text-adapter T1 (visual prompt)
  - vision-adapter cascade (Stage 2 visual)
- **API**:
  - Playwright (本地 · audit + screenshots + video)
  - PageSpeed API
  - Cloudinary (photo upload)
  - reviews-adapter cascade
- **成本**: ~$0.005-0.50 per entity
- **Doctor**: 暂无 `pl:audit-doctor` (backlog P3)

### M3 · publish
- **LLM**:
  - claude_cli sonnet-4-5 (build-from-reference · 单次 ~$0.30)
  - claude_cli sonnet-4-5 (build-customer-audit · ~$0.10)
  - claude_cli sonnet-4-5 (build-internal-audit · ~$0.20)
  - claude_cli + critic (optimize-internal-report · 3 round · ~$4.50)
- **API**: Anthropic API · Cloudflare Pages (free deploy)
- **成本**: ~$0.60-5.10 per customer
- **Doctor**: 暂无 `pl:publish-doctor` (backlog P3)

### M4 · outreach (待启动)
- **API**:
  - Resend (email send)
  - Discord webhook (operator notifications)
  - M4 inbound listener (待设计)
  - link tracker (待设计 · 客户点 demo 闪烁 👀 emoji)
- **预计成本**: ~$0.10/email + Resend 月度

### M5 · paid (待启动)
- **API**:
  - Stripe webhook (payment_intent.succeeded)
  - Tally (paid 客户表单)
  - domain provisioning (CF Registrar API)
- **预计成本**: Stripe 2.9% + $0.30/txn

---

## 4. Doctor 监测哪些 (现状 + TODO)

### 4.1 已实装

| Doctor | 监测 | 频率 |
|---|---|---|
| `pl:sop0-doctor` | 5 daemon + tunnel + listener + ollama + stuck tasks | on-demand |
| `pl:intake-doctor` | entities/ 24h · docker · GOOGLE_PLACES_API_KEY · build-master-md backlog · intent-router regex | **daily 09:00 cron** |
| `pl:lead-journey-doctor` | 10 entity invariant + funnel by phase/grade | on-demand |

### 4.2 TODO (backlog)

| Doctor | 监测 | 优先级 |
|---|---|---|
| `pl:audit-doctor` | Playwright · vision LLM · Hermes cron heartbeat · audit queue · M2 fixtures | P3 |
| `pl:publish-doctor` | CF token · wrangler version · reference site files · live URL spot check (3 random curl 200) | P3 |
| `pl:cost-doctor` (新 · per Matthew) | 每日付费 API usage 汇总 + cost 估算 · Discord 报 | **P2 (新)** |
| `pl:channels-doctor` | 6 channel env + bot 权限 + tag 同步 + thread 异常 | P3 |

---

## 5. 每日付费 API 用量 + 成本报告 SOP (D36 backlog · per Matthew)

### 5.1 目标
每天 09:00 (复用 daily intake-doctor cron 时段) · 汇总:
- 各 paid API usage (last 24h · 30d)
- 各 API 月度 quota 用量百分比
- 累计成本估算 (USD)
- 接近 quota 上限 alert · 月度 >$50 alert

### 5.2 数据源

| API | 数据源 | Notes |
|---|---|---|
| Google Places | `data/finance/places-quota.json` (实装) | 多 key 累加 |
| Anthropic Claude CLI | Claude CLI logs (todo: pipe to file) | 待实装 |
| OpenAI Codex CLI | Codex CLI logs (todo) | 待实装 |
| Cloudinary | API quota endpoint | 调 GET /usage |
| Resend (M4) | API quota endpoint | M4 启动后 |
| Perplexity | API quota endpoint | 调 GET /usage |

### 5.3 输出格式 (Discord daily report)

```
📊 ProfitsLocal · Daily API Usage · 2026-05-14
─────────────────────────────────────────
Google Places   · 234 req · $3.98 · 8% 月度 quota
Anthropic       · 12 sessions · ~$2.10 · sub 内
Codex           · 5 sessions · ~$0.30 · sub 内
Cloudinary      · 1.2 GB · 4.8% · free tier
Total estimate  · $6.38 / 今日
Month-to-date   · $24.50 (May)
⚠️ Alert        · 无
─────────────────────────────────────────
```

### 5.4 实装 (`pl:cost-doctor`)
- `scripts/cli/pl-cost-doctor.js` (新 · ~1.5h 工作量)
- daily cron · `ai.profitslocal.cost-doctor-daily`
- output: Discord webhook (`SPECIAL_ALERTS_DISCORD_WEBHOOK_URL`)
- Heartbeat: `data/heartbeats/cost-doctor.txt`

**优先级**: P2 (D36 加入 backlog)

---

## 6. 维护契约 (per Matthew · 必守)

### 6.1 加新 provider 时
- 加入本文档 §1 (按 tier)
- 加入 `.env.local` (key)
- 更新 SOP-N-FLOW 引用
- 评估 cost 加进 §5 daily report (如果是 metered)

### 6.2 cascade 改动时 (例 D27)
- 更新本文档 §2 对应 cascade 点
- DECISIONS-LOG 新 D
- doctor 同步 (intake-doctor check #5 等)

### 6.3 月度审计
- 各 API 月度 quota 实际用量
- 是否需要加 backup key (例 `GOOGLE_PLACES_API_KEY_2`)
- 是否退订 unused (例 Tinyfish 一次性试用快用完时)

---

## 7. 相关文档

- [README.md (SoT)](./README.md) · 顶层索引
- [SKILLS-INDEX.md](./SKILLS-INDEX.md) · Hermes/Claude skills 索引 (D36 同步建)
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D27 cascade 决策 · D36 工具 + skill 清理
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · M1 intake (intent-router cascade)
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · M2 audit (vision-adapter cascade)
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · M3 publish (Anthropic API)
