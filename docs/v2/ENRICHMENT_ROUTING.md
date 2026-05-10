# V2 Enrichment Routing

更新日期：2026-05-10

> Lead 进入系统后必须经过 `enriched` 中转。本文档定义 enrichment 阶段调用搜索 / 抓取 provider 的顺序、失败回退、key rotation 和 ledger 记录规则。

## 路由顺序（fail-soft，先 free 后 paid）

> **2026-05-10 修订：** 实测 Tinyfish `api.search.tinyfish.ai` + `api.fetch.tinyfish.ai` 都是免费 + 结构化输出（search 1.68s/10 SERP，fetch 5.4s/markdown），质量足够当 T0 主力。Dokobot 退到 JS-heavy / 登录墙场景。
>
> **Rate limit：** Tinyfish 免费但可能有每分钟限速。`core/extractors/tinyfish.js` 必须带本地 token-bucket（默认 30 req/min，可调），429 自动 backoff + 跳到下一档（不堆 retry）；命中限速也写 ledger 一条 `provider_rate_limited` 事件，便于事后调阀值。

Search 路由（找信息源）：

```
  search query arrives ───►┌────────────────────────────┐
                           │ 1. Tinyfish Search          │  T0  免费，结构化 SERP
                           │    api.search.tinyfish.ai   │      默认入口
                           └────────┬───────────────────┘
                                    │ fail / insufficient
                                    ▼
                           ┌────────────────────────────┐
                           │ 2. Dokobot Doko Search      │  T0  本地 Chrome
                           │    (local skill)            │      JS-heavy 场景
                           └────────┬───────────────────┘
                                    │ fail
                                    ▼
                           ┌────────────────────────────┐
                           │ 3. DuckDuckGo via Playwright│  T0  备援 SERP
                           └────────┬───────────────────┘
                                    │ fail
                                    ▼
                           ┌────────────────────────────┐
                           │ 4. Perplexity sonar-online  │  T2  rotation，最后兜底
                           └────────────────────────────┘
```

Fetch 路由（抓页面内容）：

```
  url arrives ───►┌────────────────────────────┐
                  │ 1. Tinyfish Fetch           │  T0  免费，markdown 输出
                  │    api.fetch.tinyfish.ai    │      默认入口
                  └────────┬───────────────────┘
                           │ fail / blocked / JS-rendered empty
                           ▼
                  ┌────────────────────────────┐
                  │ 2. Dokobot read --local     │  T0  本地 Chrome 渲染
                  │    (local skill)            │      JS-heavy / 登录墙
                  └────────┬───────────────────┘
                           │ fail
                           ▼
                  ┌────────────────────────────┐
                  │ 3. Firecrawl                │  T1 (free quota) → T2
                  │    multi-key rotation       │  仍失败时计成本
                  └────────────────────────────┘
```

Synthesis 路由（要 LLM 综合多源得到一段背景描述）：

```
  research question ───►┌────────────────────────────┐
                        │ Perplexity sonar            │  T2  rotation
                        │ + grounding URLs from above │
                        └────────────────────────────┘
```

Perplexity 不和 Tinyfish 抢"找内容"这一步——它的强项是把已有 URL 列表 + 问题喂进去拿到 LLM 综合答案。Synthesis 是 enrichment 的最后一档可选输出。

`fail / insufficient` 判断由调用方给出（例如：HTTP 非 200、返回内容字符数不足、关键字段缺失、search snippet 0 命中）。每一档尝试一次，失败或不够才升档。

## Multi-key rotation

Firecrawl 和 Perplexity 都支持多账号 / 多 key。Admin 在 `/admin/settings` 维护 key 池，每个 provider 一个 list：

```jsonc
{
  "providerKeys": {
    "firecrawl": [
      { "id": "fc_1", "label": "primary", "status": "active", "monthlyCap": 500, "monthlySpend": 142.30 },
      { "id": "fc_2", "label": "backup",  "status": "active", "monthlyCap": 500, "monthlySpend": 0 }
    ],
    "perplexity": [
      { "id": "pplx_1", "label": "matthew-personal", "status": "active", "monthlyCap": 100, "monthlySpend": 18.40 }
    ]
  }
}
```

Key 真值（`pplx-...`、`fc-...`）**仍然只能存在 `.env.local` / Cloudflare secrets**，不进 `/admin/settings` 持久层。Admin UI 只编辑元数据（label、status、cap）。新 key 通过给一个**复制 env 行**的按钮提示 operator 落到 `.env.local` —— 与现有 `/admin/settings` 的 masked-only 契约一致。

Rotation 选择策略（`core/llm/key-rotation.js`）：

