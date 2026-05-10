# Lead Ops Skill System

更新日期：2026-05-10

这份文档定义网站业务前半段的技能系统：

```text
lead source
-> lead-intake
-> lead-research
-> redesign-check
-> build-ready
-> websiteBuildHandoff
-> outreach-brief
-> demo-video
-> Open Design / paid handoff
```

目标不是“把所有资料都找齐再动”，而是：

```text
用足够真实的信息，
找出最值得推进的机会，
并把它们稳定推进到 preview、outreach、paid、project handoff。
```

---

## 0. 2026-05-10 Handoff Sync

- Repo：`https://github.com/matthew6688/webjuice-stack-mvp`
- 线上 handoff：`https://github.com/matthew6688/webjuice-stack-mvp/blob/main/docs/HANDOFF_2026-05-10.md`
- 当前 release commit：`ab941d2 Add handoff repository links`
- 本文是 lead ops 行为说明；任务优先级以 `docs/P0_P1_TODO.md` 为准。

当前已落地：

- `maps_scraper` 作为 low-cost discovery source。
- `data/leads` central discovery store、entity upsert、event log、queues、report。
- cheap site audit gate：先审站点，再决定 selected enrichment / skip。
- selected enrichment gate：默认 dry-run，不自动花 Tinyfish / Google Places / contact extraction 成本。
- discovery outreach brief：先生成 offer-angle 草稿，明确不能当最终发送文案。
- store promotion：把高潜力 entity 复制到 `clients/<client>/lead/*` 并运行本地 `lead-ops`。
- admin read surface：`/admin/leads` 和 `/admin/queue` 能读取 CRM snapshot、audit evidence、queue action、mockup/outreach stage。

当前还没完成：

- `mockup_building -> mockup_ready` 仍需要真实 Open Design 或 template runner 产物替换 placeholder。
- `draft_ready -> outreach_sent -> follow_up_due / replied -> paid_handoff` 仍需要后台 action、测试和 provider/manual event 回流。
- 长期 generated evidence 需要决定哪些留在 git，哪些迁到外部 artifact storage。

---

## 1. 设计原则

### 1.1 skill 名称

skill 要短、直观、跨行业，不带品牌前缀。

当前建议：

- `lead-intake`
- `lead-research`
- `redesign-check`
- `build-ready`
- `outreach-brief`
- `demo-video`
- `lead-ops`（总控 skill，可后做）

### 1.2 行业边界

这套系统不是只为餐厅设计。

它要支持：

- restaurant
- roofing
- salon
- dental
- law firm
- real estate
- contractor/trades
- 其他本地服务行业

不同 niche 的采集点和验证点会不同，但基础流程应保持一致。

### 1.3 三个硬原则

1. **联系方式是硬门槛。**
2. **事实不完整不是硬门槛。**
3. **demo 可以用 placeholder 补齐，但不能伪装成已验证事实。**
4. **不要因为小问题等人回答。** 自动推进到 AI 结论，只有真正的商业判断才停下来。

AI 早期结论只允许三类：

- `ready_for_mockup`
- `needs_human`
- `skip`

结论必须带 0-100 分数和依据，不允许只给一句“感觉可以”。

### 1.4 不要把 family 和 renderer adapter 混在一起

这套 lead skill 先按 **niche family** 工作，不要求每个行业已经有完整 renderer。

当前两层要分清：

- `niche family`
  - 负责：
    - audience
    - CTA 习惯
    - section order
    - problem type
    - redesign 价值点
- `renderer adapter`
  - 负责：
    - `content.<niche>.json`
    - `design.<niche>.json`
    - niche-specific validation
    - niche-specific production handoff

现阶段：

- family 已开始扩到：
  - `restaurant`
  - `field_service`
  - `clinic`
  - `professional_service`
  - `studio_or_visual`
  - `venue`
- renderer adapter 仍然以 `restaurant` 最完整
- `roofing` / 其他行业先从 family 层吃到更好的 intake / research / teaser / outreach 逻辑

