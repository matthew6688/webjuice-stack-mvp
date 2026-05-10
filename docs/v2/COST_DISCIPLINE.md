# V2 Cost Discipline

更新日期：2026-05-10

> **核心原则：** 在保证质量的前提下，最大限度地省费用。我们的 lead 量很大，不能对每个 lead 都投入同样的成本。低价值环节用本地免费方案；只有证据足够、走到下游的 lead 才使用付费 API；核心交付物（audit report、cold outreach 内容）质量不能让步，可用高级 LLM，但仍要先用 autoresearch 验证本地方案是否够用。

## 成本分级（cost tiers）

每个外部调用都必须归到一个 tier，stage matrix 决定这一阶段允许调到哪一 tier。

| Tier | 含义 | 例子 | 何时调用 |
|---|---|---|---|
| **T0** | 本地免费、零增量成本 | Mac mini 上的 Playwright/Puppeteer、本地 fetch、Lighthouse、Ollama 模型、本地 Maps 抓取 | 任何 lead，任何阶段 |
| **T1** | 免费额度 / 极低成本 API | Firecrawl 免费额度、Tinyfish dry-run、Kimi（订阅 plan 内）、Codex / Claude Code（订阅 plan 内） | discovery 池转正式后默认调；订阅内不算增量 |
| **T2** | 计量付费 API | Google Places、Firecrawl 超额、Perplexity、OpenAI API、Resend 发送 | 只有 lead 已通过 cheap audit + 证据足够，并且记日志 |
| **T3** | 高级 LLM（按 token 计费） | Claude Opus 在 API 上、GPT-4 / o1 类 | 仅核心交付物：audit report、sales cold outreach、proposal page；先用 autoresearch 比对 T0/T1，证明 T3 显著更好才用 |

## LLM stack（当前可用）

| 模型 / Provider | Tier | 调用方式 | 用途 |
|---|---|---|---|
| **Ollama**（本地） | T0 | `OLLAMA_URL`、`OLLAMA_MODEL` env | 大批量低风险任务：分类、关键词提取、第一遍 summarize |
| **Kimi / Moonshot**（订阅 coding plan） | T1 | `KIMI_API_KEY` / `MOONSHOT_API_KEY` env | 订阅内代码 + 写作类任务，订阅不超额时不计入增量成本 |
| **Codex** | T1 | 订阅 plan | 同上 |
| **Claude Code subscription** | T1 | 订阅 plan | 同上 |
| **Perplexity** | T2 | `PERPLEXITY_API_KEY` env | Lead 背景搜索补全：商家网评、本地新闻、行业数据 |
| **OpenAI API** | T2/T3 | `OPENAI_API_KEY` env | 看模型；`gpt-4o-mini` ~T2，`gpt-4` ~T3 |
| **Anthropic API**（仅核心） | T3 | 后续如启用，单独配 env | 仅 audit report / cold outreach / proposal page，且 autoresearch 证明显著优于 T1 才启用 |

API key 都在 `.env.local`（0600，gitignored）。生产环境通过 Cloudflare Pages secrets / GitHub Actions secrets。

## Stage 与允许的成本 tier

按 [QUEUE_LEADS_STAGE_MATRIX.md](../QUEUE_LEADS_STAGE_MATRIX.md) 的阶段，每个阶段的成本上限：

| Stage | 允许 tier | 备注 |
|---|---|---|
| `discovered` / `scored` | T0 | 仅本地规则评分，不上网 |
| `queued_for_audit` | T0 | 本地浏览器截图 + Lighthouse + 文本抓取，不调付费 |
| `ready_for_outreach_brief`（promote 前） | T0 + T1 | cheap audit 通过后，订阅内 LLM 做摘要 |
| `queued_for_enrichment` | T2（人工批准） | 只有 cheap audit 证明值得继续，才开 T2 spend；默认 dry-run |
| `new_lead` / `researching` | T0 + T1 + T2（受预算控制） | Perplexity / Firecrawl 在这里调；每次调用必须落 ledger |
| `ready_for_mockup` 之前 | 已完成所有上游 enrichment |  |
| `mockup_building` | T1 主力，T3 核心文档 | Open Design 跑本地 daemon（T0），audit 报告生成可用 T3 |
| `draft_ready` 邮件草稿 | T3 允许 | 邮件文案是核心交付物，质量优先 |
| `outreach_sent` 之后 | T0 + T1 主导 | reply 处理 / follow-up，本地 + 订阅 LLM 够用 |
| paid project queue | 按需 |  |

## 日志要求（强制）

**所有 T2 / T3 调用必须落** `data/finance/ledger.jsonl`，schema 至少包含：

```jsonc
{
  "ts": "2026-05-10T20:42:00Z",
  "tier": "T2",
  "provider": "perplexity",
  "model": "sonar-medium-online",
  "endpoint": "/chat/completions",
  "leadId": "ld_2026_05_08_a4f9",
  "clientSlug": "joes-roofing-austin",
  "stage": "researching",
  "operator": "matthew" | "system" | "cron",
  "tokens_in": 1240,
  "tokens_out": 380,
  "cost_usd": 0.0042,
  "campaign": "roofing-austin",
  "purpose": "lead_enrichment_background",
  "request_hash": "sha256(...)",
  "response_summary": "..."
}
```

读写 helper 在 `core/finance/ledger.js`（已存在，按 V2 扩展字段）。

每条 lead 的 cost 滚动总额必须能在 `/admin/leads/<slug>` 和报告里看到。

## 质量例外（quality non-negotiable）

下面的产物质量不能让步——如果本地/T1 方案明显劣于 T3，就用 T3：

1. **Internal audit report**（结构化 + 自然语言摘要）
2. **Sales cold outreach 内容**（3 角度邮件、SMS、电话脚本、objection handling）
3. **Client proposal page** 文案

但启用 T3 之前，必须先跑 autoresearch（见下）证明 T0/T1/T2 方案不够。

## Autoresearch 协议（pick optimal tier per task）

针对每个待选任务（如"生成 audit summary"），跑这个流程：

1. **Fixture set**：3-5 个真实 lead 的输入（同一份）
2. **Candidates**：T0（Ollama）、T1（Kimi）、T2（gpt-4o-mini）、T3（Claude Opus）各一份
3. **Judge**：人工 + 一个固定的高级 LLM judge 打分（事实正确性、语气、长度合规、空洞度）
4. **Decision**：只在 T3 显著优于次选 tier（>15% judge 分数差距）时才升 tier；否则保持低 tier
5. **写回**：决策落到 `docs/v2/autoresearch-results/<task>.md`，并更新 `core/llm/route.js` 的 task→tier 映射

参考：[docs/AUTORESEARCH_OPTIMIZATION_SOP.md](../AUTORESEARCH_OPTIMIZATION_SOP.md) 已有框架。

## 维护规则

新增任何 provider / model / 收费接口时，必须：

1. 在本文档「LLM stack」「Stage 与允许的成本 tier」两段加一行
2. 把它接入 `core/finance/ledger.js` 的 logging 入口
3. 在 `.env.local` 添加 env，并把 env 名（不是值）写到 [docs/SECURITY.md](../SECURITY.md) 的相关 stack 段落

不接 ledger 的付费调用算 bug。
