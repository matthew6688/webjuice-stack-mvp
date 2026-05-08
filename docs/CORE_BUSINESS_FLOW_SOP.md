# ProfitsLocal 核心业务流程 SOP

更新日期：2026-05-08

这份文档是 ProfitsLocal 做网站业务的日常操作手册。它要回答四个问题：

- 现在项目在哪个阶段？
- 这一步要做什么？
- 需要什么输入，产出什么文件或结果？
- 怎么验证，去哪里看证据？

目标是让 Matthew、Discord/Hermes agent、Codex、Open Design、其他 IDE 都能围绕同一个项目继续工作，不靠聊天记忆，也不把项目做乱。

当前待办、缺口、文档审计、admin 面板后续项，统一记录在：

- `docs/P0_P1_TODO.md`

lead profile 的字段设计、分阶段推进、以及后续 lead truth source 的目标，统一记录在：

- `docs/LEAD_PROFILE_SCHEMA.md`

## 一句话流程

```text
找到或收到一个 business lead
  -> 收集真实资料
  -> 判断是否 ready to build
  -> 创建 Open Design project
  -> 做 dev preview
  -> QA 检查
  -> 准备 outreach/demo 材料
  -> 客户付款
  -> Discord/agent 继续修改
  -> 发客户 review email
  -> 客户 revision 或 approval
  -> 发布 live
  -> 设置域名
  -> 记录收入、成本、项目历史
```

## 硬规则

- 每一个 website project 都必须有一个 Open Design project。
- 每一个 website project 都必须有一个 Discord website workspace。当前优先形态是 `website-projects` forum 里的单个 post，不再优先依赖普通 text-channel thread。
- 每一个 website project 都必须有 repo-backed memory，不能只靠聊天记忆。
- 一个项目只能有一个当前 project capsule、一个当前 Open Design binding、一个当前 customer repo `dev` branch。如果三者对不上，先停下来同步。
- 客户网站 repo 只放客户网站和 preview banner。ProfitsLocal 的 checkout、revision、approval、domain 页面必须在 `https://profitslocal.com`。
- 真实 business 信息以 evidence、survey、content 文件为准。Open Design 可以优化视觉表达，但不能发明核心 business facts。
- 所有给客户的 email 链接必须指向 `https://profitslocal.com` 官方 funnel 页面。
- 客户修改一律先做在 customer repo 的 `dev` branch。
- 只有客户 approval 之后，才能把 `dev` 发布到 `main/live`。

## 项目同步协议

这是防止 Discord、Open Design、customer repo 三个地方互相打架的规则。

### 不同内容的真相源

| 内容 | 真相源 | 说明 |
|---|---|---|
| Business facts | `evidence`、`survey`、`content` | 名字、电话、地址、菜单、服务、booking、contact、sitemap。 |
| 视觉概念 | Open Design project | 视觉方向、layout、字体、层级、艺术方向、设计探索。 |
| 可部署网站 | customer repo `dev` branch | 真正能部署到 Cloudflare Pages 的 Astro/Webjuice 实现。 |
| 内部沟通和决策 | Discord website workspace + case timeline | 任务讨论、客户反馈、agent 运行记录、approval/revision 记录。当前推荐是 forum post。 |
| 客户付款和售后页面 | `profitslocal.com` | Checkout、revision、approval、domain setup、contact、FAQ。 |

### 每次开工前先做 6 个检查

1. 找到 client slug。
2. 找到 case folder。
3. 打开同一个 Discord website workspace（优先是 `website-projects` forum post）。
4. 检查 `clients/<client>/concept/open-design/concept-manifest.json`。
5. 检查 customer repo 和当前 branch。
6. 判断这次改动属于哪一类：视觉设计、生产实现、business fact 修正。

如果 case、Discord workspace、Open Design manifest、repo 指向不同客户或不同项目，不要继续做。先修 binding。

### Discord workspace 结构

当前建议结构：

- `website-leads` forum：售前 lead / outreach / qualified / paid intake
- `website-projects` forum：已进入 build / review / revision / live 的正式项目

这两个 forum 已验证可用：

- `website-leads`: `1501187038706401290`
- `website-projects`: `1501945763650080899`

### Admin 页面（当前）

现在 admin 里已经有这几页：

- `/admin`
- `/admin/leads`
- `/admin/intakes`
- `/admin/finance`
- `/admin/queue`
- `/admin/settings`

当前 admin 的界面原则也已经固定：

- 不再跟官网保持同一种 marketing 风格；
- 用更适合长时间盯盘的浅色、低刺激、暖纸工作台风格；
- 视觉语言更接近纸面和文档，不走大面积 card / KPI 面板；
- 先列表、再动作、最后统计；尽量用分隔线、表格、清单，而不是一排排卡片；
- 默认中文界面；
- `/admin/leads` 只看售前线索；
- `/admin/intakes` 只看已成交后的正式项目；
- 财务只留在 `/admin/finance`；
- `/admin`、`/admin/leads`、`/admin/intakes`、`/admin/queue`、项目详情页都不再混入 ROI、利润、收入、成本这类财务信息；
- 这样线索和项目不会混在同一张后台表里。
- 以上 admin 风格与中英文统一，已经做过 production 页面命中验证。
- 2026-05-08 这一轮又继续去卡片化：`/admin/leads`、`/admin/intakes`、`/admin/queue` 往更轻的纸面工作台收了一轮；本地 Chrome 已逐页复看，确认方向更接近 Kami 一类的文档式后台。

其中：

- `/admin/leads`
  - 当前负责说真话的售前状态：
    - `demo ready`
    - `draft ready`
    - `outreach sent`
    - `follow-up due`
    - `replied`
    - `bounced`
    - `paid`
    - `missing assets`
    - `missing outreach draft`
  - 当前数据源：
    - `core/funnel/lead-registry.js` 聚合的 Phase 1 lead truth source
    - 真相源底层目前读取：
      - `clients/<client>/outreach/outreach-pack.json`
    - `clients/<client>/outreach/email/*.json`
    - `clients/<client>/outreach/lead-notes.jsonl`
    - `clients/<client>/intake/website-survey.json`
    - `clients/<client>/evidence/evidence.json`
    - `clients/<client>/content.restaurant.json` 里的 `contact.email/phone/website`
    - `data/cases/*/*/case.json`
    - `data/paid-intakes/*/*.json`
  - Phase 1 已落地字段：
    - `leadId`
    - `clientSlug`
    - `businessName`
    - `address`
    - `phone`
    - `email`
    - `websiteUrl`
    - `contactPageUrl`
    - `googleMapsUrl`
    - `googlePlaceId`
    - `menuUrl`
    - `qualificationStatus`
    - `outreachStatus`
    - `replyStatus`
    - `followUpDue`
    - `notes`
    - `provider`
    - `externalThreadUrl`
  - 其中 `outreach sent` 的当前真相源：
    - `clients/<client>/outreach/email/*.json` 里的标准化 provider metadata
    - 当前已经可以从 artifact 推导：
      - `sendResult.status === "sent"`
      - `providerEvent -> replied / bounced`
      - `provider / sourceSystem / externalCampaignId / externalLeadId / externalMessageId / externalThreadUrl`
  - 当前**还没有完全接好的状态**：
    - external provider live webhook ingest（Instantly / Smartlead）
    - `opened / clicked / unsubscribed / spam complaint`
  - 当前已支持的人工售前记忆：
    - `/admin/leads` 可提交 lead note
    - 可选填写 `next follow-up due`
    - note 会写回：
      - `clients/<client>/outreach/lead-notes.jsonl`
      - 如果已有 case，则写入 case timeline
      - 如果已有 `website-leads` forum workspace，则发一条同步消息
  - 自动状态切换说明：
    - `follow-up due` 在收到 `replied / bounced / paid` 之后会自动让位给更高优先级状态
    - 如果人工在外部邮箱完成跟进，但没有 provider event 回流，admin 不会自动知道，仍需手动补 note 或 event
    - Agentic Inbox 现在的自动回流目标是：
      - 收到 inbound reply -> `replied`
      - operator/new outbound send -> `sent` + `nextFollowUpDue`
      - provider 事件通过 unique lead email 自动匹配 `clientSlug`
    - sale / paid handoff 现在也支持：
      - checkout 缺少 `client_slug` 时
      - 只要 checkout email 能唯一命中现有 lead
      - 系统就会把 sale 重新挂回同一个 `clientSlug`，并继续创建 `website-leads` / `website-projects` workspace
      - 最新 smoke 证据：
        - `data/qa/lead-closure-smoke/lead-to-paid-handoff.json`
      - 最新 production 演练：
        - workflow: `25535613785`
        - lead: `fresh-paid-prod-smoke`
        - 结果：
          - `[Qualified] Fresh Paid Prod Smoke`
          - `[Review] Fresh Paid Prod Smoke`
          - case / task / funnel order 已写回 main
        - 证据：
          - `data/qa/fresh-paid-prod-smoke/summary.json`
  - 后续方向：
    - 现在 `/admin/leads` 已经切到 Phase 1 lead truth source
    - 后面继续补：
      - social/contact person 字段
      - reply matching / paid handoff 更强约束
    - 具体 schema 和 Phase 1/2/3 见：
      - `docs/LEAD_PROFILE_SCHEMA.md`

- `/admin`
  - 现在除了项目和财务概览，也已经显示售前 lead 脉搏：
    - `Lead follow-up`
    - `Lead pulse`
    - `Inbox & follow-up`
  - 目的：
    - 不点进 `/admin/leads` 也能先看到：
      - `follow-up overdue`
      - `replied needs review`
      - `paid handoff pending`
      - `blocked leads`
    - 把售前、交付、Open Design 三条线放到一个总览面板里
  - 当前真实验证方式：
    - `npm run build`
    - 生产 deploy 成功后，直接命中 `/admin/`
    - 至少确认出现：
      - `Lead follow-up`
      - `Lead pulse`
      - `Inbox & follow-up`

- `/admin/intakes`
  - 当前已经能显示：
    - `Project stage`
    - 当前 milestone 文案
    - milestone 完成进度
    - Open Design `status / runId / completion mode`
    - Open Design / QA / outreach / domain health
  - 详情页已经能显示：
    - milestone timeline
    - 当前 milestone
    - workflow/job status
  - `/admin/queue`
    - 已增加 milestone 聚合统计