---

## 2. 来源类型

`lead-intake` 第一版应统一支持这些 `sourceType`：

- `google_places`
- `manual`
- `website_inbound`
- `paid_intake`
- `imported_list`
- `maps_scraper`
- `referral`
- `provider_reply`
- `existing_project_reentry`

系统职责不是要求每种来源一样完整，而是把来源差异统一整理成同一份 lead 记录。

---

## 2.0.1 Maps scraper discovery（低成本来源）

`maps_scraper` 是 low-cost discovery source，不是最终事实源。

默认入口：

```bash
npm run leads:maps-scrape -- \
  --query "restaurants in West End Brisbane" \
  --niche restaurant \
  --city Brisbane
```

默认策略：

- 不调用 Google Places API。
- 不开启 email extraction。
- 不开启 `-extra-reviews`。
- 不保留 review 正文或 email payload。
- 上游 scraper 默认带出的少量 `user_reviews` 会在 ProfitsLocal CLI 分析落盘前剥离。

每次 run 输出：

- `results.maps.json`：已剥离 review/email payload 的 JSONL。
- `discovery-run.json`：可审计的分析结果、cost policy、queue。
- `queue.json`：按 starter / audit / manual / skip 分桶。
- `leads.compact.json`：用于人工快速浏览。
- `tool-log.jsonl`：工具轨迹和成本策略。
- `data/leads/discovery-index.json`：全局去重后的 scraped lead index。
- `data/leads/entities/<entity-key>.json`：单个 scraped lead 的长期记录和 run history。
- `data/leads/discovery-events.jsonl`：所有 discovery/store/status 事件。
- `data/leads/queues/queues.json`：cheap audit、selected enrichment、outreach brief 队列。
- `data/leads/reports/discovery-report.json`：闭环指标和 top candidates。

推荐动作：

| `recommendedAction` | 用途 |
|---|---|
| `starter_candidate` | Maps 显示无官网或只有社媒，且有电话/评分/评论量等信号。 |
| `audit_candidate` | 有官网但可能老旧，例如 `http` 站点或高分高评论但站点需审计。 |
| `manual_review` | 有潜力但证据不足，先人工看一眼。 |
| `skip` | 现阶段不推进。 |

raw scraped leads 会进入 `/admin/leads` 的研究中视图，client workflow promotion 仍必须显式执行：

```bash
npm run leads:maps-promote -- \
  --input data/maps-scraper/runs/<run-id>/discovery-run.json \
  --top 3 \
  --dry-run
```

如果候选已经在中央 discovery store 里完成 cheap audit / outreach brief，优先从 store promote：

```bash
npm run leads:promote-discovery-store -- --limit 3 --dry-run
npm run leads:promote-discovery-store -- --limit 3
```

store promote 会复制 discovery audit 和 discovery outreach brief，并运行本地 `lead-ops`，写入：

- `clients/<client>/lead/lead-intake.json`
- `clients/<client>/lead/lead-research.json`
- `clients/<client>/lead/redesign-check.json`
- `clients/<client>/lead/ready-to-build.json`
- `clients/<client>/lead/lead-ops.json`
- `clients/<client>/lead/discovery-log.jsonl`
- `clients/<client>/audit/current-site-*`
- `clients/<client>/outreach/discovery-outreach-brief.json`

二段 cheap audit：

```bash
npm run leads:audit-discovery-sites -- --limit 3
```

这个命令只使用已经入库的 `audit_candidate`，保存官网桌面/手机截图、HTML/text、JSON/Markdown audit 到 `data/leads/audits/<entity-key>/`，然后把目标推进到：

- `queued_for_enrichment`：有明确改版/offer 机会，再考虑 Tinyfish、Google Places API、email/contact 查找。
- `skipped`：现站足够好或突破口弱，不继续烧钱。

三段 selected enrichment 默认只出计划，不花钱：

