# Queue / Leads 阶段矩阵

更新日期：2026-05-10

这份文档定义 `/admin/queue` 和 `/admin/leads` 的分界、阶段含义、应该展示的数据，以及每个阶段的默认动作。它是后台线索推进 UI、自动化按钮、日志记录和后续 SOP 的对齐源。

> **维护规则：** 当 `core/funnel/stage-config.js`、`QUEUE_ACTION_DEFINITIONS`、入口脚本或阶段流转逻辑发生变化时，必须同步更新本文档的「入口」「阶段流转图」「自动化状态表」三段。这份文档是 source of truth，不是回顾文档。

当前代码层面的共享配置在 `core/funnel/stage-config.js`。页面、lead index、queue action runner 和 Cloudflare action 入口都应该优先复用这里的阶段标签、进入标准和可执行动作定义，避免 Queue、Leads、脚本各写一套。

Queue 后台动作日志统一写入 `data/leads/queue-operations.jsonl`，读写 helper 在 `core/funnel/queue-operations.js`。每条记录必须包含 action、entity/client、operator、dry-run、命令、状态、输出摘要和成本策略；`/admin/queue` 只把最近记录放在默认折叠区。

阶段迁移 hard evidence：

- `npm run leads:test-discovery-to-mockup-stage`
- 覆盖 `discovery researching -> promote -> ready_for_mockup -> approve_mockup -> mockup_building -> build_mockup_artifacts -> mockup_ready -> build_outreach_email_draft -> draft_ready`
- 验证 promote / approval / artifact / draft 产物：`lead-intake.json`、`lead-ops.json`、`audit/current-site-audit.json`、`outreach/lead-notes.jsonl`、`concept/open-design/mockup-request.json`、`outreach/outreach-pack.json`、`outreach/outreach-pack.md`、`concept/open-design/mockup-artifacts.json`、`public/admin-artifacts/<client>/mockup-preview.html`、`outreach/email/01-<client>.json`

## 入口

线索进入系统的合法 source 在 `core/leads/intake.js#LEAD_SOURCE_TYPES`。当前真正接通脚本的入口有 5 个：

| # | 入口 | source type | 入口脚本 / 模块 | 着陆位置 | 起始 stage |
|---|---|---|---|---|---|
| 1 | Google Maps 抓取（主入口） | `maps_scraper` | `scripts/leads/maps-scraper-discovery.js` → `core/leads/discovery-store.js` | `data/leads/entities/<entity-key>.json` | `discovered → scored → queued_for_audit` |
| 2 | 图片线索发现 | `imported_list` | `scripts/leads/image-lead-discovery.js` → `core/leads/discovery-store.js` | 同 #1 | `queued_for_audit` |
| 3 | 手工 / 导入 intake | `manual` / `imported_list` / `referral` | `scripts/leads/intake.js` → `core/leads/intake.createLeadIntake` | `clients/<slug>/lead-intake.json` | `new_lead`（**目标：统一汇入 cheap audit 流程**，见下） |
| 4 | 付费下单（Tally / Stripe） | `paid_intake` | `core/funnel/tally.js` + `submission-router.js` → `paid-intake-index` | `data/paid-intakes/<slug>/<order>.json` | `paid_handoff` 直入 + 进项目交付队列 |
| 5 | Provider 回复匹配 | `provider_reply` | `core/funnel/outreach-provider-event.js`（Resend / Agentic Inbox webhook） | 已存在 lead 上更新事件 | 把现有 lead 推到 `replied` / `bounced` |

still-LEAD_SOURCE_TYPES 占位但未接通：`website_inbound`、`existing_project_reentry`。

设计原则：**所有入口最终汇入同一条流程**，区分只在事后核实时做。当前 #3 手工 intake 直接落 `new_lead`，绕开 cheap audit；后续要让它也经过 `queued_for_audit`，保持每个 lead 都有一份 cheap audit 证据。Cold outreach 是主力，paid_intake 是少数；不为 paid_intake 单独设计前置逻辑。