- `/admin/settings`
  - 当前负责说真话的系统层配置：
    - Core ops
    - Open Design
    - Transactional email
    - Cold outreach providers
    - Checkout & billing
    - Media & uploads
    - Research & scrape
    - Domain & deploy
    - Local AI audit
  - 页面原则：
    - secret 只显示脱敏值
    - 只显示“是否已配置、属于哪类依赖、会影响哪段业务”
    - 不把项目级内容和系统级配置混在一起
  - 当前 cold outreach 策略：
    - `Agentic Inbox = current live operator path`
    - `Instantly / Smartlead = planned`
    - `Resend = transactional only`
  - lead 匹配原则：
    - 对外发件身份保持统一专业
    - 不把 `clientSlug` 或内部 routing key 暴露给客户
    - reply / follow-up / paid handoff 后面要优先依赖：
      - `leadId`
      - `clientSlug`
      - `lead email`
      - provider external ids / thread url
    - 详细说明见：
      - `docs/LEAD_PROFILE_SCHEMA.md`
  - 当前 inbound 事件入口：
    - `/api/outreach-provider-event`
    - 鉴权：`OUTREACH_PROVIDER_WEBHOOK_SECRET`，没有单独配置时临时回落到 `ADMIN_ACCESS_TOKEN`
    - workflow：`sync-outreach-provider-event.yml`
    - 回写目标：
      - `clients/<client>/outreach/email/*.json`
      - `data/cases/*/*/timeline.jsonl`（如存在 case）
      - `website-leads` forum（如存在 workspace）
  - Agentic Inbox 运行配置：
    - worker: `agentic-inbox-profitslocal`
    - `PROFITSLOCAL_OUTREACH_WEBHOOK_URL=https://profitslocal.com/api/outreach-provider-event`
    - `PROFITSLOCAL_OUTREACH_FOLLOW_UP_DAYS=3`
    - `PROFITSLOCAL_AGENTIC_INBOX_URL=https://mail.profitslocal.com`
    - `PROFITSLOCAL_OUTREACH_WEBHOOK_SECRET` 作为独立 worker secret
  - 当前 deploy 证据：
    - version: `d40fd7ca-5a8d-4a04-b050-7271ce0ae8ed`
    - 记录文件：`data/qa/agentic-inbox-webhook-deploy-summary.json`
  - 当前 production routing 证据：
    - endpoint: `/api/outreach-provider-event`
    - workflow run: `25533771745`
    - unique lead match: `info@babylonbrisbane.com.au -> babylon-brisbane-restaurant`
    - 记录文件：`data/qa/agentic-inbox-production-routing-summary.json`
  - 当前 live UI 回流证据：
    - mailbox: `hi@profitslocal.com`
    - 第 1 次真实 UI reply：
      - workflow: `25534758411`
      - 结果：`not_found`
      - 原因：目标邮箱当时还没进入 lead registry
    - 第 2 次真实 UI reply：
      - workflow: `25535070123`
      - 结果：`unique_match`
      - matched client: `agentic-inbox-ui-smoke`
      - artifact:
        - `clients/agentic-inbox-ui-smoke/outreach/email/01-agentic-inbox-ui-smoke.json`
      - 已写回：
        - `providerEvent`
        - `externalLeadId`
        - `externalMessageId`
        - `externalThreadUrl`
        - `nextFollowUpDue`
    - 记录文件：
      - `data/qa/agentic-inbox-live-ui-smoke/summary.json`

当前 milestone 真相源：

- `data/paid-intakes/*/*.json`
- `data/cases/*/*/case.json`
- `data/cases/*/*/timeline.jsonl`
- `clients/<client>/concept/open-design/concept-manifest.json`
- `clients/<client>/concept/open-design/production-handoff.json`
- `data/cases/*/*/delivery-qa.json`
- `data/domain/requests/*/*.json`

当前 milestone 仍是 **repo/case/artifact 推导值**，还没有和 Open Design app 的 pipeline 原生状态完全统一。

补充：

- 现在 `/admin` 已能显示：
  - `OD running`
  - `OD needs input`
- 现在 `/admin/intakes` 已能显示：
  - `OD Not started`
  - `OD run <runId> · <status> · <completion mode>`
- 现在项目 detail 已能显示：
  - `Open Design pipeline`
  - `Open Design status`
  - `Completion mode`

也就是说，admin 已经能把 Open Design pipeline 的关键状态直接说出来，不再只靠 case 旁敲侧击。

### Cold outreach provider 边界

- `Resend`
  - 继续只负责 transactional email
  - cold outreach 目前也可做 live smoke，但不是长期主发送系统
- cold outreach provider
  - 后面可接 `Instantly`、`Smartlead`、`Gmail sender`、`agentic email`
  - 我们内部已经开始按 provider-agnostic 字段归一，详见：
    - `docs/COLD_OUTREACH_PROVIDER_INTEGRATION.md`

为什么这样做：

- 普通 text channel thread 在大量项目下不直观，容易被藏起来。
- forum post 可以直接看到项目列表。
- forum tag 可以做阶段过滤。
- title 可以按阶段更新，例如：
  - `[Qualified] Dark Shepherd`
  - `[Review] Opa Bar & Mezze`
  - `[Revision 1/3] Rich & Rare`
  - `[Live] Babylon Brisbane`

当前已实测的 forum tags：

- `website-leads`:
  - `restaurant`
  - `roofing`
  - `qualified`
  - `demo-ready`
  - `cold-outreach`
  - `replied`
  - `paid`
  - `not-fit`
- `website-projects`:
  - `restaurant`
  - `roofing`
  - `open-design`
  - `dev-preview`
  - `review`
  - `revision`
  - `approved`
  - `live`
  - `domain-blocked`
  - `waiting-customer`
  - `waiting-us`

推荐命令：

```bash
npm run discord:sync-forums -- --leads 1501187038706401290 --projects 1501945763650080899
npm run discord:test-forum-workspace -- --leads 1501187038706401290 --projects 1501945763650080899
npm run discord:test-lead-forum-routing
npm run discord:test-project-workspace-stages
npm run discord:update-forum-workspace -- --help
```

证据位置：

- `data/qa/discord-forum-smoke/sync-forums.json`
- `data/qa/discord-forum-smoke/forum-workspace-smoke.json`
- `data/qa/discord-forum-smoke/forum-channels.json`
- `data/qa/discord-forum-smoke/website-handoff-forum.json`
- `data/qa/discord-forum-smoke/lead-forum-routing.json`
- `data/qa/discord-forum-smoke/project-workspace-stages.json`
- `data/qa/discord-forum-smoke/remote-route-run.json`
- `data/qa/discord-forum-smoke/remote-domain-run.json`
- `data/qa/discord-forum-smoke/remote-forum-workflow-summary.json`

### Forum 自动流转规则

当前已经接上的自动规则：

#### `website-leads`

- `paid_intake`：自动创建或复用一个 lead forum post，标题会类似：
  - `[Paid] Business Name`
- `sale`：自动创建或复用 lead forum post，标题会类似：
  - `[Qualified] Business Name`
- 这一步会把 forum post 信息回写到 `case.json.discord`：
  - `salesThreadId`
  - `salesWorkspaceChannelId`
  - `salesWorkspaceType`
  - `salesWorkspaceName`
  - `salesWorkspaceTagIds`

#### `website-projects`

- `ready_for_customer_review` handoff：自动创建或复用项目 forum post，标题类似：
  - `[Review] Business Name`
- `agent:complete-task` 完成后：会继续复用同一个项目 post，并保持 `review` 或 `revision` 阶段 tag。
- `agent:publish-approved`：
  - 先把项目 post 改到 `[Approved]`
  - 发 live published 消息
  - 再改到 `[Live]`
- `domain:request --execute true --send-discord true`：
  - 如果客户还没完成 DNS，会在同一个项目 post 里发 domain status update
  - 并补上 `domain-blocked` / `waiting-customer` 语义

### 远端 workflow 实测结果

2026-05-08 这轮已经不是只跑本地脚本，而是实测了 GitHub Actions：

#### `route-funnel-event.yml`

- run: `25502553992`
- URL:
  - `https://github.com/matthew6688/webjuice-stack-mvp/actions/runs/25502553992`
- 真实结果：
  - 创建了 `website-leads` forum post；
  - 创建了 `website-projects` forum post；
  - `case.json.discord` 记录了：
    - `salesThreadId`
    - `websiteTaskThreadId`
    - leads/projects workspace 名称和 tag IDs。

#### `domain-request.yml`

- run: `25502637533`
- URL:
  - `https://github.com/matthew6688/webjuice-stack-mvp/actions/runs/25502637533`
- 真实结果：
  - customer subdomain 请求写入 `data/domain/requests/...json`；
  - 同一个项目 forum post 被更新到：
    - 标题：`[Live] Forum Remote Smoke 1778164589`
    - tags 包含 `live + domain-blocked`
  - 同一个 post 里有 domain status message。

注意：

- 当时 workflow 有一个缺口：`domain-request.yml` 只提交了 `data/domain/*`，没有把被写过的 `data/cases/*` 一起提交。
- 这次已经补上：
  - `git add data/cases || true`
- 修复后的二次验证：
  - run: `25503866820`
  - domain: `host.forum-remote-smoke-1778164589.example.com`
  - 结果：repo 里的 `timeline.jsonl` 现在真实写入了 `domain_status_discord_sent`
  - 证据：
    - `data/qa/discord-forum-smoke/remote-domain-run-fixed.json`
    - `data/qa/discord-forum-smoke/remote-forum-workflow-summary.json`

### 手动校正规则

如果某个项目需要人工修正 forum 标题或 tag，不要直接在 Discord 里手改。优先使用：

```bash
npm run discord:update-forum-workspace -- \
  --workspace projects \
  --thread <threadId> \
  --kind live \
  --client opa-bar-mezze-restaurant \
  --company "Opa Bar & Mezze" \
  --status waiting_for_customer_dns
```

这样做的好处：

- 标题和 tag 一起更新；
- 更新逻辑和自动流程一致；
- 不会把 case memory 和 Discord workspace 状态改乱。

### 如果修改从 Discord 开始

适用场景：Matthew 在项目 thread 里说“帮我改首页 hero”“让 menu 更高级”“客户要求改电话”等。

操作步骤：

1. Agent 先读 task packet 和 case memory。
2. Agent 确认现有 Open Design project ID。
3. 如果是视觉改动，用同一个 Open Design project 做 continuation，不要新建 project。
4. 运行 continuation：

```bash
npm run open-design:continue-concept -- \
  --client <client> \
  --prompt "具体修改要求"
```

5. 检查 `clients/<client>/concept/open-design/run-status.json`：
   - 如果 `status=succeeded` 且 `completionMode` 为空或不是 fallback，说明这次是 native clean finish；
   - 如果 `status=succeeded` 且 `completionMode=artifact_quiet_fallback`，说明真实概念文件已经写出来，但 run 没有自然优雅结束，这一轮仍可继续；
   - 如果没有 visible html 或者命令 timeout/fail，这一轮不能继续 port，必须先处理 run 失败。
6. 把 Open Design 更新导出到 `clients/<client>/concept/open-design/`。
7. 重新生成 `production-handoff.json` 和 `production-handoff.md`：

```bash
npm run open-design:build-production-handoff -- \
  --client <client> \
  --target-repo /绝对路径/客户repo
```

## Open Design 升级后的三条核心验证

2026-05-08 这轮已经把升级后的 Open Design 按最关键的三条链重新验证了一遍。

### 1. 真实项目链：Open Design -> handoff -> repo -> build/QA

验证项目：

- `dark-shepherd-restaurant`

真实结果：

- 使用升级后的 Open Design fork 做 continuation；
- 同一个 project 继续生成概念；
- 重新生成 `production-handoff`；
- 再 port 到 customer repo；
- customer repo `build` 通过；
- funnel QA 通过。

证据：

- `data/qa/open-design/dark-shepherd-upgrade-chain-summary.json`
- `data/qa/open-design/dark-shepherd-upgrade-chain-qa.json`
- `data/qa/open-design/dark-shepherd-upgrade-delivery-qa.json`

注意：

- 这轮链路是通的；
- 但“某条很细的字面指令是否 100% 被模型执行”仍应单独看，不要和链路连通性混为一谈。

### 2. 双向切换：Open Design app/source 改 + Discord continuation 改