```bash
npm run leads:plan-discovery-enrichment -- --limit 3
```

输出：

- `data/leads/queues/selected-enrichment-plan.json`
- 每个候选的 Tinyfish dry-run 命令。
- 每个候选的 Google Places dry-run 命令。
- spend guardrails：cheap audit 通过、operator 接受、仍不找 email。

触达角度可先生成 discovery-level draft：

```bash
npm run leads:build-discovery-outreach-briefs -- --limit 2
```

输出：

- `data/leads/outreach-briefs/<entity-key>/outreach-brief.json`
- entity 状态进入 `ready_for_outreach_brief`
- draft 明确标注：不是最终发送文案，不得引用 review 正文，不得假装 Google API 已核验。

真实 promote 后写入：

- `clients/<client>/lead/lead-intake.json`
- `clients/<client>/lead/discovery-log.jsonl`

后续工具进入条件：

- Tinyfish / site-audit：只对 `audit_candidate` 或人工挑出的高分 lead 跑。
- Google Places API：只对准备进入正式 evidence、build、outreach 的候选跑，用于官方核验，不用于批量 discovery。

---

## 2.1 Niche families（当前）

当前 family registry 已定义：

- `restaurant`
- `field_service`
- `clinic`
- `professional_service`
- `studio_or_visual`
- `venue`

其中 `field_service` 现在覆盖的典型 niche：

- roofers
- landscapers
- plumbers
- fence installers
- chimney repair
- HVAC

这一步先影响：

- `lead-intake`
- `lead-research`
- `build-ready`

也就是先影响：
- audience
- CTA
- default sections
- placeholder style
- redesign value logic

还没有意味着：

- 每个 family 都已经有独立 `content.<niche>.json` renderer
- 每个 family 都已经有 production-grade adapter

---

## 3. 三个 Gate

### Gate A: Reachable

先判断：

```text
这个 lead 能不能联系？
```

通过条件：至少有一种可信联系路径：

- email
- phone
- 官方 contact page / form
- social DM path
- WhatsApp / Instagram / LinkedIn 等可触达路径

如果完全不可联系：

- `blocked_unreachable`
- 不做 preview
- 不进 outreach build

这是最重要的 blocker。

### Gate B: Previewable

再判断：

```text
这个 lead 值不值得做 demo / preview？
```

最低要求：

- `businessName`
- `industry` 或明确的 `business scope`
- 至少一种联系方式
- 至少一个可讲的服务方向
- 至少一点可用于文案或视觉判断的背景线索

这一步不要求所有 business facts 都齐。

### Gate C: Mockup-ready / Production-ready

最后判断：

```text
这个项目能不能交给 Open Design 做 mockup？
这个项目离 production launch 还缺什么？
```

Mockup-ready 不要求所有资料齐全。它要求：

- 真实联系路径存在；
- business scope 足够明确；
- AI 能解释我们为什么能创造价值；
- 缺失内容可以用内部标记的 AI/demo copy 补齐。

Production-ready 才要求 source-of-truth 更完整、冲突更少、preservation 更清楚。

---

## 4. Build Modes

### `starter`

适合：

- 没有官网
- 或官网几乎等于没有
- 有足够公共资料做一个基础可信的 preview

目标：

- 做一个 starter preview
- 强调“从没有到有”的价值

### `redesign`

适合：

- 已有网站
- 但明显弱、旧、薄、结构差、转化弱

目标：

- 做一个能体现升级价值的 redesign preview

### `teaser`

适合：

- 信息不全
- 但仍然值得推进
- 想先做一个可联系、可展示的 demo 钩子

目标：

- 让对方看懂方向和价值
- 不把它当 production build

### `outreach-only`

适合：

- 信息太少
- 或暂时不值得 build
- 但仍值得联系

输出：

- diagnosis
- outreach angle
- cold message
- 竞争差距观察

不做页面。

---

## 5. Placeholder Policy

