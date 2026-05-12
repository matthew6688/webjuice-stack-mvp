# SOP-X-Tooling · 第三方工具矩阵

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-x-tooling`](/admin/scoring/sop-x-tooling)
**范围**: 横切（cross-cutting）· 所有阶段共用工具的清单 + 计费 + fail-over 策略

---

## 0. Tier 规则（cost discipline）

| Tier | 含义 | 默认策略 |
|---|---|---|
| **T0** | 本地 / 免费额度内 | 无脑用 |
| **T1** | 固定订阅 / 每月固定费 | 用满订阅价值 |
| **T2** | metered (按用量) | 每次调用 ledger 记账，月度对账 |
| **T3** | premium LLM ($0.01+/call) | 只在 autoresearch 优于 next-best > 15% 时用 |

---

## 1. 完整工具矩阵

### 1.1 Discovery / Scraping

| 工具 | Tier | 计费 | 用在 | 状态 | Fail-over |
|---|---|---|---|---|---|
| gosom Docker scraper | T0 | 本地免费 | SOP-1 主入口 | ✅ active | → outscraper (G-11 backlog) |
| Google Places API | T0 | $200/月免费额度 ≈ 11K calls (Details Basic SKU $0.017/call) | SOP-1 selected lead 增强（types[] / photos / E.164 phone）；触发条件 grade ≥ B | ✅ active 2026-05-12 | hard cap 11K，月初 reset；多账号 rotation (G-12 backlog) |
| outscraper / apify / brightdata | T2 | $0.001-0.005/record | (待接) gosom 备份 | ⚪ G-11 backlog | provider interface 抽象 |
| DDGS (DuckDuckGo) | T0 | 免费 | SOP-1 enrichment Stage 0.5 (5 路 search) | ✅ active | → Tinyfish (T2) |
| Tinyfish | T2 | $1/k pages | SOP-2 site-fetch-full + cheap-audit fetchSites | ✅ active | → Firecrawl rotation |
| Firecrawl | T2 | $0.001-0.003/page | SOP-2 fallback scrape | ✅ active | → Perplexity rotation |
| Perplexity | T2 | metered | SOP-2 autoresearch loop | ✅ active | T3 fallback |

### 1.2 Audit / Analysis

| 工具 | Tier | 计费 | 用在 | 状态 | Fail-over |
|---|---|---|---|---|---|
| PageSpeed Insights (PSI) | T0 | 25K/day 免费 | SOP-2 Stage 2i (CWV / LCP) | ✅ active | 失败时标 `psi_unavailable_at`，audit_score 跳过 |
| Anthropic Claude API | T3 | $3-15/M tokens | SOP-2 visual audit (claude_cli 优先) | ✅ active | → Gemini → Ollama |
| OpenAI API | T3 | $5-15/M tokens | hero 图片生成 (B grade) | ✅ active | (单点) |
| Gemini API | T3 | $0.075-2/M tokens | visual audit fallback | ✅ active | → Ollama |
| Ollama (本地) | T0 | 本地免费 | visual T0 fallback (llama3.2-vision) | ✅ active | (最后一道) |
| Cloudinary | T0 | 25GB free + transformations | 所有图片 / 视频证据 + master.md 素材 | ✅ active | (单点 · backup 长期 TODO) |

### 1.3 Outreach / Sales

| 工具 | Tier | 计费 | 用在 | 状态 | Fail-over |
|---|---|---|---|---|---|
| Discord Bot API | T0 | 免费 | 所有 4 channels + system alerts webhook | ✅ active | (单点) |
| Resend | T0 | 3K/月免费 | 系统 transactional email | ✅ active | (T1 升级) |
| Instantly / Smartlead | T2 | $37/mo + per-send | SOP-4 cold email (warmed sender 域名) | 🟡 兼容层有，未接通 | rotate provider |
| Twilio (SMS) | T2 | $0.0083/SMS + 10DLC 注册 | SOP-4 (待接) | ⚪ TODO | rotate phone numbers |
| Tally Forms API | T1 | 订阅 | 客户 intake 表单 | ✅ active | — |

### 1.4 Infra

| 工具 | Tier | 计费 | 用在 | 状态 |
|---|---|---|---|---|
| Cloudflare Pages | T0 | 免费 | 所有前端部署 | ✅ active |
| Cloudflare API | T0 | DNS / KV 免费额度 | 客户域名 setup | ✅ active |
| Stripe | T2 | 2.9% + $0.30/charge | SOP-5 付费 | ✅ active |
| GitHub Actions | T0 | 免费 (public + 2000min private) | CI / deploy | ✅ active |

---

## 2. Places API · 成本控制（详）

**目标**：永远在 $200/月免费额度内。

**实现**：
- `core/extractors/places-quota-guard.js` 每次调用前 check 当月计数
- `data/finance/places-quota.json` 持久化（YYYY-MM keyed，自动 reset）
- Hard cap = 11,000 calls / month（margin 留给 Photos / Text Search 等其他 SKU）
- 超 cap → 抛 `PlacesQuotaCapExceeded` 错 + 推 Discord 警报，**绝不发实际请求**
- 80% 阈值 → 健康检查 `ops:health-check` 标 `warn`

**何时调用**：
1. Stage 2 detailed-audit 结束、grade ≥ B 自动触发 `pl:places-enrich --entity-key X`
2. 操作员手动 enrich 单 entity
3. **C/D 不投入**，节约额度

**多账号 rotation（G-12 · ✅ 2026-05-12）**：
- env：`GOOGLE_PLACES_API_KEY` (primary) · `GOOGLE_PLACES_API_KEY_2` · `_3` ... 每个 = 独立 GCP 账号 = 独立 $200 配额
- `PlacesQuotaGuard.selectAvailableKey()` 自动选第一个有余量的 key
- 配额 ledger 升级 schemaVersion v1 → v2（per-key tracking）· 自动 migrate
- 全 key capped → 抛 `PlacesQuotaCapExceeded` + Discord alert + 建议新增 `_N` key
- `pl:places-enrich` 已接入：每次自动选 key + charge 对应 keyId

---

## 3. Periodic health monitoring · `ops:health-check`

**9 项周期检查**（详见 `scripts/cli/pl-ops-health-check.js`）：
1. gosom Docker (`localhost:8080`) — error
2. Discord Bot API — error
3. PageSpeed Insights — warn
4. Disk free (data/) — warn
5. Entity store integrity — error
6. **Google Places API quota** — warn (80%+ 已用) / error (capped)
7. claude_cli — warn
8. ollama — warn
9. Recent batch failure rate (24h) — error (> 10%)

**通知**: 失败 → 推 `SYSTEM_ALERTS_DISCORD_WEBHOOK_URL`（rich Discord embed）

**调度（计划）**：
- 当前：手动 `npm run ops:health-check`
- 目标：通过 Hermes cron 每日跑一次（**daily cadence · 不需要每 5 分钟，无业务紧急性**）
- 实施路径：调用 `hermesCron(['create', 'every 24h', 'cd <repo> && npm run ops:health-check', '--name', 'daily-health-check'])` (`core/funnel/hermes-cron.js` wrapper 已就绪)
- 优先级：🔵 **低**（手动跑现在工作 OK，自动化是 nice-to-have）
- 详见 backlog G-18 in [SOP_OVERVIEW.md §8](SOP_OVERVIEW.md)

---

## 4. Backlog (G-11 / G-12 / 其他)

| ID | 内容 | 优先级 |
|---|---|---|
| **G-11** | 3rd-party scraper provider interface (outscraper / apify / brightdata fail-over) | 🟡 |
| **G-12** | Google Places API 多账号 rotation | 🟡 |
| **G-13** | Photos → master.md 素材库 + cloudinary 上传 | 🟡 |
| **G-14** | opening_hours → 销售最佳联系时间 signal | 🟢 |
| **G-15** | Tinyfish / Firecrawl 余额查询 API + UI 显示 | 🟡 |
| **G-16** | Cloudinary 存储使用率 dashboard | 🟢 |
| **G-17** | Twilio SMS + 10DLC 注册 | 🟡 (SOP-4) |
| **G-18** | Hermes cron 实际注册（替代手动 ops:health-check）| 🟡 |