验证项目：

- `dark-shepherd-restaurant`

验证方式：

1. 在 Open Design project 目录里直接加入 `sync-proof-app.md`；
2. 运行 `open-design:sync-from-app`；
3. 重新 handoff / port / build；
4. 再用 Discord/continuation 风格 prompt 让同一个 project 生成 `sync-proof-discord-2.md`；
5. 再次 handoff / port / build。

验证结论：

- `projectId` 保持不变；
- app/source 侧修改能同步回 concept export；
- Discord continuation 侧修改也能同步回 concept export；
- 两次修改后 customer repo 仍可继续 build。

证据：

- `data/qa/open-design/dark-shepherd-app-sync-summary.json`
- `data/qa/open-design/dark-shepherd-switch-cycle-summary.json`
- `data/qa/open-design/dark-shepherd-discord-sync-qa.json`

### 3. 固定真实餐厅 redesign smoke

当前固定样本：

- `Rich & Rare`

为什么要固定一个长期样本：

- 不只是验证“Open Design 会生成一个 html”；
- 而是验证真实 redesign 能保留 source pages、品牌、菜单、功能页和 canonical concept entry。

这轮最终稳定通过的策略：

1. 先准备本地 source seed；
2. 把官方页面种到 Open Design project 的 `source/`；
3. prompt 里明确要求优先使用本地 source seed；
4. 只有同时产出 `index.html + brand-spec.md + source/* + assets`，才算通过。

通过样本：

- client: `rich-and-rare-longterm-smoke-v4`
- project: `rich-and-rare-longterm-smoke-v4-open-design-1778193842482`
- run: `faad21c0-1f3a-465b-a90a-1d789d01df7d`

验证结果：

- `status: succeeded`
- `completionMode: artifact_quiet_fallback`
- `index.html` 存在
- `brand-spec.md` 存在
- `sourcePages: 5`
- `imageAssets: 3`
- `validate-concept` 全绿

证据：

- `data/qa/open-design/rich-and-rare-longterm-smoke-v4-summary.json`

推荐命令：

```bash
npm run open-design:restaurant-redesign-smoke -- --client rich-and-rare-longterm-smoke-v4 --execute true
```

这条 smoke 的业务意义：

- 它验证的是更接近真实 ProfitsLocal 生产线的链：
  - `survey/evidence`
  - `Open Design redesign`
  - `canonical concept output`

而不是单纯的 “headless 生成了一个示例页面”。

8. 把认可的设计 port 到 customer repo `dev` branch：

```bash
npm run open-design:port-production-handoff -- \
  --client <client> \
  --target-repo /绝对路径/客户repo \
  --execute true
```

9. 在 customer repo 跑 build 和 QA。
10. 回到同一个 Discord thread 汇报：
   - 改了什么；
   - Open Design project/run ID；
   - repo branch 和 commit/diff 摘要；
   - preview URL；
   - QA result path；
   - 是否可以发 customer email。

验证标准：

- Discord thread ID 没变。
- Open Design project ID 没变。
- customer repo 在 `dev` branch。
- `production-handoff` 时间晚于这次 Discord 请求。
- repo 改完之后有新的 QA result。

### 如果修改从 Open Design 桌面 App 开始

适用场景：Matthew 在 Open Design app 里手动改了视觉设计。

操作步骤：

1. 确认 Open Design app 里的 project 名字对应当前 business。
2. 在 Open Design app 里完成修改。
3. 先在 project 文件夹里确认 `.profitslocal-sync.json` 还指向同一个 client。
4. 运行：

```bash
npm run open-design:sync-from-app -- --client <client>
```

5. 检查 `concept-manifest.json` 是否仍然是同一个 `projectId`。
6. 重新生成 production handoff：

```bash
npm run open-design:build-production-handoff -- \
  --client <client> \
  --target-repo /绝对路径/客户repo
```

7. 在同一个 Discord thread 里让 `website-agent` 把 handoff port 到 customer repo `dev`，或者本地自己执行：

```bash
npm run open-design:port-production-handoff -- \
  --client <client> \
  --target-repo /绝对路径/客户repo \
  --execute true
```

8. 跑 build 和 QA。
9. 把 preview 和 QA result 发回同一个 Discord thread。

验证补充：

- Open Design app 首页 `Recent` 现在应当在几秒内自动出现外部 daemon/API 新建的 project；切回窗口或重新聚焦也会刷新。
- 如果 app 里看到的是另一个 project，不要继续改。先核对 `projectId` 和 `.profitslocal-sync.json`。

验证标准：

- Open Design project 里的 `.profitslocal-sync.json` 指向同一个 client slug。
- `concept-manifest.json` 里的 project ID 是 Matthew 刚刚编辑的那个。
- `production-handoff.json` 比手动修改时间更新。
- customer repo `dev` 包含 port 后的实现。
- preview URL 显示的是新设计，不只是 concept folder 里变了。

### 如果修改直接从 repo 开始

只适合小修，例如 typo、链接、build bug、banner bug、SEO、sitemap、redirect。

操作步骤：

1. 确认不改变主要视觉方向。
2. 改 customer repo `dev` branch。
3. 跑 build 和 QA。
4. 把改动回写到 Discord thread。
5. 如果这次小修影响设计结构，也要更新 Open Design notes 或 production handoff，避免视觉记忆过期。

### 冲突处理

如果两个地方同时改了项目，按这个顺序判断：

1. Business facts 以 evidence/survey/content 为准。
2. 已经客户确认的 case timeline decision 优先。
3. 最新被接受的 Open Design production handoff 决定视觉方向。
4. customer repo `dev` 决定当前 preview 实际显示什么。

不确定时，先在 Discord 写清楚：

```text
发现同步冲突：
- Open Design 当前是：...
- repo dev 当前是：...
- case/customer decision 当前是：...
- 建议保留：...
```

冲突解决前，不要给客户发 review email。

### Open Design / Discord 灵活切换规则

这是已经实测过的一条硬规则：

1. Open Design/source 侧修改：
   - 修改发生在 `.od/projects/<projectId>/...`
   - 用 `npm run open-design:sync-from-app -- --client <client>` 同步回 `clients/<client>/concept/open-design/`
   - `projectId` 不变

2. Discord/agent 侧修改：
   - 必须用 `npm run open-design:continue-concept -- --client <client> --prompt \"...\"`
   - continuation 必须复用同一个 `projectId`
   - `lastRunId` 会更新，但 `projectId` 不变
   - 如果 run 正常结束最好；如果 run 挂住但真实概念文件已经写入 project 目录，则允许 `artifact_quiet_fallback`

3. 两边切换后：
   - 重新生成 `production-handoff`
   - 再 `port-production-handoff`
   - customer repo `dev` 仍应可以正常 build

只要这 3 条都满足，就说明“切换入口但项目记忆不丢失”。

### Open Design headless run 故障分型

这是 2026-05-08 之后必须遵守的判断规则，不要把不同问题混成一个。

#### 先说一个已经确认并修复的根因

ProfitsLocal 旧版 fallback 检测曾经把 `source-*.html` 这种**源站抓取页面**也算进“概念页已经生成”。

这会造成一种假成功：

1. run 先把官网抓成 `source-*.html`
2. 再下载几张图片
3. 目录安静一段时间
4. 我们自己的 runner 就提前 cancel run
5. 最终被误记成 `completionMode=artifact_quiet_fallback`

但实际上 Open Design 可能还没有写出 `index.html`、`menu.html` 之类真正的概念页。

现在这条已经修掉了：

- `source-*.html` **不再算** fallback readiness；
- 必须至少出现一个**非 source 的 html 概念页**，quiet fallback 才允许成功。

#### 类型 A：真实 artifact 已经存在，但没有自然结束

特征：

- `run-events.sse` 没有 `event: end`
- `run-status.json` 是 `status=succeeded`
- `completionMode=artifact_quiet_fallback`
- project/workspace 里已经有 visible html，例如：
  - `index.html`
  - `menu.html`
  - `functions.html`
  - `contact.html`

处理：

- 这是可以接受的工作状态；
- 不要新建第二个 Open Design project；
- 直接继续：
  - `sync-from-app`（如果是 app 手动改）
  - 或者用现有导出的 concept 文件
  - `build-production-handoff`
  - `port-production-handoff`
  - repo build / QA

#### 类型 B：连第一个“生成的概念 html”都没有

特征：

- project 目录里可能只有图片或中间文件；
- `scanArtifactQuietSnapshot` 仍然属于 `required_artifacts_missing` 或 `generated_artifacts_missing`；
- 命令最终 timeout 或 fail；
- 这不是 fallback success。

处理：

- 这次 run 直接算失败；
- 不要继续 build handoff；
- 不要继续 port 到 repo；
- 保留同一个 project，但重新发更清楚的 continuation prompt，或者人工在 Open Design app 里接着做，再 `sync-from-app`。

#### 当前已验证结论

- `artifact_quiet_fallback` 不是“Open Design 没工作”，而是“真实文件已经写出来了，但我们没有等到原生 `event:end` 之前就从磁盘把结果回收了”；
- 2026-05-08 已确认：旧版 runner 会把 `source-*.html` 误判成生成好的概念页，造成 false-positive fallback；这一条已经修复；
- 2026-05-08 又确认：很多我们之前拿来当“失败证据”的样本，其实用了 `120000ms` / `180000ms` 的过短 timeout。对于 `codex + web-prototype`，这会在 run 还没走到最终 artifact / `event:end` 时就把它误杀；
- 同一天的 `od-rootcause-appvisible-nofallback` 证明了：把 timeout 拉到 `600000ms`、并且不依赖 fallback，**同样的 Open Design app-visible 流程可以自然走到 `event:end`**；
- 2026-05-08 还确认：Open Design app 的 Pipeline / Kanban 不是直接看 project 文件夹，而是看 `messages.run_id / run_status` 再推导状态。ProfitsLocal 以前直接打 `/api/runs`，却没有写 message 记录，所以成功 run 在 app 里会继续显示成 `Not started`。这一条现在也已经补上；
- 2026-05-08 还确认：我们的 Open Design 本地 checkout 现在必须采用 `origin=个人 fork`、`upstream=官方仓库` 的双 remote 结构。这样业务关键 patch 可以先进 fork，官方更新再通过 smoke 合并进来，不会把活跃设计流水线直接暴露在未验证的上游变更之下；
- 2026-05-08 还补了两条操作命令：`npm run open-design:upgrade-smoke` 默认检查 `upstream/main`，`npm run open-design:rollback -- --commit <sha> --execute true` 用于一键回滚到已验证版本；
- `stream disconnected - retrying sampling request` 这条 warning 是真实的 Codex stderr，但它不是这次业务级大问题的主因，因为 clean-finish 的成功样本并不需要出现它；
- 所以当前最稳的 SOP 是：
  - 同一个 `projectId`
  - 不要用低于 `600000ms` 的短 timeout 去判断 `codex + web-prototype` 是否失败
  - 有真实 visible html 时可以接受 fallback
  - 需要验证 native clean finish 时，用长 timeout 并禁用 fallback 路径
  - 从 ProfitsLocal 触发 `run-concept` / `continue-concept` 时，必须同时写 Open Design assistant message 和 `run_status`，否则 app 状态会失真
  - handoff 重建
  - port 到 repo
  - build/QA 验证

## 阶段总览