### 5.1 placeholder 不是空白占位

placeholder 不能是空内容。

它应该是：

- 完整的
- 可读的
- 页面结构上成立的
- 足够让 demo 看起来像一个完整网站

可以由 AI 生成：

- about 文案
- service summary
- CTA 说明
- gallery caption
- testimonial placeholder
- location/visit section placeholder
- FAQ placeholder

### 5.2 placeholder 的目的

placeholder 的目的不是伪造真实信息，而是：

- 保证 demo 的页面结构完整
- 让预览好看、顺畅、可理解
- 帮客户更容易想象成品

如果客户付费并继续推进，这些 placeholder 会由真实资料替换。

### 5.3 placeholder 可以覆盖哪些内容

允许 placeholder / dummy / inferred 内容的常见字段：

- `about` 段落
- 详细服务文案
- CTA 辅助文案
- testimonial placeholder
- gallery placeholder
- 地址 placeholder
- map placeholder
- years in business placeholder
- review snippet placeholder

### 5.4 placeholder 绝不能覆盖哪些内容

这些不能被“假装成真实事实”：

- 联系方式
  - email
  - phone
  - 官方 contact path
- 客户真实提供的 business facts
- 明确可验证却被替换掉的官方信息

如果没有任何联系方式，直接 `blocked_unreachable`。

当前代码层面的保护：

- `generated` evidence 可以进入 `placeholderCandidates`
- 但 `generated` evidence 里的 `contact.email / contact.phone / contact.website / contact.address / cta.map` 不能把 lead 解锁成 reachable
- 低信息压力测试固定覆盖这一点：
  - `npm run leads:test-lead-ops-low-info`
  - `data/qa/lead-ops-low-info/summary.json`

### 5.5 字段分层

`lead-research` 的输出必须区分：

- `verified`
- `inferred`
- `placeholderCandidates`
- `missingCritical`

这条分层必须进入所有后续模块。

---

## 6. Redesign Rule

`redesign-check` 不能只做 preservation，也要做 value assessment。

### 6.1 必须保住的内容

至少要抓到：

- 当前首页
- contact/about/service/menu/booking 等核心页
- CTA 路径
- business facts
- logo / imagery / tone clues
- route / sitemap intent

### 6.2 必须输出的 redesign 价值

要明确指出这次 redesign 改善什么：

- `clarity`
- `trust`
- `conversion`
- `mobile usability`
- `positioning`

### 6.3 redesign 的目标

不是“复制旧网站”，而是：

```text
保住核心要素，
同时把已有信息扩展成更有价值的版本，
让客户一眼看到 redesign 值得做。
```

---

## 7. Open Design Handoff Contract

Open Design 不应该直接吃一段模糊 prompt。

它应该收到一个结构化 handoff。

当前代码输出位置：

```text
clients/<client>/lead/ready-to-build.json
  aiConclusion
  scorecard
  websiteBuildHandoff
  openDesignHandoffDraft.prompt
```

`websiteBuildHandoff` 必须回答：

- AI 结论是什么，多少分，为什么；
- 网站是 `one_page` 还是 `simple_multi_page`；
- 页面/section 顺序是什么；
- demo copy 如何填满；
- SEO/conversion focus 是什么；
- contact form 如何接 Resend transactional email；
- 哪些是真实事实，哪些是 AI/demo placeholder；
- Open Design 可以直接用的 prompt 和 JSON payload。

### 第一版推荐结构