## 阶段流转图

```
PHASE 0 · ENTRIES
  [maps_scraper]  [image-discovery]  [manual intake]  [paid_intake]  [provider_reply]
        │                │                  │                │              │
        ▼                ▼                  ▼                │              ▼
                                       (目标：补 audit)        │      更新已有 lead
        ▼                ▼                  ▼                │      → replied / bounced
PHASE 1 · DISCOVERY POOL  (data/leads/entities/)              │
  discovered → scored → queued_for_audit                       │
                              │                                │
                              │ ▶ run_cheap_audit              │
                              ▼                                │
                  ┌─ ready_for_outreach_brief ─┐               │
                  ├─ queued_for_enrichment ────┤               │
                  ├─ manual_review ────────────┤               │
                  └─ skipped ──────────────────┘               │
                              │                                │
                              │ ▶ promote_discovery            │
                              ▼                                │
                          promoted                              │
                              │                                │
                              ▼                                │
PHASE 2 · FORMAL LEAD  (clients/<slug>/)                       │
  new_lead → researching → (needs_human / needs_evidence)      │
                  │                                            │
                  ▼                                            │
              ready_for_mockup                                  │
                  │ ▶ approve_mockup            (人工关口)      │
                  ▼                                            │
              mockup_building                                   │
                  │ ▶ build_mockup_artifacts    (V2 替换中)     │
                  ▼                                            │
              mockup_ready                                      │
                  │ ▶ build_outreach_email_draft               │
                  ▼                                            │
              draft_ready                                       │
                  │ ✗ send_outreach              (缺)           │
                  ▼                                            │
              outreach_sent ◄─────────────────────────────────┘
                  │ ✗ follow-up timer            (缺)
                  ▼
       ┌─ follow_up_due ─┬─ replied ─┬─ bounced ─┐
       └─────────────────┴─────┬─────┴───────────┘
                               │ ✗ record_reply_intent (缺)
                               ▼
              paid_handoff ◄── PHASE 0 paid_intake 直入
                  │
                  ▼
PHASE 3 · PAID PROJECT QUEUE  (data/paid-intakes/) — /admin/intakes
  review_ready · revision_pending · waiting_dns
  missing_open_design · od_failed · qa_blocked
```

## 自动化状态表

把 `QUEUE_ACTION_DEFINITIONS` + `LEAD_QUEUE_GROUP_META.automationMode` 拍平：

| 转移 | Action | 模式 | 状态 |
|---|---|---|---|
| `queued_for_audit → ready_for_outreach_brief / manual_review / skipped` | `run_cheap_audit` | auto | ✅ |
| `queued_for_audit → queued_for_enrichment` | `plan_enrichment` | cost_gate（dry-run 默认） | ✅ |
| `queued_for_enrichment → ready_for_outreach_brief` | `approve_enrichment_spend` | cost_gate（人工批） | ✅ |
| `ready_for_outreach_brief → promoted/new_lead` | `promote_discovery` | auto | ✅ |
| `new_lead → researching` | `research.js` | auto | ✅ |
| `researching → needs_human / ready_for_mockup` | （AI 判断） | auto | ✅ |
| `ready_for_mockup → mockup_building` | `approve_mockup` | 人工关口 | ✅ |
| `mockup_building → mockup_ready` | `build_mockup_artifacts` | auto | ⚠ V1 placeholder，V2 替换中 |
| `mockup_ready → draft_ready` | `build_outreach_email_draft` | auto | ✅ |
| `draft_ready → outreach_sent` | — | — | ❌ 缺 `send_outreach` action |
| `outreach_sent → follow_up_due` | — | timer | ❌ follow-up 调度未接 |
| `outreach_sent → replied / bounced` | provider event | webhook | ⚠ 事件接收有，状态写回需逐条核实 |
| `replied → paid_handoff` | — | 人工 | ❌ 缺 `record_reply_intent` action |
| `manual intake → queued_for_audit` | — | — | ❌ 当前直接进 `new_lead`，未汇入 audit 流程 |