| 阶段 | 名称 | 这一阶段证明什么 |
|---|---|---|
| 0 | Lead / Customer Intake | 我们知道这个 business 是谁，为什么值得做。 |
| 1 | Evidence Collection | 我们有真实信息、链接、照片、菜单/服务和联系路径。 |
| 2 | Website Ready Packet | 信息已经整理好，可以开始建站，不需要乱猜。 |
| 3 | Open Design Project | 每个网站都有自己的视觉设计工作区。 |
| 4 | Production Dev Build | 设计和真实内容已经进入 customer repo `dev`。 |
| 5 | Dev Preview QA | preview 足够真实、好看、移动端可用，可以给客户看。 |
| 6 | Outreach / Demo Proof | 有截图、视频、邮件素材，可以主动联系客户。 |
| 7 | Checkout / Payment | 客户能付款，订单能映射到正确项目。 |
| 8 | Agent Task / Discord Work | Agent 能基于同一个 task packet 继续工作。 |
| 9 | Customer Review Email | 客户收到品牌化 email 和正确链接。 |
| 10 | Revision Loop | 修改请求能按 order ID + email 匹配，并控制次数。 |
| 11 | Approval / Publish Live | 客户确认后，`dev` 安全发布到 live。 |
| 12 | Domain Setup | 我们的免费子域名或客户域名可以接上。 |
| 13 | Finance / ROI Log | 收入、成本和使用量有记录。 |

## Stage 0: Lead / Customer Intake

目标：判断这个 business 值不值得继续收集和建 preview。

输入：

- Google Places 结果、手动 lead、客户表单、官方 website URL。
- Business name。
- 城市或区域。
- Niche，目前先聚焦 restaurant。
- Existing website，如果有的话。
- 联系路径：电话、email、contact form、booking page、social。

输出：

- Lead record。
- Client slug。
- Qualification score 或 decision。
- 下一步：继续收集、做 preview、或者 skip。

验证：

- Business name 不为空。
- 至少有一个联系路径。
- Business 看起来真实可联系。
- 如果已有网站，我们能合理判断是否有 redesign 机会。

查看位置：

- `clients/<client>/`
- `docs/LEAD_QUALIFICATION_ENGINE.md`
- Discord thread，如果是人工讨论的 lead。

## Stage 1: Evidence Collection

目标：设计和文案之前，先收集真实、可追溯的信息。

输入：

- Google Places API。
- Google Maps photos。
- 官方网站页面。
- Menu/service 页面。
- PDF、图片、扫描菜单、产品或服务文件。
- 客户上传文件。

输出：

- `clients/<client>/evidence/evidence.json`
- 原始 scrape/extraction 文件。
- 重要 facts 的 source URL。
- 缺失信息列表。

验证：

- Business name、address、phone、website、maps link 尽量都有。
- Restaurant 如果要做 menu，必须有 menu evidence。
- 图片优先用真实 business/venue/product 图片。
- 重要 facts 必须有 source URL 或 extraction note。
- 信息不完整时，写 missing，不要硬编。

查看位置：

- `clients/<client>/evidence/evidence.json`
- `clients/<client>/evidence/`
- `docs/COLLECT_SKILL_USAGE.md`
- `docs/COLLECT_GOOGLE_PLACES_SMOKE.md`

## Stage 2: Website Ready Packet

目标：把杂乱资料整理成任何 agent/tool 都能使用的 ready-to-build packet。

输入：

- Evidence file。
- Website intake survey。
- Content artifact。
- Design/brand artifact。
- 客户备注，如果是已付款客户。

输出：

- `clients/<client>/intake/website-survey.json`
- `clients/<client>/content.<niche>.json`
- `clients/<client>/design.<niche>.json`
- `clients/<client>/brand-spec.md`
- `data/cases/<client>/<order>/build-packet.md`

验证：

- 关键 facts 存在，或明确标记 missing。
- build packet 说明这是哪种网站：starter、redesign、menu、multi-page 等。
- 写清楚需要哪些 routes/pages。
- 写清楚什么不能改，例如 logo、电话、地址、菜单价格、booking link。
- 包含 CTA、contact、source-of-truth paths。

查看位置：

- `docs/WEBSITE_INTAKE_SURVEY.md`
- `docs/WEBSITE_READY_ENGINE.md`
- `data/cases/<client>/<order>/build-packet.md`

## Stage 3: Open Design Project

目标：为这个 website project 创建视觉设计工作区。

每个 website project 必须到达这一阶段。即使只是简单一页网站，也要有 Open Design binding，因为这是视觉记忆和后续可视化修改的基础。

输入：

- 官方 website URL 或 build-ready packet。
- Business type。
- Target audience。
- Visual tone。
- Brand context。
- Scope，例如 homepage only 或 3-4 key pages。
- Non-negotiables：logo、contact、booking/order links、sitemap、menu/services。

输出：

- `clients/<client>/concept/open-design/concept-manifest.json`
- `clients/<client>/concept/open-design/brand-spec.md`
- `clients/<client>/concept/open-design/production-handoff.json`
- Open Design project ID。
- Open Design data directory。
- `.profitslocal-sync.json`。

验证：

- Open Design project 存在。
- project 在预期 Open Design data directory 里可见。
- concept 是针对这个 business 的，不是通用模板。
- 没有 generic placeholder。
- port 到 Astro 前，必须有 production handoff。
- `concept-manifest.json` 和 `.profitslocal-sync.json` 指向同一个 client slug。
- Discord task packet 指向这个 Open Design project ID。
- 如果 headless Open Design run 卡住，不要新开第二个 project。保留同一个 project ID，在同一个 project 目录里补齐 concept 文件，再用 `open-design:sync-from-app` 同步回客户 capsule。

常用命令：

```bash
npm run open-design:run-concept -- --client <client> --mode app-visible --source-url <official-url>
npm run open-design:continue-concept -- --client <client> --prompt "..."
npm run open-design:sync-from-app -- --client <client>
npm run open-design:build-production-handoff -- --client <client> ...
```

查看位置：

- `clients/<client>/concept/open-design/`
- `docs/OPEN_DESIGN_PROJECT_SYNC.md`
- `docs/OPEN_DESIGN_INTEGRATION.md`
- Open Design desktop/source app project list。

## Stage 4: Production Dev Build

目标：把认可的 Open Design concept 和真实内容 port 到 customer Astro/Webjuice repo。

输入：

- Open Design production handoff。
- Content artifact。
- Design artifact。
- Evidence file。
- Customer repo。
- `dev` branch。

输出：

- customer repo `dev` 更新。
- 可工作的 routes。
- 指向官方 ProfitsLocal 页面 的 preview banner。
- build output。

验证：

- customer repo `npm run build` 通过。
- 预期 routes 存在。
- redesign 项目要保留旧 URL，或用 permanent redirect。
- customer repo 不能再有本地 ProfitsLocal checkout/revision/domain 页面。
- preview banner 链接必须指向 `https://profitslocal.com`，并携带 `client_slug`、`repo`、`preview_url`、UTM/source 参数。

查看位置：

- customer repo，例如 `/Users/matthew/Developer/webjuice-generated/<client>`
- GitHub repo `matthew6688/<client>`
- Cloudflare Pages dev project。

## Stage 5: Dev Preview QA

目标：确认 preview 足够好，可以发给客户。

输入：

- Dev preview URL。
- Build output。
- Evidence/content/design 文件。
- Open Design handoff。

输出：

- Delivery QA report。
- Desktop screenshot。
- Mobile screenshot。
- 问题列表，或 ready for customer review。

标准报告命令：

```bash
npm run qa:write-delivery-qa -- \
  --client <client-slug> \
  --order <order-or-dry-run-id> \
  --preview-url https://<client>-dev.pages.dev/ \
  --email <checkout-email> \
  --repo matthew6688/<client-repo>
```

验证：

- Dev preview HTTP 200。
- Desktop/mobile 截图正常。
- Business name、phone、address、map、booking/contact links 正确。
- 没有 placeholder copy。
- 没有遗漏关键 menu/service 信息。
- customer repo 没有本地 funnel routes。
- banner 链接指向官方 `profitslocal.com`。
- `delivery-qa.json` 里的 approve / revision / domain setup 链接必须指向官方 `https://profitslocal.com/...` 页面。
- pre-review gate 通过后，才能发 customer review email。

查看位置：

- `data/qa/<client>/`
- `data/cases/<client>/<order>/delivery-qa.json`
- `npm run qa:funnel-pages`
- `npm run qa:write-delivery-qa`
- `npm run agent:test-pre-review-gate`

## Stage 6: Outreach / Demo Proof

目标：准备主动销售材料，让客户快速看懂我们做了什么。

输入：

- Dev preview URL。
- Screenshots。
- Demo video。
- 针对 business 的改进点。
- 客户联系方式。

输出：

- Screenshot assets。
- Demo video。
- Outreach email draft。
- Evidence-backed talking points。
- `outreach-pack.json`
- `outreach-pack.md`

标准命令：

```bash
npm run outreach:build-pack -- --client <client-slug> --preview-url https://<client>-dev.pages.dev/
npm run outreach:validate-pack -- --client <client-slug> --require-assets true
npm run outreach:send-cold-email -- --client <client-slug> --to <owner-email> --dry true
```

验证：

- screenshot 是真实 preview，不是空页面。
- email 有 preview link 和明确 offer。
- 如果是 outbound，不要写得像客户主动委托。
- 联系路径有效。
- 有 desktop screenshot、mobile screenshot、demo video。
- `outreach-pack.md` 可以给人工销售直接阅读。
- 如果有 local AI audit，outreach pack 应该带上 audit verdict 和分数。
- cold outreach artifact 要同时包含 `text` 和品牌化 `html`。

查看位置：

- `clients/<client>/outreach/`
- cold email artifacts。
- Discord project thread。

## Stage 7: Checkout / Payment

目标：客户可以 claim preview，付款后订单能映射到正确项目。

输入：

- Preview banner link。
- 官方 `https://profitslocal.com/checkout`。
- Project context：client slug、repo、preview URL、tier、amount、UTM/source 参数。
- Stripe checkout。

输出：

- Stripe checkout session。
- Paid order event。
- Entitlement/revision quota。
- Revenue ledger event。
- Case memory update。

验证：

- Stripe test/live payment 成功。
- 成功后跳转到官方 ProfitsLocal thank-you。
- order 映射到正确的 `client_slug`、`repo`、`preview_url`。
- revenue 写入 finance ledger。
- 客户收到 Resend email。

查看位置：

- Stripe dashboard。
- `data/funnel/orders/<client>/<order>.json`
- `data/finance/ledger.jsonl`
- `data/cases/<client>/<order>/`
- Discord website task thread。

## Stage 8: Agent Task / Discord Work

目标：创建一个长期可复用的内部工作区，让 agent 能接着做。

输入：

- Paid order。
- Case memory。
- Build packet。
- Open Design project binding。
- Customer repo 和 `dev` branch。

输出：

- `data/agent-tasks/<client>/<task>.json`
- Discord `#website-tasks` thread。
- website-agent handoff message。
- Case timeline event。

验证：