```json
{
  "project": {
    "clientSlug": "",
    "businessName": "",
    "industry": "",
    "city": "",
    "country": "",
    "sourceType": "",
    "buildMode": "starter | redesign | teaser | outreach-only"
  },
  "contactability": {
    "status": "reachable | unreachable",
    "channels": {
      "email": [],
      "phone": [],
      "contactPage": "",
      "socialDm": []
    }
  },
  "facts": {
    "verified": {},
    "inferred": {},
    "placeholderCandidates": {},
    "missingCritical": []
  },
  "strategy": {
    "problemType": "",
    "heroAngle": "",
    "primaryCTA": "",
    "audience": "",
    "tone": "",
    "coreServices": [],
    "coreSections": [],
    "designDirection": [],
    "avoid": []
  },
  "redesign": {
    "isRedesign": false,
    "preservationPacket": {},
    "redesignValue": [],
    "upgradeTargets": []
  },
  "outreach": {
    "diagnosis": "",
    "specificObservation": "",
    "competitorGap": "",
    "coldMessageAngle": ""
  },
  "evidence": {
    "sources": [],
    "confidence": "",
    "assets": []
  },
  "contentPolicy": {
    "allowPlaceholders": true,
    "mustNotInventContactFacts": true,
    "mustLabelDummyContentInternally": true
  }
}
```

### 当前新增 build handoff 结构

```json
{
  "aiConclusion": {
    "result": "ready_for_mockup | needs_human | skip",
    "score": 0,
    "confidence": "high | medium | low",
    "reason": "",
    "nextAction": ""
  },
  "scorecard": {
    "overall": 0,
    "contactability": 0,
    "opportunity": 0,
    "evidence": 0,
    "buildFeasibility": 0,
    "reasons": []
  },
  "websitePlan": {
    "type": "one_page | simple_multi_page",
    "pages": [],
    "sections": [],
    "contactForm": {
      "provider": "resend",
      "recipient": "hi@profitslocal.com"
    }
  },
  "content": {
    "hero": {},
    "services": [],
    "about": "",
    "trust": [],
    "faq": [],
    "blogIdeas": []
  },
  "openDesignPayload": {
    "prompt": "",
    "json": {}
  }
}
```

规则：

- `one_page` 也必须是完整网站：所有核心详情、服务说明、FAQ、SEO/conversion copy、trust、contact form 都要有。
- `simple_multi_page` 用于专业服务、诊所、venue 或 SEO 深度更重要的情况，默认包含 home/services/about/contact/blog seed。
- Contact form 默认使用现有 Resend transactional email 思路，operational context 是 `hi@profitslocal.com`。
- AI 可以补 service/about/FAQ/blog/SEO copy，但不能补假的联系方式、价格、证照、奖项、review quote、法律/医疗保证。

### 为什么这样设计

因为我们当前真实的 Open Design -> production handoff 重点是：

- business facts 仍然来自 source-of-truth artifacts
- Open Design 负责视觉方向、layout rhythm、tokens、page hierarchy
- redesign 要保留 source pages / URL intent

参考：

- `scripts/open-design/build-production-handoff.js`
- `docs/OPEN_DESIGN_PROJECT_SYNC.md`
- `docs/OPEN_DESIGN_HEADLESS_ORCHESTRATION.md`

---

## 8. 现阶段的技能职责

### `lead-intake`

职责：

- 统一来源
- 创建第一层 lead 记录
- 标注 sourceType、industry、known contactability

### `lead-research`

职责：

- 复用现有 evidence / content / preservation 产物做验证、补全、分层
- 输出 `verified/inferred/placeholderCandidates/missingCritical`
- 接收来自 Google Places、官网抓取、搜索文本、PDF、image OCR、manual、generated 的 evidence
- 允许 AI/dummy 补全页面结构，但不能把 generated 联系方式当作可触达事实

### `redesign-check`

职责：

- 判断是否值得 redesign
- 生成 preservation packet
- 生成 redesign value brief

### `build-ready`

职责：

- 做最终分流，并生成 `websiteBuildHandoff`：
  - `ready_for_mockup`
  - `needs_human`
  - `skip`
  - 同时保留旧的 `ready_for_preview / ready_for_redesign_preview / ready_for_teaser / blocked_unreachable` 兼容字段

### `outreach-brief`

职责：

- 生成 diagnosis
- 生成 site brief
- 生成 cold message
- 生成 follow-up
- 推荐 outreach channel