## 设计分界

`/admin/queue` 是行动驾驶舱。

- 回答：现在该处理什么？为什么卡住？下一步按哪个动作？
- 大多数阶段应该自动推进；Queue 主要展示积压、失败、重试、日志和少数人工关口。
- 只展示足够做决策的摘要、证据、缺项和按钮。
- 详细日志、工具调用、成本、完整原始证据默认收缩，或者跳到 `/admin/leads` 看。
- 一个 Queue item 被处理后，应该从当前动作队列里消失或进入下一动作阶段。

按钮设计原则：

- 自动阶段：按钮是 fallback / retry / debug，不是正常工作方式。
- 人工关口：按钮才是主动作，例如转正式/跳过/继续研究、批准样稿。
- 成本关口：按钮必须表达是否批准花钱，默认只做 dry-run。
- 任何自动执行都必须写 `queue-operations.jsonl`，让 operator 能追踪发生了什么。

`/admin/leads` 是线索 CRM 和证据库。

- 回答：这个客户是谁？我们为什么这样判断？所有证据和历史在哪里？
- 保存完整客户档案、地图抓取来源、官网审计、AI 判断、Open Design 输入、样稿、触达包、日志和人工备注。
- 线索页可以重，不怕信息多；但必须让人能追溯每一次 promote、skip、mockup、outreach 的理由。

## 上游抓取池阶段

这些阶段来自 `core/leads/discovery-store.js` 和 `data/leads/discovery-index.json`，主要进入 `/admin/queue`。

| 阶段 | 中文名 | 代码数据 | Queue 应显示 | Leads 应保留 | 默认动作 |
|---|---|---|---|---|---|
| `queued_for_audit` | 待初筛审计 | `entity.latest.name`、`phone`、`website`、`websiteStatus`、`category`、`rating`、`review_count`、`sourceQuery`、`discoveryScore`、`identifiers.place_id` | 商家名、地区/搜索词、官网状态、电话、分类、评分、抓取分、Place ID 是否有 | 原始抓取记录、run history、tool log、source query、去重 key | `run_cheap_audit`，执行 `leads:audit-discovery-sites` |
| `ready_for_outreach_brief` | 待转正式线索 | 上面字段 + `data/leads/audits/<entity-key>/current-site-audit.json` | 审计分数、审计摘要、销售切入点、Open Design 方向、官网/电话/审计/Place ID 检查项 | promote 后复制 audit、outreach brief、lead-ops 结果到 `clients/<client>/` | `promote_discovery`，执行 `leads:promote-discovery-store` |
| `queued_for_enrichment` | 待补资料 | 抓取字段 + audit decision + 缺口原因 | 缺什么：邮箱、联系页、社媒、准确地址、Google 商家信息；显示补资料原因 | dry-run enrichment plan、Tinyfish/Google Places 调用计划、成本策略 | `plan_enrichment`，先 dry-run，不默认花钱 |
| `manual_review` | 待人工判断 | 抓取字段、audit、AI 判断冲突、低置信度原因 | 冲突点、审计分、官网/联系方式、为什么不能自动决定 | 人工备注、跳过/转正式/继续研究理由 | `keep_manual_review`、`promote_discovery` 或 `skip_lead` |
| `skipped` | 已跳过 | `skipReason`、低分原因、审计结果 | Queue 默认不展示，除非有“重新打开”视图 | 跳过理由、已花成本、证据快照 | 保留记录，不继续烧钱 |

## 正式线索阶段

这些阶段来自 `core/funnel/lead-outreach-index.js`，主要由 `/admin/leads` 持久展示，部分高优先动作进入 `/admin/queue`。