- task packet 符合 `docs/AGENT_TASK_PACKET_CONTRACT.md`。
- Discord thread ID 保存到 case memory。
- task packet 包含 Open Design project ID 和相关命令。
- agent 修改前必须读 case/task。
- 后续 revisions 复用同一个 thread。
- 视觉改动必须记录来源：Discord continuation、Open Design app sync、还是 repo direct fix。
- 如果用了 Open Design，必须复用同一个 project ID，并重新生成 production handoff。
- 如果建议发客户 email，必须引用最新 dev preview 和最新 QA result。

标准命令：

```bash
npm run ops:send-dry-run-handoff -- \
  --client <client-slug> \
  --order <dryrun-id> \
  --send true
```

说明：

- 只有 `ops-checklist.status=ready_for_customer_review` 才允许正式 dispatch。
- 会优先复用现有 `websiteTaskThreadId`。
- 如果 thread 还不存在，会在 `#website-tasks` 下创建一个以 business name 为主的 thread。
- 发送后会写：
  - `website-handoff-dispatch.json`
  - case timeline event：`website_agent_handoff_sent`
  - case memory 中的 `discord.websiteTaskThreadId`

查看位置：

- `docs/AGENT_TASK_PACKET_CONTRACT.md`
- `data/agent-tasks/<client>/`
- Discord `#website-tasks`
- `data/cases/<client>/<order>/case.json`

## Stage 9: Customer Review Email

目标：给客户发品牌化 email，让客户 review、approve、revision、domain setup。

输入：

- QA 通过的 dev preview。
- Order ID。
- Checkout email。
- 官方 approve/revision/domain links。
- Resend API。

输出：

- Branded HTML email。
- Resend email ID。
- Case timeline update。
- Discord thread update。

验证：

- email 使用固定 intent，不靠 agent 自由发挥。
- 链接指向官方 `profitslocal.com`，不是 customer preview domain。
- email 包含 order ID 和 preview URL。
- Resend ID 被记录。
- 只有 `ops-checklist.status=ready_for_customer_review` 才允许正式发送。
- 如果 case 已经有 `latestAgentRun.audit`，还必须通过 pre-review gate。

标准命令：

```bash
npm run ops:send-review-email -- \
  --client <client-slug> \
  --order <dryrun-id-or-order-id> \
  --send true
```

说明：

- 这个命令会读取 `customer-review-email-draft.json`。
- 如果只是想检查门禁，不真的发，去掉 `--send true`。
- 正式发送后会写：
  - `customer-review-email-send.json`
  - case timeline event：`customer_review_email_sent`

查看位置：

- `docs/CUSTOMER_COMMUNICATION_CONTRACT.md`
- `core/funnel/customer-email.js`
- Resend dashboard。
- case timeline。
- Discord thread。

## Stage 10: Revision Loop

目标：客户可以提交修改，但必须匹配订单，且次数可控。

输入：

- 官方 revision form。
- Order ID。
- Checkout email。
- Requested changes。
- Optional attachments。

输出：

- Revision accepted 或 denied。
- Quota usage update。
- Accepted revision agent task。
- Customer email。
- Discord thread update。

验证：

- Order ID 和 checkout email 必须匹配。
- 创建任务前先检查 quota。
- accepted revision 增加 used count。
- 超过额度不创建 agent task，而是给 extra revision checkout link。
- extra revision 付款只增加额度，不直接创建网站修改任务。
- 同一个 Discord thread 被复用。
- 附件上传到 Cloudinary 或记录为外部 asset link。

查看位置：

- `data/funnel/orders/<client>/<order>.json`
- `data/cases/<client>/<order>/`
- `data/agent-tasks/<client>/`
- Discord thread。

## Stage 11: Approval / Publish Live

目标：客户确认后，把 approved dev version 发布到 live。

输入：

- 官方 approval form。
- Order ID。
- Checkout email。
- Customer repo `dev`。
- 最新 QA result。

输出：

- `main/live` branch update。
- Cloudflare Pages live deploy。
- Live URL。
- Customer live email。
- Case timeline update。

验证：

- Order ID + email 匹配。
- source branch 是 `dev`，target branch 是 `main`。
- publish workflow 成功。
- live URL HTTP 200。
- live email 包含 order ID 和 live URL。
- Discord thread 记录 publish result。

查看位置：

- GitHub Actions。
- Cloudflare Pages。
- customer repo `main`。
- case timeline。
- Resend dashboard。

## Stage 12: Domain Setup

目标：设置最终公开访问域名。

输入：

- 官方 domain setup form。
- Order ID。
- Checkout email。
- Requested route：
  - 免费 ProfitsLocal subdomain；
  - 客户自己的 subdomain；
  - 客户自己的 root/apex domain。

输出：

- Domain request record。
- Cloudflare DNS/Pages attach state。
- 客户操作说明或已连接确认。
- Domain status email。

验证：

- 免费 ProfitsLocal subdomain：创建 CNAME，并 attach Pages custom domain。
- 客户 subdomain：给客户明确 CNAME target，等待客户 DNS。
- 客户 root domain：必须人工 review，不自动改 DNS。
- 官方 `/api/domain-request` 必须正确把三种 route dispatch 到 `domain-request.yml`。
- `/domain-setup` 页面必须明确写出三种 route、示例域名、提交后会发生什么。
- `/domain-help` 页面必须明确写出 subdomain CNAME 示例和 root domain 风险提醒。
- active domain HTTP 200。
- Cloudflare proxied CNAME 可能在 public DNS 看起来像 A/AAAA，所以检查时要用 Cloudflare-aware inspect，不要只看 `dig CNAME`。

常用命令：

```bash
npm run domain:test-entrypoint
npm run domain:test-request
npm run domain:test-pages
```

查看位置：

- `data/domain/requests/<client>/`
- Cloudflare DNS。
- Cloudflare Pages custom domains。
- customer email。

## Stage 13: Finance / ROI Log

目标：记录足够的收入和成本，后面能看 ROI。

输入：

- Stripe revenue。
- Resend email count。
- Google Places/Maps usage。
- Firecrawl/TinyFish usage。
- OpenAI/image generation usage。
- Cloudinary upload/storage events。
- Agent runtime estimate。

输出：

- `data/finance/ledger.jsonl`
- customer/project ROI view。

标准命令：

```bash
npm run finance:report -- --client <client-slug>
npm run finance:report -- --client <client-slug> --json true
npm run finance:report -- --client <client-slug> --output data/finance/<client>-summary.json
```

验证：

- 每笔 payment 写 revenue。
- provider usage 能写 count/cost 就写。
- email send 在配置成本后写 Resend event。
- agent runtime 可以估算。
- report 要能同时给人看（CLI）和给系统读（JSON）。
- summary 至少包含 revenue / cost / profit / ROI / event counts / byProvider / byClient。

查看位置：

- `data/finance/ledger.jsonl`
- admin dashboard，后续完善。
- `data/finance/<client>-summary.json`

当前 dashboard/ops 使用方式：

- `/admin` 和其他 `/admin/*` 路径现在都受 `ADMIN_ACCESS_TOKEN` 保护：
  - 可以第一次用 `/admin?token=<ADMIN_ACCESS_TOKEN>` 进入；
  - 也可以直接打开 `/admin`，在品牌化 sign-in 页面里粘贴 token；
  - 成功后会写 `pl_admin_token` cookie，7 天内复用。
- `/admin` 总览页现在会显示：
  - business snapshot；
  - needs-action-now；
  - ready-to-review 候选；
  - stage mix；
  - 到 intakes / finance / queue 的入口。
- `/admin/finance` 现在会显示：
  - revenue / cost / profit / ROI；
  - byClient；
  - byProvider；
  - byCategory。
- `/admin/queue` 现在会显示：
  - revision now；
  - send customer review；
  - waiting DNS；
  - missing Open Design；
  - QA blocked。
- `/admin/intakes` 列表页现在会显示：
  - finance overview（总 revenue / cost / profit / ROI / ledger counts）；
  - needs-action-now 队列；
  - top clients / provider spend 摘要；
  - 总览 cards（ready for review / revisions pending / waiting DNS / profitable projects）；
  - pipeline board（按 stage 分栏查看项目）；
  - project stage；
  - health pills（Open Design / QA / Outreach / Domain）；
  - 推荐 next action；
  - 当前 ROI profit。
  - 浏览器端 saved views/filter（review ready / revision pending / waiting DNS / missing Open Design / QA blocked）。
- `/admin/intakes/<client>/<order>` 详情页现在会显示：
  - project stage；
  - recommended next action；
  - blockers 列表；
  - workflow / latest task status；
  - latest workflow run URL / run ID / smoke evidence path；
  - operator console（Discord / repo / preview / live / artifacts）；
  - outreach proof 摘要；
  - delivery QA 状态；
  - ROI snapshot；
  - 对应的 repo 路径。

## 2026-05-07 全流程演练记录

这次用 Opa/Rich & Rare 现有 fixtures 和 test-mode 跑了一遍核心闭环。演练不写真实客户数据，也不写真实 ROI ledger。

### 通过的验证

| 验证命令 | 覆盖内容 | 结果 |
|---|---|---|
| `npm run contracts:validate-core` | survey、delivery QA、collect skill、ready-to-build contract | 通过 |
| `npm run leads:test-qualification` | no website、bad website、good website 三类 lead 判断 | 通过 |
| `npm run intake:test-website-ready` | website-ready packet | 通过 |
| `npm run open-design:test-workspace-binding` | Open Design bound/missing 两种状态 | 通过 |
| `npm run open-design:test-port-production-handoff` | Open Design handoff port 到生产 repo 结构 | 通过 |
| `npm run hermes:test-website-agent-closure` | sale、revision、same Discord thread、agent run、review/live email | 通过 |
| `npm run agent:test-approval-resolution` | approval 用 order ID + email 匹配，`dev -> main` | 通过 |
| `npm run agent:test-pre-review-gate` | customer email 前必须有 context、design protocol、screenshots、delivery QA | 通过 |
| `npm run funnel:test-paid-revision-flow` | 3 次 included revisions、Cloudinary attachment、超额拒绝 | 通过 |
| `npm run funnel:test-extra-revision-entitlement` | $100 extra revision 增加额度，不直接创建 agent task | 通过 |
| `npm run funnel:test-cloudinary-attachments` | Cloudinary attachment upload/manifest | 通过 |
| `npm run ops:test-init-project` | 新项目初始化、Open Design 必选、标准 milestone | 通过 |
| `npm run domain:test-request` | 免费子域名、客户 subdomain、root domain review | 通过 |
| `npm run domain:test-entrypoint` | 官方 `/api/domain-request` route 分类和 workflow dispatch | 通过 |
| `npm run funnel:test-domain-email-guidance` | customer emails 使用官方 ProfitsLocal links | 通过 |
| `npm run qa:test-delivery-qa` | delivery QA pass/blocker/missing 三种状态 | 通过 |
| `npm run outreach:test-pack` | outreach pack JSON/Markdown 产物、audit/proof points | 通过 |
| `npm run outreach:test-email` | cold outreach dry-run artifact 包含品牌化 HTML | 通过 |
| `npm run funnel:test-paid-intake-index` | admin summary 吃到 outreach / QA / ROI / blocker / workflow 摘要 | 通过 |
| `npm run finance:test-report` | ROI CLI/JSON summary、byClient/event counts | 通过 |
| `npm run admin:test-auth-middleware` | admin sign-in screen、form sign-in、cookie redirect | 通过 |
| `npm run qa:opa-full-loop-live-sim` | 中心闭环 + template build + pre-purchase banner + order-mode footer | 通过 |
| `npm run build` | ProfitsLocal 官方站 build | 通过 |