### `demo-video`

职责：

- 从 demo 页面或截图生成 9:16 outreach video
- 强调业务价值，不是只做炫技镜头

---

## 9. 低信息补全测试矩阵

新增固定测试：

```bash
npm run leads:test-lead-ops-low-info
```

它不调用 live API，而是用 deterministic fixture 模拟现有 extractor 的输出，确保明天或下周重复跑结果一致。

当前覆盖：

- Google Places-only dental lead：
  - `google_places` evidence
  - 有真实 phone / map / address
  - 应进入 reachable preview
- Official-site redesign roofer：
  - `official_site` evidence
  - 搜索文本 + pages fixture
  - 应生成 redesign preservation packet，并进入 redesign preview
- PDF + image OCR event venue：
  - `pdf` + `image_ocr` evidence
  - 应保持 reachable，并产生可用 preview/outreach brief
- Generated placeholder-only field service：
  - `generated` contact facts
  - 必须保持 `blocked_unreachable`
- Manual business-name-only lead：
  - 没有任何真实 contact path
  - 必须保持 `blocked_unreachable`

这组测试回答的核心问题是：

```text
少信息 lead 可以通过搜索、官网、PDF、图片 OCR 补到可推进；
但 AI/dummy 只能补页面完整度，不能伪造可触达性。
```

---

## 9. 测试与打磨规则

这些 skill 不能只靠 prompt 想象，必须持续测试。

至少要有这些 smoke cases：

- no website + reachable
- bad website + redesign candidate
- good website + skip/manual review
- manual low-info lead
- inbound lead
- paid lead
- reachable but low-info teaser
- unreachable lead

测试目标不是“所有字段都找齐”，而是验证：

- 决策有没有跑偏
- placeholder 是否让 demo 更完整
- verified / inferred / placeholder 是否边界清楚
- handoff 是否能顺利交给 Open Design / build

---

## 10. 当前建议执行顺序

先做文档和 contract，再做 skill：

1. `Lead Lifecycle + Source Types`
2. `Lead Research Contract`
3. `Open Design Handoff Contract`
4. `lead-intake`
5. `lead-research`
6. `redesign-check`
7. `build-ready`
8. `outreach-brief`
9. `demo-video`

这比直接堆 prompt 更稳。

---

## 11. 当前已落地的第一步

当前已经落地：

- `core/leads/intake.js`
- `scripts/leads/intake.js`
- `scripts/leads/test-intake.js`
- `core/leads/research.js`
- `scripts/leads/research.js`
- `scripts/leads/test-research.js`
- `core/leads/redesign-check.js`
- `scripts/leads/redesign-check.js`
- `scripts/leads/test-redesign-check.js`
- `core/leads/build-ready.js`
- `scripts/leads/build-ready.js`
- `scripts/leads/test-build-ready.js`
- `core/leads/outreach-brief.js`
- `scripts/leads/outreach-brief.js`
- `scripts/leads/test-outreach-brief.js`
- `core/leads/lead-ops.js`
- `scripts/leads/lead-ops.js`
- `scripts/leads/test-lead-ops.js`

命令：

```bash
npm run leads:intake -- --input /tmp/lead.json --output /tmp/lead-intake.json
npm run leads:test-intake
npm run leads:research -- --client <slug>
npm run leads:test-research
npm run leads:redesign-check -- --client <slug>
npm run leads:test-redesign-check
npm run leads:build-ready -- --client <slug>
npm run leads:test-build-ready
npm run leads:outreach-brief -- --client <slug>
npm run leads:test-outreach-brief
npm run leads:lead-ops -- --client <slug>
npm run leads:test-lead-ops
```

当前 `lead-intake` 已经具备：

- 统一 `sourceType`
- 统一 `buildMode`
- 统一 `gateStatus`
- placeholder 内容生成
- Open Design handoff draft
- 与现有 `qualification.js` 复用判断
- 与现有 `lead-registry` 接轨

