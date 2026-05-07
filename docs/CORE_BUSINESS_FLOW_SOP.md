# ProfitsLocal 核心业务流程 SOP

更新日期：2026-05-07

这份文档是 ProfitsLocal 做网站业务的日常操作手册。它要回答四个问题：

- 现在项目在哪个阶段？
- 这一步要做什么？
- 需要什么输入，产出什么文件或结果？
- 怎么验证，去哪里看证据？

目标是让 Matthew、Discord/Hermes agent、Codex、Open Design、其他 IDE 都能围绕同一个项目继续工作，不靠聊天记忆，也不把项目做乱。

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
- 每一个 website project 都必须有一个 Discord website task thread。
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
| 内部沟通和决策 | Discord website task thread + case timeline | 任务讨论、客户反馈、agent 运行记录、approval/revision 记录。 |
| 客户付款和售后页面 | `profitslocal.com` | Checkout、revision、approval、domain setup、contact、FAQ。 |

### 每次开工前先做 6 个检查

1. 找到 client slug。
2. 找到 case folder。
3. 打开同一个 Discord website task thread。
4. 检查 `clients/<client>/concept/open-design/concept-manifest.json`。
5. 检查 customer repo 和当前 branch。
6. 判断这次改动属于哪一类：视觉设计、生产实现、business fact 修正。

如果 case、Discord thread、Open Design manifest、repo 指向不同客户或不同项目，不要继续做。先修 binding。

### 如果修改从 Discord 开始

适用场景：Matthew 在项目 thread 里说“帮我改首页 hero”“让 menu 更高级”“客户要求改电话”等。

操作步骤：

1. Agent 先读 task packet 和 case memory。
2. Agent 确认现有 Open Design project ID。
3. 如果是视觉改动，用同一个 Open Design project 做 continuation，不要新建 project。
4. 把 Open Design 更新导出到 `clients/<client>/concept/open-design/`。
5. 重新生成 `production-handoff.json` 和 `production-handoff.md`。
6. 把认可的设计 port 到 customer repo `dev` branch。
7. 跑 build 和 QA。
8. 回到同一个 Discord thread 汇报：
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
3. 运行：

```bash
npm run open-design:sync-from-app -- --client <client>
```

4. 重新生成 production handoff。
5. 在同一个 Discord thread 里让 `website-agent` 把 handoff port 到 customer repo `dev`。
6. 跑 build 和 QA。
7. 把 preview 和 QA result 发回同一个 Discord thread。

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

验证：

- Dev preview HTTP 200。
- Desktop/mobile 截图正常。
- Business name、phone、address、map、booking/contact links 正确。
- 没有 placeholder copy。
- 没有遗漏关键 menu/service 信息。
- customer repo 没有本地 funnel routes。
- banner 链接指向官方 `profitslocal.com`。
- pre-review gate 通过后，才能发 customer review email。

查看位置：

- `data/qa/<client>/`
- `data/cases/<client>/<order>/delivery-qa.json`
- `npm run qa:funnel-pages`
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

验证：

- screenshot 是真实 preview，不是空页面。
- email 有 preview link 和明确 offer。
- 如果是 outbound，不要写得像客户主动委托。
- 联系路径有效。

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
- active domain HTTP 200。
- Cloudflare proxied CNAME 可能在 public DNS 看起来像 A/AAAA，所以检查时要用 Cloudflare-aware inspect，不要只看 `dig CNAME`。

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

验证：

- 每笔 payment 写 revenue。
- provider usage 能写 count/cost 就写。
- email send 在配置成本后写 Resend event。
- agent runtime 可以估算。

查看位置：

- `data/finance/ledger.jsonl`
- admin dashboard，后续完善。

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
| `npm run domain:test-request` | 免费子域名、客户 subdomain、root domain review | 通过 |
| `npm run funnel:test-domain-email-guidance` | customer emails 使用官方 ProfitsLocal links | 通过 |
| `npm run qa:test-delivery-qa` | delivery QA pass/blocker/missing 三种状态 | 通过 |
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