### 演练中发现并修掉的问题

1. `qa:opa-full-loop-live-sim` 还在调用旧的 customer repo 本地脚本 `smoke:revision-request` 和 `smoke:approval-request`。
   - 这是旧架构假设。
   - 现在正确架构是：customer repo 不放本地 revision/approval pages；这些都在 `profitslocal.com`。
   - 已改成验证 template build、官方 funnel links、removed local funnel routes、post-purchase order-mode links。

2. `qa:preview-sales-bar` 还要求 customer repo banner 显示 `1/3 used`。
   - 这是旧架构假设。
   - 现在 revision quota 由官方 ProfitsLocal 页面和 email 管理，customer repo 不应该依赖本地 `/api/order-status`。
   - 已改成验证 official approve/revision/extra-revision links、order/email/context 参数、mobile/desktop 不溢出。

### 当前闭环判断

核心业务闭环已经可跑：

```text
lead/intake
  -> website-ready
  -> Open Design binding
  -> production handoff
  -> dev preview QA
  -> checkout/payment routing
  -> Discord website task
  -> revision quota + Cloudinary attachment
  -> customer review email
  -> approval dev->main
  -> domain setup routing
  -> finance/ROI ledger
```

还没有完全自动化但已有 SOP/测试覆盖的部分：

- 真实 cold outreach 的大规模发送不在 Resend 主流程里，后面可接 Gmail/Instantly/Smartlead。
- Open Design app 里人工编辑后的视觉质量，需要 Matthew 或 design QA 最后确认。
- 成本 ledger 目前有框架，provider 的真实单价和免费额度还要逐步填全。

## 2026-05-07 Fresh Project 演练：Dark Shepherd

这次不是旧 fixture，而是新建了一条真实 restaurant pipeline 验证单：

- client slug: `dark-shepherd-restaurant`
- official site: `https://www.darkshepherd.com.au/`
- local repo dir: `/Users/matthew/Developer/dark-shepherd-restaurant`
- dry-run order: `fresh_dark_shepherd_dryrun_001`

### 这次真实跑通的步骤

1. `npm run ops:init-project -- --client dark-shepherd-restaurant ...`
2. Google Places 写入 evidence。
3. 官网品牌资产写入 evidence。
4. TinyFish 抓 homepage + `/menu`，再把菜单文本解析成 `menu.sections`。
5. `npm run intake:build-website-ready -- --client dark-shepherd-restaurant --source manual`
   - 结果：`website_ready_to_build`
6. Open Design headless run 现在可以在 `app-visible` 模式下创建同一个 project，并通过 `artifact_quiet_fallback` 从真实 project 目录回收 `index.html/menu.html/functions.html/contact.html/brand-spec.md`。
7. `npm run open-design:build-production-handoff ...`
8. `npm run open-design:port-production-handoff -- --client dark-shepherd-restaurant --target-repo /Users/matthew/Developer/dark-shepherd-restaurant --execute true`
9. customer repo 本地安装依赖并 `npm run build`
10. `npm run qa:funnel-pages -- --dist-dir /Users/matthew/Developer/dark-shepherd-restaurant/dist --client "Dark Shepherd"`
11. `npm run qa:write-delivery-qa -- --client dark-shepherd-restaurant --order fresh_dark_shepherd_dryrun_001 ...`
12. `npm run ops:project-dry-run -- --client dark-shepherd-restaurant ... --order fresh_dark_shepherd_dryrun_001`
   - 最终结果：`ready_for_customer_review`

### 这次 fresh project 暴露并修掉的问题

1. Admin 首次登录 `?token=` 会 302 回自己，形成循环。
2. Google Places evidence 会让 `maps.google.com/?cid=` 压过标准 `google.com/maps/search`。
3. 品牌资产 extractor 会保留 `http://` 图片链接，导致 `website-ready` 卡在资产校验。
4. `open-design:sync-from-app` 的资产路径需要保留 `assets/...` 相对路径，不能压扁成裸文件名。
5. Open Design headless fallback 不能把 `.od-skills` 当成真实产物，必须忽略 dot 目录，并至少看到真实 `html` 页面才允许 quiet fallback 成功。

这些问题修掉后，这条 fresh project 才真正到达 `ready_for_customer_review`。

## 2026-05-08 Fresh Project 演练续跑：Dark Shepherd 从 Review 到 Live + Domain

在 `2026-05-07` 的 fresh project 基础上，我们又把同一个 `dark-shepherd-restaurant` case 从：

```text
ready_for_customer_review
-> Discord/forum handoff
-> customer review email
-> official approval
-> publish live
-> custom domain active
```

真正跑通了一次。

### 这次真实跑通的步骤

1. `npm run ops:send-dry-run-handoff -- --client dark-shepherd-restaurant --order fresh_dark_shepherd_dryrun_001 --send true`
   - 结果：forum post 标题变成 `[Review] Dark Shepherd`
2. `npm run ops:send-review-email -- --client dark-shepherd-restaurant --order fresh_dark_shepherd_dryrun_001 --send true`
   - 结果：真实 review email 发出
3. 通过官方 `POST https://profitslocal.com/api/approval-request` 触发 approval
4. 修复 `publish-approved.yml` 后再次触发 approval
5. `publish-approved.yml` 最终成功
   - live 站点变成 `200`
   - remote case 状态写成 `live_published`
6. `npm run domain:request -- --client dark-shepherd-restaurant --order fresh_dark_shepherd_dryrun_001 --email matthew6688@gmail.com --domain dark-shepherd-fresh.profitslocal.com --project dark-shepherd-restaurant-live --execute true --send-email true --send-discord true`
7. 通过官方 `POST https://profitslocal.com/api/domain-status` 触发 refresh
8. `domain-request.yml` 成功后，官方 domain status 返回 `active`

### 这次续跑暴露并修掉的问题

1. `publish-approved` 在 GitHub Actions 里只 clone customer repo，但没有安装依赖
   - 结果：`npm run build` 失败，报 `astro: command not found`
   - 修复：发布前先执行 `npm ci` 或 `npm install`

2. `publish-approved` workflow 在 Actions 环境里没有稳定的 git auth / git identity
   - 结果：提交 `main` 分支时不稳定
   - 修复：在 workflow 里显式配置 `GH_PAT`、`gh auth setup-git`、`git user.name`、`git user.email`

3. `domain-request.yml` 代码虽然支持 `CF_ZONE_ID`，但 GitHub repo 真正没配 secret
   - 结果：官方 `/api/domain-status` refresh 会失败
   - 修复：
     - workflow 允许从 `secrets.PROFITSLOCAL_CF_ZONE_ID || secrets.CF_ZONE_ID || vars.PROFITSLOCAL_CF_ZONE_ID || vars.CF_ZONE_ID` 读取
     - repo 里真实补上 `CF_ZONE_ID` 和 `PROFITSLOCAL_CF_ZONE_ID`

### 这次续跑的硬证据

- review email:
  - Resend id: `134d5b4e-f3b3-47e6-801d-2a6b99bbae6c`
- approval workflow 成功：
  - run id: `25527314331`
  - 证据：`data/qa/fresh-dark-shepherd-live/approval-workflow-rerun-2.json`
- live site:
  - `https://dark-shepherd-restaurant-live.pages.dev/` -> `200`
- custom domain:
  - `https://dark-shepherd-fresh.profitslocal.com/` -> `200`
- domain workflow 成功：
  - run id: `25527686136`
  - 证据：`data/qa/fresh-dark-shepherd-live/domain-status-active.json`
- 官方 status endpoint：
  - `POST https://profitslocal.com/api/domain-status`
  - 返回：`status=active`

这条链打通后，`A2` 已经可以视为真实完成。下一条最该继续压的是 `A3`：真实 revision 闭环。

## 2026-05-08 Fresh Project 演练补充：Dark Shepherd 从 Approval 到 Live + Domain 的最终真相源对齐

在上一轮 `review -> approval -> live -> domain` 跑通之后，我们又补了一次“记录层校正”。这一步很重要，因为只有站点上线还不够，`case.json / context-packet.json / timeline.jsonl / agent-runs.jsonl` 也必须和真实外部状态一致。

### 这次补齐了什么

1. **确认官方 first-party approval endpoint 这次本地尝试返回 `403`**
   - endpoint:
     - `POST https://profitslocal.com/api/approval-request`
   - 结论：
     - 这次不是靠 first-party endpoint 完成的
     - 而是用正式 GitHub workflow 直接 dispatch 来验证核心 publish 链

2. **用正式 workflow 完成真实 publish**
   - automation repo workflow:
     - `publish-approved.yml`
     - run id: `25529038353`
   - customer repo main deploy:
     - repo: `matthew6688/dark-shepherd-restaurant`
     - run id: `25529057388`
   - main commit:
     - `3fb6e247ff7407419253d84a3ce05097ed9eacb4`

3. **重新核对 live 与 custom domain 的真实内容**
   - `https://dark-shepherd-restaurant-live.pages.dev/`
   - `https://dark-shepherd-fresh.profitslocal.com/`
   - 两边都命中了 revision 后的新内容：
     - `late-night reservations`
     - `Reserve a table`
     - `Private dining is available for intimate groups; keep the booking flow visible for late sittings and function enquiries.`

4. **修正 forum workspace 元数据漂移**
   - publish/live 后，Discord forum post 的真实状态是：
     - thread id: `1502085064148647989`
     - parent channel id: `1501945763650080899`
     - thread name: `[Live] Dark Shepherd`
     - tags:
       - `1501948304479748155` (`live`)
       - `1501948304479748148` (`restaurant`)
   - 但旧逻辑会把 `websiteWorkspaceChannelId` 误写成 thread id，并保留旧的 `[Revision 1/3]` 标题。
   - 修复后：
     - `scripts/agent/publish-approved.js`
     - `scripts/domain/request.js`
   - 现在会把 forum parent id、最终 thread title、最终 tags 一起带进 `recordCaseNotification()`

5. **把 live customer email 也写回 case/timeline**
   - workflow log 已证明 live email 发出：
     - Resend id: `8fc55a70-379e-4c91-8e7f-f313cc17b93a`
   - 旧记录层没有把这件事写进 timeline
   - 现在已补：
     - timeline event: `live_published_customer_email_sent`
     - `case.latestAgentRun.audit.customerEmailId`
     - `agent-runs.jsonl` 对应 publish run 的 `audit.customerEmailId`

### 这次补齐后的最终硬证据

- 单一 summary：
  - `data/qa/fresh-dark-shepherd-live/approval-live-domain-summary.json`