这一步的目标不是完成全部 lead 系统，而是先把“所有来源进入系统时的第一层 contract”钉死。

当前 `lead-research` 已经具备：

- 读取 `lead-intake`
- 复用 `evidence/evidence.json`
- restaurant lead 可直接复用或现场生成 `content.restaurant.json`
- redesign lead 可复用或现场生成 preservation packet
- 产出：
  - `previewability`
  - `productionReadiness`
  - `facts.verified`
  - `facts.inferred`
  - `facts.placeholderCandidates`
  - `facts.missingCritical`
  - `openDesignHandoffDraft`

这一层的目标是把“信息搜集完以后，能不能继续 preview / outreach / Open Design”说成一套稳定 contract，而不是每次重新判断。

当前 `build-ready` 已经具备：

- 对 teaser / outreach-only / blocked lead 做轻量分流
- restaurant lead 直接复用现有 `website-ready` engine
- 在 research 已经补齐事实时，允许把早期 `teaser` 升级到 `ready_for_open_design`
- 输出统一状态：
  - `ready_for_open_design`
  - `ready_for_teaser`
  - `outreach_only`
  - `needs_more_research`
  - `blocked_unreachable`
  - `needs_customer_confirmation`
  - `blocked_conflicting_evidence`

这一层不是替代 `website-ready`，而是把 lead 前半段和现有 production handoff 正式接上。

当前 `redesign-check` 已经具备：

- 复用 `lead-research` 的结论，不重写 preservation
- 对 `field_service` 和 `professional_service` 输出明确的 redesign 价值点
- 把 preservation、upgrade targets、outreach angle 收成统一 contract
- 把 “值得做 redesign preview” 和 “已经 ready for Open Design” 这两层分开

这一步的目标不是直接发布 production packet，而是先把：

- 这个旧站值不值得改
- 应该保什么
- 新版的价值在哪里
- outreach 时该从什么角度讲

说成一份稳定输出。

当前 `outreach-brief` 已经具备：

- 复用 `lead-research` 和 `redesign-check`
- 输出稳定的：
  - `diagnosis`
  - `siteBrief`
  - `coldMessage`
  - `followUps`
  - `channelRecommendation`
  - `subjectLines`
  - `proofPoints`
- 根据 family 给出不同的 cold outreach 通道建议
- 支持从手工 lead 的 `instagramUrl` / `facebookUrl` / `linkedinUrl` / `whatsapp` 等字段识别可触达社媒通道
- 已经接入现有 `outreach-pack` / cold email artifact 流程
- `outreach-pack` 会优先吸收 brief 的：
  - `subjectLines`
  - `proofPoints`
  - `diagnosis`
  - `coldMessage`
- `send-cold-email` 会优先吸收 brief 的：
  - `subjectLines`
  - `coldMessage`
  - `proofPoints`

这一层先是 deterministic 的，目的是先把 contract 和验证站住，不是现在就引入更多生成复杂度。

当前 `outreach-brief` 也已经接入 lead truth source：

- `lead-registry` 会读取 `outreach-brief.json`
- `/admin/leads` 的下一步动作会优先使用：
  - `outreachChannelRecommendation`
  - `outreachPrimaryProofPoint`
  - `outreachDiagnosis`

### `lead-ops`

这是最小 orchestrator。

作用：

- 复用现有模块，不重写逻辑
- 顺序执行：
  - `lead-intake`
  - `lead-research`
  - `redesign-check`
  - `build-ready`
  - `outreach-brief`
- 一次性落盘各阶段 JSON，方便下游模块继续消费

默认落盘：

- `clients/<slug>/lead/lead-intake.json`
- `clients/<slug>/lead/lead-research.json`
- `clients/<slug>/lead/redesign-check.json`
- `clients/<slug>/lead/ready-to-build.json`
- `clients/<slug>/outreach/outreach-brief.json`
- `clients/<slug>/lead/lead-ops.json`
