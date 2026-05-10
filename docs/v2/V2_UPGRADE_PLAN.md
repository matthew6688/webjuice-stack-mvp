# V2 Upgrade Plan — Audit-to-Demo Engine

更新日期：2026-05-10

> 本文档是 V2 升级的 **执行计划**，不是 PRD。原始 PRD 材料归档在 [docs/v2/source/](source/)。

## 两条主线

V2 不是给现有 mockup 流程打补丁，而是把整条 audit→demo→outreach 链做成结构化引擎：

1. **Lead 进来就下重功夫的预补强 + 结构化 audit + 三版报告**——补背景（Perplexity / 本地搜索 / Firecrawl）+ 6 维 39 项 audit + Visual Auditor + 三版 HTML 报告（内部 audit / sales 执行 / 客户 proposal）跟着 stage 流转
2. **网站质量靠 autoresearch loop 调优**——当前 Open Design 输出不够好，根因不清；用对照实验找瓶颈再优化

## Matthew 已拍板的决策（2026-05-10）

1. **停止单独的 (a) mockup 替换任务**；并入 V2 Phase 3 一起做
2. **三版报告先做 internal audit 版**（其他两版基于它）
3. **成本纪律**：见 [COST_DISCIPLINE.md](COST_DISCIPLINE.md)。原则：本地免费优先；付费 API 必须 ledger 全记录；核心交付物（audit / outreach / proposal）质量不让步，但启用 T3 LLM 前必须 autoresearch 证明
4. **状态机**（我的决定）：扩展现有 `core/funnel/stage-config.js`，**不**搞并行状态机
5. **6 维 audit 与 cheap audit 分级共存**（cheap audit = 决定是否花钱进入 detailed audit 的关口）
6. **真实样本**：`clients/od-handoff-roofer-smoke`、`clients/od-native-clean-roofer-smoke-v2`、`clients/babylon-brisbane-restaurant`、`clients/rich-and-rare-longterm-smoke-v4` 等，已有真实 OD 输出，作为 autoresearch baseline。`clients/od-native-clean-roofer-smoke-v2` 还带 `concept-quality-audit.json/md`，是"我们 audit OD 输出"的现成样本
7. **Proposal page 域名**（我的决定）：用我们官方子域 `proposal.profitslocal.com/<slug>`。理由：品牌一致性、统一埋点、不依赖客户 DNS（lead 还没付钱前就能展示）、可一键下线
8. **Apex Roofing 是 PRD 杜撰的示例**，不存在于 clients/。autoresearch 用上面真实样本

## API key 与 LLM stack

新增到 `.env.local`（0600，gitignored）：

- `PERPLEXITY_API_KEY`（dev key 已落，prod 需轮换）
- `KIMI_API_KEY` / `MOONSHOT_API_KEY`（同上）