- live email 记录已回写：
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/case.json`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/agent-runs.jsonl`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/timeline.jsonl`
- forum live 状态已回写：
  - `websiteWorkspaceChannelId = 1501945763650080899`
  - `websiteWorkspaceName = [Live] Dark Shepherd`
  - `websiteWorkspaceTagIds = [1501948304479748155, 1501948304479748148]`

### 这次补齐后的结论

到这里为止，`Dark Shepherd` 这条 fresh 项目链已经不只是“真实上线成功”，而是：

```text
approval attempt recorded
-> direct publish workflow verified
-> live deploy verified
-> custom domain verified
-> forum live state verified
-> customer live email recorded
-> case/context/timeline/agent-runs all aligned
```

这才算真正满足我们的 hard evidence 标准。

## 2026-05-08 Fresh Project 演练续跑：Dark Shepherd 真实 Revision 闭环

这次我们把最容易“表面看起来成功、实际上没改站”的一段彻底拆开了。

目标链路是：

```text
customer revision
-> same case / same forum workspace
-> local Open Design continuation
-> production handoff
-> port 到 customer repo dev
-> dev preview 真的变更
-> review Discord + review email
```

### 先暴露出来的真实架构问题

官方 `revision-submit -> route-funnel-event.yml` 这一段虽然已经能：

- 正确扣减 revision 次数；
- 复用同一个 case；
- 复用同一个 `website-projects` forum post；
- 生成新的 revision task；

但它原本还会默认触发 GitHub Actions 里的 `agent:complete-task`。

这一步的真实问题是：

- 远端 runner 只会执行 `apply:restaurant-artifacts`
- 它会重放 `content.restaurant.json` / `design.restaurant.json`
- **不会消费 `requestedChanges` 去做新的设计修改**

所以那种“workflow 成功、case 更新了、dev push 了”的结果，**不能算真实 revision 完成**。

### 这次对 revision 架构做的修正

1. `buildRevisionWorkflowDispatch()` 现在默认：
   - `auto_run_agent=false`
2. `route-funnel-event.yml` 现在对 `kind=revision`：
   - 不再默认 clone customer repo
   - 不再默认让 GitHub Actions 假装完成设计修改
3. revision task 明确标记：
   - `executionMode=local_open_design`
4. forum handoff 里明确写：
   - revision 的真正执行路径是：
   - **本地 Open Design / Hermes -> rebuild handoff -> port 到 dev**

这一步的意义是：**系统先说真话，再自动化。**

### Dark Shepherd 这次真实 revision 是怎么完成的

1. 官方 revision form 仍然照常进入：
   - 扣减次数
   - 更新 case
   - 更新 forum
   - 生成 revision task
2. 在同一个 Open Design project 上继续：
   - `projectId = dark-shepherd-restaurant-open-design-1778154549135`
   - `runId = 30bf721e-9aa8-41b2-b32b-dead73680002`
3. 根据 continuation 的真实 concept 结果，把 canonical source-of-truth 更新为：
   - hero supporting copy 强调 steakhouse dining + late-night reservations
   - 官方 SevenRooms booking 链接
   - reservation CTA 旁的 private dining note
4. 重建 production handoff
5. 在**干净的临时 clone** 里 port 到 customer repo `dev`
   - 这次没有使用用户本地那个 dirty repo
6. customer repo 本地 build 成功
7. push 到 `dev`
8. `Deploy Dev` workflow 成功
9. 真实线上 dev preview 出现了新的文案和 note
10. 发回同一个 forum post，并发出新的 review email

### 这次验证到的硬证据

- local Open Design continuation:
  - `runId: 30bf721e-9aa8-41b2-b32b-dead73680002`
- dev push commit:
  - `3ec1e62500b7a85ee05164cf938f0ec90f7e9c5a`
- dev deploy workflow:
  - run id: `25528503496`
  - URL: `https://github.com/matthew6688/dark-shepherd-restaurant/actions/runs/25528503496`
- 真实 preview 命中：
  - `Steakhouse dining built around live fire, late-night reservations...`
  - `Reserve a table`
  - `Private dining is available for intimate groups...`
- QA 截图：
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/artifacts/revision-2026-05-08-desktop.png`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/artifacts/revision-2026-05-08-mobile.png`
- review email:
  - Resend id: `2a7027d2-d272-427d-b20c-5188bb99f727`
- 统一总结：
  - `data/qa/fresh-dark-shepherd-live/revision-local-review-ready.json`

### 这次顺手修掉的一个 Discord 细节

forum workspace 之前会把：

- forum 父频道 id
- forum post thread id

混成同一个值。

结果是后续更新 tag 时，有机会把 thread 当成 forum channel 去调用 Discord API。

现在已经修正为：

- `workspaceChannelId = forum 父频道`
- `threadId = 具体项目 post`

这样以后 revision / approved / live / domain-blocked 的 stage 更新会更稳。

## 项目健康状态判断

一个健康的网站项目应该同时具备：

- evidence file；
- website-ready packet；
- Open Design project；
- production handoff；
- customer repo dev preview；
- Discord website thread；
- agent task packet；
- delivery QA screenshots/results；
- branded customer emails；
- paid order/revision/domain records，如果已付款；
- finance ledger entries。

缺一个，就不能算完整 operational。

## 新 repo 标准入口

以后我们只要求新 repo 按新 SOP 跑顺。老 repo 不再作为当前闭环标准。

新项目的标准入口只有一条：

```text
evidence
-> website-ready packet
-> Open Design project
-> production handoff
-> customer repo dev build
-> preview funnel QA
-> agent task draft
-> customer review email draft
-> ready_for_customer_review
```

### 新 repo 启动命令

```bash
npm run ops:project-dry-run -- \
  --client <client-slug> \
  --business-name "<Business Name>" \
  --source-url <official-website-or-source-url> \
  --repo matthew6688/<client-repo> \
  --repo-dir /path/to/local/customer/repo \
  --email <test-or-customer-email> \
  --run-open-design true \
  --build-handoff true
```

### 新 repo 成功标准

只要 dry-run 最终返回：

```text
status=ready_for_customer_review
```

就说明这个新 repo 已经达到当前业务闭环要求。

必须同时产出这些文件：

- `ops-checklist.json`
- `ops-checklist.md`
- `website-handoff.json`
- `website-handoff.md`
- `agent-task-draft.json`
- `customer-review-email-draft.json`

### 新 repo 交接入口

成功的 dry-run 会额外生成：

- `data/cases/<client>/<dryrun-id>/website-handoff.json`
- `data/cases/<client>/<dryrun-id>/website-handoff.md`

这两份就是后续发到 Discord thread、人工 review、或者交给其他 agent 的标准中文交接材料。

当 dry-run 成功后，下一步标准动作是：

```text
ready_for_customer_review
-> 发送 Discord website handoff
-> 发送或预演 customer review email
-> 等客户 revision 或 approval
```

对应命令：

```bash
npm run ops:send-dry-run-handoff -- --client <client-slug> --order <dryrun-id> --send true
npm run ops:send-review-email -- --client <client-slug> --order <dryrun-id> --send true
```

## Operator 一键 Dry-run

当我们想知道一个项目离“可以发给客户 review”还差什么时，先跑 dry-run，不要凭感觉判断。

命令：

```bash
npm run ops:project-dry-run -- \
  --client <client-slug> \
  --business-name "<Business Name>" \
  --source-url <official-website-or-source-url> \
  --repo matthew6688/<client-repo> \
  --repo-dir /path/to/local/customer/repo \
  --email <test-or-customer-email>
```

它会做这些事：

- 创建 `data/cases/<client>/<dryrun-id>/case.json`。
- 写 `context-packet.json`，让 agent 后面知道这个 dry-run 的上下文。
- 验证 evidence。
- 生成或刷新 website-ready packet。
- 检查 Open Design project 是否已经绑定。
- 检查 production handoff 是否存在。
- 如果提供 `--repo-dir`，构建 customer repo 并验证 preview banner 是否指向官方 `profitslocal.com`。
- 生成 `agent-task-draft.json`。
- 如果提供 email，生成 `customer-review-email-draft.json`，但不会发送。
- 写出 `ops-checklist.json` 和 `ops-checklist.md`。

输出位置：

```text
data/cases/<client>/<dryrun-id>/ops-checklist.json
data/cases/<client>/<dryrun-id>/ops-checklist.md
```

判断方式：

- `status=ready_for_customer_review`：核心阶段都通过，可以进入人工 review 或正式 customer review。
- `status=blocked`：至少一个关键阶段缺失，先看 `nextActions`。

这次 Opa dry-run 的 hard evidence：

```bash
npm run ops:project-dry-run -- \
  --client opa-bar-mezze-restaurant \
  --business-name "Opa Bar & Mezze" \
  --source-url https://www.opabar.com.au/ \
  --repo matthew6688/opa-bar-mezze-restaurant \
  --repo-dir /Users/matthew/Developer/webjuice-restaurant \
  --email matthew6688@gmail.com
```

结果：

- evidence validation：通过。
- website-ready packet：通过。
- customer repo build：通过。
- preview banner / official funnel links：通过。
- agent task draft：通过。
- review email draft：通过。
- blocker：缺 Open Design project binding。
- blocker：缺 production handoff。

这说明 Opa 这类老项目在当前 SOP 下不能直接算完整 ready。下一步必须先创建或绑定 Open Design project，然后生成 production handoff。

## 2026-05-08 Open Design / repo 切换追加验证

这轮又用 `dark-shepherd-restaurant` 补跑了一次：

```bash
npm run open-design:sync-from-app -- --client dark-shepherd-restaurant
npm run open-design:build-production-handoff -- --client dark-shepherd-restaurant
npm run open-design:port-production-handoff -- --client dark-shepherd-restaurant --target-repo /Users/matthew/Developer/dark-shepherd-restaurant --execute true
npm --prefix /Users/matthew/Developer/dark-shepherd-restaurant run build
```

结果：

- `projectId` 仍然是：
  - `dark-shepherd-restaurant-open-design-1778154549135`
- `lastRunId` 仍然挂在同一个 project 上；
- `production-handoff.json` 可继续生成；
- port 到 customer repo 后，repo build 通过。

证据：

- `data/qa/open-design/dark-shepherd-sync-cycle-summary.json`
- `clients/dark-shepherd-restaurant/concept/open-design/concept-manifest.json`
- `clients/dark-shepherd-restaurant/concept/open-design/run-status.json`
- `clients/dark-shepherd-restaurant/concept/open-design/production-handoff.json`

## 2026-05-07 新 repo 闭环追加验证

这次新增验证的是 dry-run 之后的两个操作门：

1. `ready_for_customer_review -> Discord website handoff`
2. `ready_for_customer_review -> customer review email`

通过的验证：

| 验证命令 | 覆盖内容 | 结果 |
|---|---|---|
| `npm run ops:test-dry-run-handoff` | ready 项目才能发 handoff；创建/复用 website thread；case 记录 thread；生成 dispatch evidence | 通过 |
| `npm run ops:test-review-email-gate` | ready 项目才能发 review email；blocked 项目被拒绝；发送后写 timeline 和 evidence | 通过 |
| `npm run ops:test-workflow-dispatch` | approval/revision 两个入口的 workflow dispatch contract | 通过 |
| `npm run ops:test-revision-thread-reuse` | revision form payload 进入 funnel 后，复用原 case 和原 website thread | 通过 |
| `npm run ops:test-customer-actions-rehearsal` | sale -> revision -> approval 三段动作围绕同一个项目记忆演练 | 通过 |
| `npm run ops:test-customer-entrypoints` | 官方 approval/revision 页面入口是否把请求送到正确 workflow | 通过 |
| `npm run ops:test-first-party-revision-routing` | first-party revision payload 经过 `revision-submit -> route-funnel-event` 后，不再掉进 `unknown-client`，而是保持正确 `client_slug/repo/case/thread` | 通过 |

这两个步骤加上原有验证：

- `npm run hermes:test-website-agent-closure`
- `npm run agent:test-approval-resolution`
- `npm run funnel:test-paid-revision-flow`