| 阶段 | 中文名 | 代码数据 | Queue 应显示 | Leads 应显示 | 默认动作 |
|---|---|---|---|---|---|
| `new_lead` | 新线索 | `clientSlug`、`company`、`source`、基础联系字段 | Queue 通常不优先展示，除非缺自动研究任务 | 来源、基础档案、待研究状态、初始日志 | `research_more`，自动建档并研究 |
| `researching` | 研究中 | `leadResearch`、官网/地图/截图/OCR 状态、`nextAction` | Queue 只显示卡住或超时的研究任务 | 研究证据、官网、社媒、服务、地区、联系人、工具日志 | 等自动研究，或人工补证据 |
| `needs_human` | 需人工判断 | `aiAssessment`、`blockingReason`、`currentSiteAuditScore`、`currentSiteSalesDecision` | 判断冲突、AI 置信度、审计分、销售切入点、缺项检查 | 完整 AI 评分卡、审计报告、人工决策日志 | 批准样稿、跳过、继续研究 |
| `ready_for_mockup` | 可做样稿 | `officialWebsiteUrl`、`phone/email`、`currentSiteAudit*`、`openDesignBrief`、`websiteBuildHandoffPath` | 联系方式、官网问题、审计结论、Open Design 方向、为什么值得做样稿 | 现站截图、审计 JSON/MD、ready-to-build、Open Design handoff | `approve_mockup`：写人工批准 note，并创建 `concept/open-design/mockup-request.json` |
| `mockup_building` | 样稿制作中 | `previewUrl`、`outreachPackPath`、Open Design run 状态 | Queue 只显示缺触达包或失败项 | Open Design run status、manifest、截图、生产交接 | `build_mockup_artifacts`：生成样稿证据包、preview manifest 和 outreach pack |
| `mockup_ready` | 样稿就绪 | `previewUrl`、`assetsReady`、截图/证明素材 | 样稿链接、证明素材是否齐、触达角度 | 样稿 URL、桌面/手机截图、素材清单、质量审计 | `build_outreach_email_draft`：生成 cold outreach draft，不发送 |
| `draft_ready` | 草稿就绪 | `emailDraftReady`、`outreachChannelRecommendation`、`outreachPackPath` | 发送对象、推荐渠道、主卖点、草稿是否可审 | 草稿正文、事实核查、链接、发送渠道 | 发送前人工检查 |
| `outreach_sent` | 已发送 | `outreachSent`、provider event、`nextFollowUpDue` | Queue 默认不展示，直到 follow-up 到期 | 发送时间、渠道、provider id、正文版本 | 等回复或安排 follow-up |
| `follow_up_due` | 待跟进 | `nextFollowUpDue`、发送历史、回复状态 | 上次发送时间、跟进建议、渠道、主卖点 | 完整触达历史、回复/退信事件 | 记录已跟进、记录已回复、跳过 |
| `replied` | 已回复 | `replyState`、回复摘要、兴趣判断 | 回复摘要、下一步成交交接按钮 | 原始回复、意向、后续任务、人工备注 | 进入成交交接或跳过 |
| `bounced` | 退信 | `bounceState`、失败邮箱、provider event | 失败原因、替代联系方式、是否值得重找邮箱 | provider event、退信日志、替代渠道尝试 | 修正邮箱、换渠道、跳过 |
| `paid_handoff` | 成交交接 | `paymentStatus`、`orderId`、`websiteTaskThreadId` | Queue 不作为 lead 队列展示，进入项目队列 | 成交证据、报价、交接文件、项目 workspace | 创建/打开正式项目 |
| `skipped` | 已跳过 | `skipReason`、人工/AI 决策 | Queue 默认不展示 | 跳过理由、已做证据、重新打开入口 | 可重新打开 |

## 付费项目动作队列

这些来自 `core/funnel/paid-intake-index.js`，在 `/admin/queue` 底部保留为“项目交付队列”，不混入售前线索。