1. 过滤 `status="active"` 的 key
2. 过滤 `monthlySpend < monthlyCap` 的 key
3. 按 `monthlySpend` 升序，挑用得最少的（least-loaded）
4. 调用失败（429 / 402）→ 自动降级该 key 状态为 `cooldown`，进入下一个

每个 key 只用到 80% cap 就停（留 buffer），超 cap 就跳过到下一个。所有 key 全部冷却 / 超 cap → 任务停在该档，记 `provider_quota_exhausted` 事件。

## Ledger 必登记字段（V2 扩展）

每次外部 provider 调用都写一条到 `data/finance/ledger.jsonl`，复用现有 `core/finance/ledger.js`，新增字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | enum | ✓ | 现有；V2 新增枚举：`perplexity`、`dokobot`、`tinyfish`、`ddg_local`（即使 T0 也登记，便于成本/收益分析） |
| `provider` | string | ✓ | 现有 |
| `keyId` | string | T2 | 多 key rotation 时记哪个 key 被用（不记 key 真值） |
| `tier` | enum | ✓ | T0/T1/T2/T3 |
| `leadId` | string | ✓ | V2 新增，关联到 lead |
| `clientSlug` | string | ✓ | 现有 |
| `stage` | string | ✓ | V2 新增，发生时 lead 处于哪个 stage |
| `purpose` | string | ✓ | V2 新增，例如 `lead_enrichment_background`、`site_content_scrape`、`audit_summary` |
| `requestHash` | string | ✓ | V2 新增，请求内容 sha256，便于命中重复调用并去重计费 |
| `units` | number | ✓ | 现有，例如 token 数、page 数、search query 数 |
| `unitCost` | number | ✓ | 现有；T0 写 0 |
| `amount` | number | ✓ | 现有 |
| `metadata` | object | — | 现有，存 model / endpoint / tokens_in_out / response_summary |

T0（dokobot / DDG / tinyfish）也登记，`amount=0`，但记 `units`。这样 `/admin/leads/<slug>` 能展示"为这个 lead 跑了多少次免费搜索 + 多少次付费查询"，便于你判断什么时候该升档。

## 实现拆分（Phase 1）

| 模块 | 路径 | 职责 |
|---|---|---|
| Provider router | `core/leads/enrichment.js` | 按上面 search/fetch/synthesis 三组顺序降级；返回标准化 `EnrichmentResult` |
| Tinyfish search | `core/extractors/tinyfish.js`（扩展） | 加 `search()` 入口调 `api.search.tinyfish.ai`；返回 [{position, title, snippet, url}] |
| Tinyfish fetch | `core/extractors/tinyfish.js`（扩展） | 加 `fetch()` 入口调 `api.fetch.tinyfish.ai`；返回 markdown + title/description |
| Dokobot client | `core/scrape/dokobot.js` | spawn `dokobot read --local` 和 Doko Search skill；JS-heavy / 登录墙场景 |
| DDG client | `core/scrape/ddg.js` | Playwright 抓 SERP；备援 search |
| Firecrawl rotation | `core/extractors/firecrawl.js`（扩展） | 接 key-rotation；现有单 key 调用平滑迁移；最后档 fetch |
| Perplexity client | `core/llm/perplexity.js` | 新增；接 key-rotation 和 ledger；用于 synthesis 而非 retrieval |
| Key rotation | `core/llm/key-rotation.js` | 通用 least-loaded 选 key；失败降级 cooldown |
| Provider keys store | `data/admin/provider-keys.json`（gitignored） | Admin 编辑的 key 元数据；key 真值仍在 .env |
| Admin UI | `src/pages/admin/settings.astro`（扩展） | 加 multi-key 元数据管理 tab |

## 失败语义

- **insufficient**：返回有内容但不够，进入下一档
- **error / timeout**：当前档算失败，记 `provider_error` 到 ledger（`amount=0`），换 key 或进入下一档
- **quota exhausted**：所有 active key 用尽 → 整个 enrichment task 标 `provider_quota_exhausted`，停在该档，**不**自动跳到 T2 的下一个 provider 烧钱（避免连环失败堆账单）
- **task 整体失败**：lead 状态留在 `queued_for_enrichment`，operator 在 `/admin/queue` 看到原因，决定补 key 还是手工跳过

## 与现有 stage 的对接

`enriched` stage 的进入标准：路由跑完后，至少一档返回 `sufficient`，且 lead 拿到了：

- `business_name`（已有，从入口带入）
- `address` + `phone`（任意搜索结果验证或补全）
- `website_url`（如果入口没给）
- 至少 1 段 `background_summary`（competitor / 行业 / 本地新闻片段）
- 至少 3 个 `evidence_sources`（URL 列表，给后续 detailed audit 用）

不达标 → 留 `queued_for_enrichment`，admin queue 显示缺什么。

达标 → 推到 `queued_for_audit`（已有），自动进入 6 维 detailed audit。