就形成了当前新 repo 的核心业务闭环：

```text
ops:project-dry-run
-> ops:send-dry-run-handoff
-> ops:send-review-email
-> customer revision or approval
-> revision thread reuse / dev update
-> approval dev->main
-> live publish
```

这里要特别注意：

- `approval` 的线上入口应该走 `publish-approved.yml`
- `revision-submit` 的线上入口必须走 `route-funnel-event.yml`，并且 `kind=revision`

原因是：

- `publish-approved.yml` 负责用 `order ID + email` 去找正确 case，再把 `dev -> main`
- `route-funnel-event.yml` 才会真正进入 `case / task / website thread` 体系
- 旧的 `record-paid-revision.yml` 只会更新 `data/paid-intakes`，不足以完成当前新闭环

## 2026-05-08 fresh remote bootstrap 追加验证

这轮补的是“不是本地 dry-run，而是真正创建 GitHub repo + Cloudflare Pages project + 自动部署”。

### 发现的真实问题

第一次真实 smoke 证明了：

- `main` push 会立刻触发 `Deploy Live`；
- 但 `dev` branch 在 bootstrap 的第一次 push 上，GitHub 不一定会立刻触发 `Deploy Dev`；
- 结果会出现：
  - `live.pages.dev = 200`
  - `dev.pages.dev = 522`

这不是 Pages 配置错，而是 bootstrap 太快时，GitHub 还没把新 repo 的 `deploy-dev.yml` 索引好。

### 修复

bootstrap 现在新增两步：

1. `create-dev-bootstrap-commit`
   - 在第一次 `push-dev` 前先造一个空 commit；
2. `ensure-dev-action-trigger`
   - 如果第一次 `push-dev` 后 still no dev workflow run；
   - 自动再补一个空 commit；
   - 直到 GitHub 真正出现 `Deploy Dev` run。

本地验证命令：

```bash
npm run deploy:test-bootstrap-client-repo
```

### 真实 smoke 结果

第三个 smoke repo：

- repo:
  - `matthew6688/bootstrap-remote-smoke-c-1778165513`
- live run:
  - `25503433403`
- dev run:
  - `25503511777`
- URLs:
  - `https://bootstrap-remote-smoke-c-1778165513-live.pages.dev`
  - `https://bootstrap-remote-smoke-c-1778165513-dev.pages.dev`

最终结果：

- live: `HTTP 200`
- dev: `HTTP 200`

证据：

- `data/qa/fresh-remote-bootstrap/bootstrap-remote-summary-c.json`
- `data/qa/fresh-remote-bootstrap/ensure-dev-trigger-c.json`
- `data/qa/fresh-remote-bootstrap/bootstrap-runs-c-dev-final.json`

## 2026-05-07 官方线上入口真实 smoke

这一步不是本地 mock，也不是只测 function handler。

它直接走：

1. `https://profitslocal.com/approve`
2. `https://profitslocal.com/revision`
3. 官方 Pages Function API
4. GitHub Actions workflow
5. 远端 `data/cases` / `data/funnel/orders`

### 真实 smoke 命令

```bash
npm run ops:test-customer-live-smoke
```

### 这次真实 smoke 修掉的两个线上 bug

1. **first-party revision 被错误当成 tally webhook 普通 payload**
   - 现象：workflow 成功，但 routed 到 `unknown-client`，没有回到真实 case / thread。
   - 原因：`normalizeTallySubmission()` 只读 `payload.fields/answers`，不读 first-party 顶层字段。
   - 修复：顶层标量字段也并入 normalizer。
   - 对应验证：`npm run ops:test-first-party-revision-routing`

2. **`publish-approved.yml` 在 clone client repo 前写 `GITHUB_ENV` 的 shell/node 混合写法有问题**
   - 现象：approval workflow 在 `Clone client repo` 步骤报错。
   - 原因：bash 对内嵌模板字符串发生错误展开。
   - 修复：改成 heredoc Node block，显式逐行写入 `GITHUB_ENV`。

### 真实 smoke 结果

第一轮真实 smoke 证据目录：

- `data/ops-smoke/customer-live-2026-05-07T08-14-47-168Z/`

它暴露了两个问题：

- approval workflow 被真正执行，但失败；
- revision workflow 成功，却落到了 `unknown-client`。

修复后，第二轮真实 smoke 证据目录：

- `data/ops-smoke/customer-live-2026-05-07T08-20-23-585Z/`

关键结果：

- 官方 `/approve` 页面：HTTP 200，表单存在；
- 官方 `/revision` 页面：HTTP 200，表单存在；
- approval 请求被官方入口接受，并真实 dispatch 到：
  - `Publish Approved Site`
  - run: `25484470761`
  - URL: `https://github.com/matthew6688/webjuice-stack-mvp/actions/runs/25484470761`
- revision 请求被官方入口接受，并真实 dispatch 到：
  - `Route Funnel Event`
  - run: `25484499440`
  - URL: `https://github.com/matthew6688/webjuice-stack-mvp/actions/runs/25484499440`

revision 这一条的真实结果已经闭环：

- `websiteTaskThreadId` 保持不变：`1501197070319616011`
- 远端 case `revision.used`：`1 -> 2`
- 远端 case `revision.remaining`：`2 -> 1`
- 远端 order `revisionUsed`：`1 -> 2`
- 远端 `latestTask` 更新为新的 revision task

也就是说，**官方 revision 页面 -> official API -> route-funnel-event -> case/task/thread 复用** 这一条现在是真正打通的。

### 2026-05-07 最终修复与通过结果

在上面两轮失败之后，又做了两项修复：

1. 官方 Cloudflare Pages 项目 `profitslocal-live` 增加生产环境变量：
   - `APPROVAL_ALLOW_DRY_RUN=true`
2. workflow 写回 `main` 的最后一步加固：
   - `publish-approved.yml`：`git commit` 后先 `git pull --rebase origin main` 再 `git push`
   - `route-funnel-event.yml`：`git commit` 后先 `git pull --rebase origin main` 再 `git push`

这样做的原因：

- approval live smoke 需要一个真正安全的 `dry_run`
- revision live smoke 在真实并发下，不能因为 `main` 快进就直接失败

### 最终通过的真实官方 smoke

最终通过的证据目录：

- `data/ops-smoke/customer-live-2026-05-07T08-38-18-764Z/`

最终通过结果：

- approval run：
  - workflow: `publish-approved.yml`
  - run id: `25485280285`
  - result: `success`
- revision run：
  - workflow: `route-funnel-event.yml`
  - run id: `25485308302`
  - result: `success`

最终断言全部通过：

- `approvalPageOk`
- `revisionPageOk`
- `approvalRequestAccepted`
- `approvalWorkflowCompleted`
- `approvalWorkflowSucceeded`
- `revisionRequestAccepted`
- `revisionWorkflowCompleted`
- `revisionWorkflowSucceeded`
- `revisionCaseStillSameThread`
- `revisionUsedIncremented`
- `revisionRemainingDecremented`
- `orderRevisionUsedIncremented`
- `revisionLatestTaskUpdated`
- `revisionLatestTaskKindIsRevision`
- `localReferenceThreadKnown`

也就是说，围绕新 repo 核心闭环，现在这两条真实官方路径都已经打通：

- **official `/approve` -> official API -> `publish-approved.yml`**
- **official `/revision` -> official API -> `route-funnel-event.yml` -> same case / same website thread**

### 当前 SOP 判断

到 2026-05-07 这一步，围绕新 repo 核心闭环：

- `revision` 的真实官方路径：**已闭环**
- `approval` 的真实官方路径：**已闭环**
- `approval` 的安全 dry-run：**已闭环**
- 官方生产 smoke：**可重复执行**

## 老项目升级路径

这部分专门给早期已经做过、但还没完全进入新闭环的项目用。

典型特征：

- 有 `content.restaurant.json`、`design.restaurant.json`、`evidence/evidence.json`。
- 但没有 `concept/open-design/concept-manifest.json`。
- 或者没有 `production-handoff.json`。
- 或者 customer repo 里还残留旧版本地 funnel 页面，例如 `/domain-help`、`/approve`、`/revise`。

### 升级目标

把老项目补齐成现在的标准状态：

```text
evidence
-> website-ready packet
-> Open Design project
-> production handoff
-> customer repo dev build
-> preview funnel QA
-> agent task draft
-> customer review email draft
```

### 一键升级命令

```bash
npm run ops:project-dry-run -- \
  --client <client-slug> \
  --business-name "<Business Name>" \
  --source-url <official-website-url> \
  --repo matthew6688/<client-repo> \
  --repo-dir /path/to/local/customer/repo \
  --email <test-or-customer-email> \
  --order dryrun_upgrade_001 \
  --run-open-design true \
  --build-handoff true
```

### 升级结果怎么判断

1. 如果卡在 `检查 Open Design project`：
   说明还没有 concept project，需要先让脚本创建。

2. 如果卡在 `检查 production handoff`：
   说明 concept 已经有了，但还没有被翻译成给生产 repo 用的 handoff。

3. 如果卡在 `验证 preview banner 和官方 funnel links`：
   说明老 customer repo 还没有升级到新模板规范，通常是还残留本地 funnel 页面。

### 2026-05-07 升级演练

#### Opa Bar & Mezze

先手动补齐：

- 创建 Open Design project。
- 生成 production handoff。

然后重新跑：

```bash
npm run ops:project-dry-run -- \
  --client opa-bar-mezze-restaurant \
  --business-name "Opa Bar & Mezze" \
  --source-url https://www.opabar.com.au/ \
  --repo matthew6688/opa-bar-mezze-restaurant \
  --repo-dir /Users/matthew/Developer/webjuice-restaurant \
  --email matthew6688@gmail.com \
  --order dryrun_open_design_upgrade_001
```

结果：

- `status=ready_for_customer_review`
- 说明 Opa 现在已经被升级到新闭环标准。

证据：

- [ops-checklist.md](/Users/matthew/Developer/google-map-website/data/cases/opa-bar-mezze-restaurant/dryrun_open_design_upgrade_001/ops-checklist.md)
- [production-handoff.md](/Users/matthew/Developer/google-map-website/clients/opa-bar-mezze-restaurant/concept/open-design/production-handoff.md)

#### Babylon Brisbane

直接跑自动升级：

```bash
npm run ops:project-dry-run -- \
  --client babylon-brisbane-restaurant \
  --business-name "Babylon Brisbane" \
  --source-url https://babylonbrisbane.com.au/ \
  --repo matthew6688/babylon-brisbane-restaurant \
  --repo-dir /Users/matthew/Developer/webjuice-generated/babylon-brisbane-restaurant \
  --email matthew6688@gmail.com \
  --order dryrun_auto_upgrade_001 \
  --run-open-design true \
  --build-handoff true
```

结果：

- Open Design project：自动创建成功。
- production handoff：自动生成成功。
- 最终 blocker：customer repo 还残留旧版 `/domain-help` 本地 funnel 页面。

这说明：

- 自动补齐 Open Design 和 handoff 的逻辑已经通了。
- 下一类要处理的是老 customer repo 的模板同步/本地 funnel 清理。

证据：

- [ops-checklist.md](/Users/matthew/Developer/google-map-website/data/cases/babylon-brisbane-restaurant/dryrun_auto_upgrade_001/ops-checklist.md)