完整 stack 见 [COST_DISCIPLINE.md#LLM-stack](COST_DISCIPLINE.md)。

## 状态机扩展

把 PRD 状态机的新阶段加进 `core/funnel/stage-config.js`：

| 新增 stage | 插入位置 | 含义 |
|---|---|---|
| `enriched` | `queued_for_audit` 之前 | 完成 lead 背景预补强（Perplexity / 搜索 / Firecrawl） |
| `proposal_ready` | `mockup_ready` → `draft_ready` 之间 | proposal page 已生成、截图已拍、客户可见 URL 已上线 |
| `negotiating` | `replied` → `paid_handoff` 之间 | 客户回复有兴趣，但还在沟通价格 / 范围 |
| `live` | `paid_handoff` 之后 | 已上线 |
| `archived` | 终态 | 已上线 / 跳过的长期归档 |

`enriched` 是**所有入口**汇入正常流程的关键中转点：maps_scraper / image-discovery / manual intake 全部经过 `enriched`，再决定走 `queued_for_audit`（自动）或直接 `manual_review`。

PRD 的 `qualified` 已经存在（`promoted` ≈ qualified），不重复。
PRD 的 `demo_built` ≈ 现有 `mockup_ready`，不改名以减少代码连带改动。

## PRD 组件 vs 现有代码映射

| V2 组件 | 现有对应 | 状态 | 责任 |
|---|---|---|---|
| `business_profile` | `data/leads/entities/<key>.json` + `lead-registry.js` | 部分有，字段对齐 | Phase 1 |
| `audit_result`（6 维 39 项） | `core/leads/site-audit.js`（cheap） | 缺 detailed | Phase 1 |
| `visual_audit`（Vision 1-10） | 无 | 全新 | Phase 1 |
| `lead_enrichment`（背景搜索） | 无 | 全新 | Phase 1 |
| `sales_angle` | `core/leads/copy-brief.js` 部分 | 重新结构化 | Phase 2 |
| `outreach_content`（多角度多渠道） | `outreach/email/01-*.json` 单封 | 大幅扩展 | Phase 4 |
| `proposal_page` | 无 | 全新 | Phase 4 |
| `demo_site`（Open Design + template） | 现有，但 build-mockup-artifacts placeholder | 进行中 → Phase 3 | Phase 3 |
| `internal_sales_report` | 无 | 全新 | Phase 2 |
| 三版 HTML 报告 | 无 | 全新 | Phase 2 |

## 分阶段执行

### Phase 0 ✅（这次提交完成）

- 归档 PRD 4 份原始材料到 [docs/v2/source/](source/)
- 写 [COST_DISCIPLINE.md](COST_DISCIPLINE.md) + 本计划
- API key 进 `.env.local`
- 状态机扩展点定下

### Phase 1：预补强 + 结构化 audit + visual auditor

**目标：** 每个 lead 都能产出标准化 `business_profile` + `audit_result`（6 维 39 项）+ `visual_audit`，无论从哪个入口进。

新增模块：

| 模块 | 路径 | tier | 说明 |
|---|---|---|---|
| Lead enrichment | `core/leads/enrichment.js` | T0→T2 路由 | 先本地搜索 + Firecrawl 免费额度；不够再调 Perplexity |
| Perplexity 客户端 | `core/llm/perplexity.js` | T2 | 必须接 `core/finance/ledger.js` |
| 6 维 audit 引擎 | `core/leads/site-audit-detailed.js` | T0 主力 | 按 [scoring spec](source/workflow-summary.md) 的 39 项规则；Lighthouse + DOM + Playwright |
| Visual auditor | `core/leads/visual-audit.js` | T1/T3 | 截图 → vision 判 freshness/trust/conversion 1-10；先 Kimi/Claude Code 试，autoresearch 决定终选 |
| Screenshot pipeline | `scripts/leads/capture-site-screenshots.js` | T0 | 给 audit 和 visual auditor 用，desktop + mobile |
| 入口统一 | `scripts/leads/intake.js` 改 | — | 落到 `enriched` 而非 `new_lead`，强制走 audit 流程 |
| Cost ledger 扩展 | `core/finance/ledger.js` | — | 加 V2 schema 字段（leadId, clientSlug, stage, request_hash） |

**验证：** 用 `clients/od-native-clean-roofer-smoke-v2` 作为输入，跑出完整 6 维分数 + visual audit JSON。

### Phase 2：三版 HTML 报告 + 状态机升级

**目标：** lead 一旦有 `audit_result`，自动生成 internal audit report HTML；后续随 stage 推进追加 sales / proposal 版。

| 报告 | 路径 | 受众 | 内容来源 |
|---|---|---|---|
| Internal audit | `clients/<slug>/reports/internal-audit.html` | 内部运营 + AI | enrichment + 6 维 audit + visual audit + 评分决策 + 证据链路径 |
| Sales execution | `clients/<slug>/reports/sales-execution.html` | 销售操作员 | audit 摘要 + sales angle + outreach 内容 + 跟进节奏 + objection |
| Client proposal | `clients/<slug>/reports/client-proposal.html`（公开版同步到 `proposal.profitslocal.com/<slug>`） | 客户本人 | 问题（客户语言）+ 改进卡 + before/after + demo URL + ROI + FAQ + CTA |

新增模块：

| 模块 | 路径 |
|---|---|
| 报告生成器 | `core/reports/generate.js`（derived，stage 变更触发重生成） |
| 报告模板 | `core/reports/templates/{internal,sales,client}.{html,css}` |
| 报告路由（admin） | `src/pages/admin/leads/<slug>/report.astro` |
| 公开 proposal 路由 | `functions/proposal/[slug].ts`（Cloudflare Pages function） |
| 状态机扩展 | `core/funnel/stage-config.js` 加 `enriched / proposal_ready / negotiating / live / archived` |

**验证：** 用 Phase 1 的 audit 输出，生成内部 audit 报告 HTML；和 [docs/v2/source/example-end-to-end-part2.json](source/example-end-to-end-part2.json) 的 internal_sales_report schema 字段对比。

### Phase 3：Autoresearch loop + 真实 mockup artifact 替换

**目标：** 找到"为什么 Open Design 输出不够好"的根因，并用真实 OD 输出替换 placeholder。

子任务（合并了之前的 (a)）：

1. **screenshot capture**（之前 (a) 的核心缺口）：写 `scripts/leads/capture-concept-screenshots.js`，用 Playwright 把 `clients/<slug>/concept/open-design/index.html` 渲染成 desktop + mobile PNG
2. **build-mockup-artifacts 接真实输出**：删 placeholder 1×1 PNG / dummy HTML 那段（约 lines 69-89, 168-198），改为读真实 concept + 拷贝到 `public/admin-artifacts/<slug>/`，并加 validation gate
3. **autoresearch 实验**（4 组对照）：
   - A. brief 长度（minimal vs full）→ OD 创意是否被信息量限制
   - B. 模板填充 vs 全 redesign → 哪个稳、哪个好看
   - C. cheap audit vs 6 维 detailed audit 喂给 OD → audit 详细度对输出的影响
   - D. 我们 audit OD 输出 vs 第三方（高级 LLM）audit → 我们的 audit 标准是否本身就低
4. **决策落地**：每个实验跑 3-5 个 lead，统一打分；找最大瓶颈，针对它再做一轮

**验证：** 选 2 个 lead，A/B 测试至少一组变量；得分差异 >15% 才采纳改动。

### Phase 4：Outreach 多角度 + Proposal page

**目标：** 单封 email 升级到 PRD 规格的 multi-angle 套件。

| 输出 | 来源 |
|---|---|
| 3 封 cold email（不同角度） | `core/leads/outreach-content.js` |
| SMS 1-2 版（160 char） | 同上 |
| 电话开场 + hook + transition | 同上 |
| DM（FB / LinkedIn） | 同上 |
| Day 3 / 7 / 14 跟进序列 | 同上 |
| 5 条 objection + response | 同上 |
| Proposal page HTML（公开） | `core/reports/templates/client.html` + `functions/proposal/[slug].ts` |

**邮件发送依然手工**（[QUEUE_LEADS_STAGE_MATRIX.md](../QUEUE_LEADS_STAGE_MATRIX.md) 的决策），Phase 4 只生成内容，发动作走 Phase 5+ 自动化。

## 仍未拍板的开放问题

1. **Phase 1 enrichment provider 路由顺序**：先本地搜索（Playwright + DDG/Bing 免费）→ Firecrawl 免费额度 → Perplexity？还是直接 Perplexity 跑一阶段，等量大了再换？我倾向前者（省钱），但前者要写更多代码
2. **Visual auditor 哪个模型**：Kimi vision、Claude Sonnet vision、还是 GPT-4o vision？要先 autoresearch
3. **报告样式**：内部 audit 报告走严肃 monospace dashboard 风，还是品牌化的现代风？我倾向前者（运营用，信息密度高）
4. **Proposal page 公开 URL 形态**：`proposal.profitslocal.com/<slug>`（独立子域，需配 Cloudflare DNS）vs `profitslocal.com/p/<slug>`（同一域路径，无需新 DNS）。我倾向后者起步（零 DNS 工作量），等业务跑稳再切子域

## 维护规则

V2 推进过程中：

- 任何阶段交付物完成，更新本文档对应 phase 段（标 ✅ 或回退原因）
- 状态机改动 → 同步 [QUEUE_LEADS_STAGE_MATRIX.md](../QUEUE_LEADS_STAGE_MATRIX.md)
- 新付费 API 接入 → 同步 [COST_DISCIPLINE.md](COST_DISCIPLINE.md) + [SECURITY.md](../SECURITY.md)
- autoresearch 决策 → 落到 `docs/v2/autoresearch-results/<task>.md`