| 队列 | 中文名 | 代码数据 | Queue 应显示 | 默认动作 |
|---|---|---|---|---|
| `revision_requested` | 先处理修订 | `status`、`revisionUsed`、客户反馈 | 客户、订单、修订次数、阻塞点、下一步 | 打开项目处理修订 |
| `review_ready` | 发客户验收 | `stageSummary.key`、`previewUrl`、QA 状态 | 预览链接、QA 是否通过、客户联系路径 | 发送 review |
| `waiting_dns` | 等待域名解析 | `artifactSummary.domainStatus` | 域名状态、下一步说明、客户联系路径 | 跟进 DNS |
| `missing_open_design` | 缺少设计输入 | `artifactSummary.openDesignBound` | 是否绑定 Open Design、缺什么输入 | 绑定设计输入 |
| `od_failed` | 设计生成失败 | `artifactSummary.openDesignPipelineState` | 失败状态、run 信息、下一步修复动作 | 修复或重跑 Open Design |
| `qa_blocked` | 质检阻塞 | `artifactSummary.deliveryQaReady` | QA 缺口、预览、生产交接状态 | 补 QA |

## Queue 卡片信息规范

每张 Queue 卡片最多分四层：

1. 顶部摘要：状态、商家名、地区/行业、联系方式、下一步动作。
2. 关键事实：最多 6 个，例如抓取分、Google 评分、审计分数、档案完整度、订单状态。
3. 决策证据：最多 3 条，例如销售切入点、触达角度、Open Design 方向、阻塞原因。
4. 检查项：官网、联系方式、现站审计、设计输入、样稿链接、证明素材、触达草稿、触达包。

工具、日志和成本默认收缩：

- 工具：maps scraper、site audit、Tinyfish dry-run、Google Places dry-run、Open Design、outreach provider。
- 日志：`queue-operations.jsonl`、`discovery-events.jsonl`、`lead/discovery-log.jsonl`、lead note、provider event。
- 成本：是否调用付费 API、是否抓 review、是否生成样稿、是否跑 Open Design。

## 按钮动作规范

按钮文案必须说清楚是否真的执行自动化：

- `运行这个动作`：可以调用后台 action，比如 cheap audit、promote、enrichment plan、outreach brief。
- `记录决定：...`：只写 lead note 或人工决定，不执行外部工具。
- `打开线索`：去 `/admin/leads` 看完整证据。
- `打开项目`：去 `/admin/intakes/<client>/<order>`。

高成本动作前必须有证据门槛：

- 不抓 review 正文作为默认流程。
- 不对整个抓取池跑 Tinyfish / Google Places。
- 不给证据不足或不可触达目标做 mockup。
- 只有 cheap audit 证明有明确机会，才考虑补资料和样稿。

## 下一批实现任务

按优先级排序（2026-05-10 复盘）：

1. **真实 mockup artifact 替换**（进行中）：把 `build_mockup_artifacts` 里的 placeholder preview / screenshot / video 换成真实 Open Design / template runner 输出。没有真实 artifact 不能进 `mockup_ready`。
2. **打通 send → follow-up → reply → paid_handoff 链**：
   - 新增 `send_outreach` action：`draft_ready → outreach_sent`，记录 provider、`externalMessageId`、`externalThreadUrl`、`nextFollowUpDue`
   - 接 follow-up 调度（cron 检查 `nextFollowUpDue`）：`outreach_sent → follow_up_due`
   - 核实 provider event 把 `outreach_sent → replied / bounced` 写回到 lead 的状态（不只是事件存档）
   - 新增 `record_reply_intent` action：`replied → paid_handoff`，把人工判断落到 lead-notes，并触发 paid intake 链路
3. **手工 intake 汇入 cheap audit 流程**：让 `scripts/leads/intake.js` 也写一份 discovery entity，触发一次 `run_cheap_audit`，让每个 lead 都有 audit 证据。区分留到事后核实。
4. **selected enrichment 接到真实执行**：当前已支持 dry-run 计划和 `approved` 状态记录；下一步是 `executed / ingested` 自动回写证据。
5. **`/admin/leads` 阶段说明对齐 Queue**：保留更完整证据，但阶段说明 / 关键事实区与 Queue 同源。
6. **扩展阶段迁移测试**：覆盖 `draft_ready → outreach_sent → follow_up_due / replied` 全链路。
