# ProfitsLocal 核心业务闭环 TODO 台账

更新日期：2026-05-10

这份文档是 **当前进行中的唯一 TODO 台账**。  
以后我们验证核心业务闭环、发现文档过期、发现 admin 缺口、发现运营流程断点，都先记到这里，再按优先级逐个清。

---

## 使用规则

- 状态只用 4 种：
  - `DONE`
  - `IN PROGRESS`
  - `PENDING`
  - `BACKLOG`
- 只有拿到 **hard evidence** 才能从 `IN PROGRESS/PENDING` 改成 `DONE`
- 如果执行中发现 SOP 或其他文档过期，不要只在聊天里提，要把对应文档路径记到本页的 `文档审计` 区块
- 如果某个需求现在不阻塞核心闭环，但后面一定要做，就先记到 `BACKLOG`

---

## 当前执行面板

### 2026-05-10 handoff sync

- 当前 repo：`https://github.com/matthew6688/webjuice-stack-mvp`
- 线上 handoff：`https://github.com/matthew6688/webjuice-stack-mvp/blob/main/docs/HANDOFF_2026-05-10.md`
- 最新 handoff commit：`ab941d2 Add handoff repository links`
- 本页是下一棒接手人的 priority board。若本页和 dated handoff 冲突，以本页的 `NOW / IN PROGRESS / PENDING` 为准，再把 dated handoff 补齐。
- 5/10 交接后的核心判断：系统已经能从 low-cost discovery 进入 admin/queue/lead packet，但收入闭环仍卡在真实 mockup artifact、触达发送/回复回流、paid handoff 操作面三段。

### NOW

- `G4.1` 真实 mockup artifact：把 `build_mockup_artifacts` 的 placeholder preview / screenshot / video 替换成真实 Open Design 或 template runner 输出。
- `G4.2` outreach 状态闭环：`draft_ready -> outreach_sent -> follow_up_due / replied` 阶段迁移测试和后台 action。
- `G5` replied / paid handoff：把回复或人工成交意向推进到 paid intake / project handoff，不再靠复制粘贴上下文。
- `G3.1` Leads CRM 证据视图：继续补 replied / follow-up / paid handoff 操作面。

### DONE

- `A1` fresh 项目从 0 到 dev preview
- `A2` fresh 项目从 review 到 live + domain
- `A3` 真实 revision 闭环
- `D2.1` Agentic Inbox 作为第一类 cold outreach provider 接入
- `G5.1` 真实 query 批量 discovery regression：restaurant / roofing / dentist 三组低成本 scrape 已入库并保存 hard evidence
- `G1` low-cost Google Maps scrape -> discovery store -> lead pipeline 第一轮稳定化：scrape/import、central store、dedupe、queue、admin visibility、relevance gate、hard evidence 已落地
- `G2` cheap audit -> selected enrichment 成本门控第一版：cheap audit、selected-enrichment dry-run plan、gate 状态源、admin/action 入口已落地
- `G3` outreach-ready lead packet 第一版：lead ops、ready-to-build、outreach brief、CRM snapshot、admin leads/queue 读取已落地
- fresh lead 从 outreach 到 paid 真闭环

### IN PROGRESS

- `G2.1` selected enrichment 成本关口：dry-run plan / approved / executed / ingested 状态源已落地，继续接真实执行和入库
- `B4` Open Design pipeline 状态映射到我们的项目状态
- `C2` 售前 lead / outreach / forum 流转继续补齐
- `C3` lead truth source / lead profile schema（Phase 1 已落地，后续字段与自动回流继续补）
- `D2.2` Agentic Inbox 自动 provider event 回流上线验证
- `C4` lead-intake / lead-research / redesign-check / build-ready / outreach-brief / lead-ops contract 设计与 smoke 打磨（intake + research + redesign-check + build-ready + outreach-brief + lead-ops 已落地；outreach-brief 已接到 outreach-pack / cold email artifact；已接到 lead-registry truth source；field_service / professional_service redesign smoke 已过；低信息 Google Places / 官网 scrape / PDF / image OCR / generated-only fixtures 已加入压力测试；后续继续补多 niche renderer/contract） 
- `C5` niche template library / template-lab（roofing starter families 已开始；后续把截图/链接 ingest、template match、Open Design prompt、QA report 接进 Discord lead-ops）

### PENDING

- `/admin/leads` replied / follow-up due / paid handoff 再细化
- 长期 generated evidence 存储策略：决定哪些 `data/qa`、`data/template-experiments`、Open Design run logs 留在 git，哪些迁到外部 artifact storage

### BACKLOG

- `opened / clicked / unsubscribed / spam complaint`
- Instantly / Smartlead live integration
- Open Design pipeline 视觉借鉴到 admin / task 分类
- Template library admin inventory：在 admin 里查看 niche、template family、截图、QA 分、适用 lead 类型

---

# G. 当前核心业务增长任务包

这个任务包围绕当前最重要的业务闭环：

```text
低成本找本地商家
-> 入库去重
-> 便宜审计
-> 只对高潜力目标补资料
-> 生成可行动 lead packet
-> 人工决定 mockup / skip / follow-up
-> Open Design / preview
-> outreach
-> reply
-> paid intake
-> 项目交付
```

原则：

- 先省钱，默认不抓 review 正文、不跑 Google Places API、不跑 email extraction。
- 只有 cheap audit 证明有销售突破口，才进入 Tinyfish / Google Places / contact enrichment。
- 每一步都必须写入 lead truth source 或 discovery store，admin 里能看见。
- 每个任务完成都要有 hard evidence：命令、输出文件、截图、admin 命中、测试结果。

## G1. Scrape discovery 到 lead pipeline 稳定化

- 状态：`IN PROGRESS`
- 目标：
  - 把 `gosom/google-maps-scraper` 的低成本采集结果稳定进入：
    - `data/maps-scraper/runs/<run-id>/`
    - `data/leads/discovery-index.json`
    - `data/leads/entities/<entity-key>.json`
    - `/admin/leads`
- 为什么重要：
  - 这是我们规模化找 local business 的最低成本入口。
  - 先有稳定入库和去重，后面才谈 enrichment、mockup、outreach。
- 范围：
  - 不抓 review 正文。
  - 不做 email extraction。
  - 不调用 Google Places API。
  - 只保存可审计的 lightweight profile、source URL、place/category/location、website/phone/rating/count 等基础字段。
- 完成标准：
  - 同一个 query 连跑 3 次，不产生重复 lead。
  - 新 discovery run 出现在 admin leads 的研究/发现视图。
  - 每个 lead 的 tool log / cost policy 可追踪。
  - scrape result、compact list、queue、global store 都能互相对上。
- hard evidence：
  - `data/maps-scraper/runs/<run-id>/discovery-run.json`
  - `data/maps-scraper/runs/<run-id>/tool-log.jsonl`
  - `data/leads/discovery-index.json`
  - `/admin/leads` screenshot
  - 重复运行对比 summary
- 当前证据：
  - `data/maps-scraper/runs/20260509-g1-roof-new-farm-a/discovery-run.json`
  - `data/maps-scraper/runs/20260509-g1-roof-new-farm-b/discovery-run.json`
  - `data/maps-scraper/runs/20260509-g1-roof-new-farm-b-reanalyzed/discovery-run.json`
  - `data/qa/g1-discovery-flow-2026-05-09/repeat-run-comparison.json`
  - `data/qa/g1-discovery-flow-2026-05-09/g1-hard-evidence-summary.json`
- 当前结论：
  - 同一个 query 两次真实 scrape 分别返回 21 / 22 条，Google Maps 结果有轻微漂移。
  - 两次结果重叠 20 条，重叠实体由 discovery store upsert，不重复创建 client workflow。
  - 当前策略没有使用 Google Places API、email extraction 或 review body storage。
  - 已补 `relevance` gate：例如 `Hurricane Digital - SEO Brisbane` 这种 query 漂移进来的 internet marketing service，会因 `category_name_mismatch` 直接 `skip`，不进入 audit/enrichment 队列。
  - 当前 store：41 entities，1 个 cheap audit 候选，0 个 selected enrichment 候选，12 个 outreach brief 队列项。
- 验证命令：
  ```bash
  npm run leads:maps-scrape -- --query "<niche> in <city>" --niche <niche> --city <city>
  npm run funnel:test-lead-registry
  npm run funnel:test-lead-outreach-index
  ```

## G2. Cheap audit -> selected enrichment 阀门

- 状态：`IN PROGRESS`
- 目标：
  - 对有官网的 scrape targets 先跑 cheap audit。
  - 只有 audit 发现明确 sales angle，才进入 selected enrichment。
- 为什么重要：
  - 避免大规模烧 Google Places API、Tinyfish、email/contact finder 成本。
  - 我们卖的是“更能转化的网站”，不是“所有商家都做一遍 mockup”。
- 范围：
  - audit 保存 desktop/mobile 截图、HTML/text、JSON/Markdown report。
  - audit 输出 `salesDecision`：
    - `build_mockup`
    - `human_review`
    - `skip_or_monitor`
  - selected enrichment 先 dry-run 出计划，再人工确认花钱。
- 完成标准：
  - `audit_candidate` 能自动变成 `queued_for_enrichment` 或 `skipped`。
  - `skip_or_monitor` 的对象不会进入 mockup 队列。
  - enrichment plan 明确每个候选为什么值得花钱。
- hard evidence：
  - `data/leads/audits/<entity-key>/current-site-audit.json`
  - `data/leads/audits/<entity-key>/current-site-desktop.png`
  - `data/leads/queues/selected-enrichment-plan.json`
  - admin lead card 上可见 audit evidence
- 当前证据：
  - 候选：`FIX MY ROOF Total Roof Restorations`
  - entity：`place_chijn587yc79k2sr7vyvy-egoam`
  - audit JSON：`data/leads/audits/place_chijn587yc79k2sr7vyvy-egoam/current-site-audit.json`
  - audit MD：`data/leads/audits/place_chijn587yc79k2sr7vyvy-egoam/current-site-audit.md`
  - desktop screenshot：`data/leads/audits/place_chijn587yc79k2sr7vyvy-egoam/current-site-desktop.png`
  - mobile screenshot：`data/leads/audits/place_chijn587yc79k2sr7vyvy-egoam/current-site-mobile.png`
  - enrichment plan：`data/leads/queues/selected-enrichment-plan.json`
- 当前结论：
  - cheap audit score：35
  - verdict：`clear_redesign_opportunity`
  - salesDecision：`build_mockup`
  - nextStatus：`queued_for_enrichment`
  - selected enrichment plan 已生成，`live=false`，Tinyfish / Google Places command 仍是 dry-run，未花钱。
  - audit keyword 生成已修正为 `Roofing contractor Brisbane`，避免重复的 `roofing Roofing contractor` 文案流入 outreach / Open Design。
  - selected enrichment 成本关口已新增统一状态源：`data/leads/queues/selected-enrichment-gates.json`。
  - dry-run plan 会显示 `costGate.status`，后台 action 可先记录 `approved`，不直接调用 Tinyfish / Google Places。
- 验证命令：
  ```bash
  npm run leads:audit-discovery-sites -- --limit 3
  npm run leads:plan-discovery-enrichment -- --limit 3
  npm run leads:update-enrichment-gate -- --entity-key <entity-key> --status approved
  npm run leads:test-discovery-second-stage
  npm run leads:test-lead-ops-audit
  ```

## G1.1. 真实 query 批量 discovery regression

- 状态：`DONE`
- 目标：
  - 用多个真实 query 验证 low-cost scrape -> discovery store -> queue 的稳定性。
- 为什么重要：
  - 单个 query 可能偶然正常；我们需要不同 niche 都能低成本入库、去重、分流。
- 本次范围：
  - 不使用 proxy。
  - 不调用 Google Places API。
  - 不做 email extraction。
  - 不保存 review body。
  - Docker 镜像仍提示 amd64 on arm64，但本地 Mac mini 可正常运行。
- hard evidence：
  - `data/qa/g5-discovery-regression-2026-05-09/summary.json`
  - `data/qa/g5-discovery-regression-2026-05-09/summary.md`
  - `data/maps-scraper/runs/20260509-g5-restaurant-paddington/discovery-run.json`
  - `data/maps-scraper/runs/20260509-g5-roof-brisbane/discovery-run.json`
  - `data/maps-scraper/runs/20260509-g5-dentist-new-farm/discovery-run.json`
- 当前结果：
  - 3 runs
  - 52 raw rows / 52 leads
  - 50 with website
  - 51 with phone
  - action counts：8 audit_candidate、2 starter_candidate、16 manual_review、26 skip
  - discovery store unique entities：82
- 验证命令：
  ```bash
  npm run leads:maps-scrape -- --query "restaurants in Paddington Brisbane" --niche restaurant --city Brisbane --run-id 20260509-g5-restaurant-paddington --depth 1 --exit-on-inactivity 90s
  npm run leads:maps-scrape -- --query "roof restoration in Brisbane" --niche roofing --city Brisbane --run-id 20260509-g5-roof-brisbane --depth 1 --exit-on-inactivity 90s
  npm run leads:maps-scrape -- --query "dentists in New Farm Brisbane" --niche dentist --city Brisbane --run-id 20260509-g5-dentist-new-farm --depth 1 --exit-on-inactivity 90s
  ```

## G3. Lead packet 和行动队列闭环

- 状态：`NOW`
- 目标：
  - 把高潜力 lead 生成 operator 可直接判断的 packet：
    - verified facts
    - contact path
    - audit evidence
    - redesign angle
    - outreach brief
    - recommended next action
  - 同步到 `/admin/leads` 和 `/admin/queue`。
- 为什么重要：
  - 我们不缺数据，缺的是“现在该处理谁、为什么、下一步点什么”。
- 范围：
  - `lead-ops` 继续作为统一总控。
  - `ready-to-build.json` 是 Open Design 前的主交接文件。
  - `outreach-brief.json` 是触达前的主交接文件。
- 完成标准：
  - promote 后每个 client 都有完整 lead artifacts。
  - admin card detail 能看到证据、联系方式、AI 结论、工具轨迹。
  - queue 能把 `needs_human`、`ready_for_mockup`、`follow_up_due`、`replied` 明确分组。
  - lead card detail 有 CRM 快照：阶段、下一步、负责人动作、联系路径、来源、成本关口、证明资产、触达草稿。
- hard evidence：
  - `clients/<client>/lead/lead-ops.json`
  - `clients/<client>/lead/ready-to-build.json`
  - `clients/<client>/outreach/outreach-brief.json`
  - `/admin/leads` screenshot
  - `/admin/queue` screenshot
  - Playwright smoke：`CRM 快照` 可见，mobile overflow = 0。
- 验证命令：
  ```bash
  npm run leads:promote-discovery-store -- --limit 3 --dry-run
  npm run leads:promote-discovery-store -- --limit 3
  npm run leads:test-lead-ops
  npm run leads:test-lead-ops-scenarios
  npm run leads:test-lead-ops-low-info
  ```

## G4. Mockup / Open Design handoff 阀门

- 状态：`NOW`
- 目标：
  - 只有满足以下条件的 lead 才进入 mockup / Open Design：
    - contactable
    - audit 或 no-website 机会明确
    - `ready-to-build.json` 有完整 websiteBuildHandoff
    - `openDesignHandoffDraft.prompt` 足够完整
- 为什么重要：
  - Open Design 和 mockup 是时间成本，不应该给低概率目标乱跑。
- 范围：
  - 不为 `skip_or_monitor` 自动生成 mockup。
  - `needs_human` 必须有 operator 按钮决定。
  - 可先支持 roofing/restaurant 两个高价值路径。
- 完成标准：
  - admin 里能从 lead card 看到 “创建 Mockup / 跳过 / 再研究” 的决策结果。
  - Open Design handoff 能从 `ready-to-build.json` 直接生成，不需要重新问小问题。
  - 生成的 mockup / template match 能回写 lead history。
  - `build_mockup_artifacts` 产出的 placeholder preview / screenshot / video 被真实 Open Design 或 template runner 产物替换。
  - `mockup_ready` 后能自动生成 cold outreach draft，但不自动发送。
- hard evidence：
  - `clients/<client>/lead/ready-to-build.json`
  - `clients/<client>/lead/discovery-log.jsonl`
  - Open Design prompt / run summary
  - admin lead note / decision log
  - `clients/<client>/concept/open-design/mockup-artifacts.json`
  - `clients/<client>/outreach/outreach-pack.json`
  - `clients/<client>/outreach/email/01-<client>.json`
- 验证命令：
  ```bash
  npm run leads:build-ready -- --client <client>
  npm run leads:outreach-brief -- --client <client>
  npm run funnel:test-lead-note
  npm run leads:test-discovery-to-mockup-stage
  ```

### G4.1. 真实样稿产物替换 placeholder

- 状态：`PENDING`
- 目标：
  - 把当前 `build_mockup_artifacts` 里的 placeholder preview / screenshot / video，替换成真实 Open Design 或 template runner 产物。
- 为什么重要：
  - 当前 pipeline 已经能走到 `mockup_ready` 和 `draft_ready`，但客户可见质量还必须由真实样稿承担。
- 范围：
  - 优先支持 restaurant / roofing 两条路径。
  - 先 template match，再 Open Design run；有成熟模板时不要每个 lead 从零跑。
  - 产物必须回写：
    - `clients/<client>/concept/open-design/mockup-artifacts.json`
    - `clients/<client>/outreach/outreach-pack.json`
    - `public/admin-artifacts/<client>/mockup-preview.html`
    - desktop/mobile screenshot
    - demo video 或可替代的 proof artifact
- 完成标准：
  - `mockup_building -> mockup_ready` 不再依赖 placeholder。
  - Queue / Leads 能显示真实 preview、截图、证明素材和 Open Design/template run evidence。
  - 如果 Open Design 失败，lead 留在 `mockup_building` 并显示失败原因，不假装 ready。
- hard evidence：
  - Open Design/template run status
  - preview HTML / URL
  - desktop/mobile screenshots
  - `mockup-artifacts.json`
  - Playwright screenshot check
  - `npm run leads:test-discovery-to-mockup-stage`

### G4.2. 触达发送与回复回流

- 状态：`PENDING`
- 目标：
  - 把 `draft_ready` 后面的人工发送 / provider 发送 / 回复回流做成可验证闭环。
- 为什么重要：
  - 线索系统真正产生收入，要靠发出、回复、推进成交，而不是停在草稿。
- 范围：
  - 默认不自动 live-send。
  - 先支持人工确认后写 `outreach_sent`，再接 Agentic Inbox provider event。
  - 记录 opened / clicked / unsubscribed / bounced 先放 backlog，不阻塞第一版。
- 完成标准：
  - `draft_ready -> outreach_sent` 有后台 action 和 lead note。
  - `outreach_sent -> follow_up_due` 能根据 next follow-up 时间进入 Queue。
  - `replied -> paid_handoff` 有明确人工按钮和 handoff payload。
- hard evidence：
  - `clients/<client>/outreach/email/01-<client>.json`
  - `clients/<client>/outreach/lead-notes.jsonl`
  - provider/manual send result artifact
  - `npm run funnel:test-lead-outreach-sent`
  - `npm run funnel:test-lead-to-paid-handoff`

## G5. Reply / paid handoff 最短路径

- 状态：`NOW`
- 目标：
  - 当 lead 回复或人工标记成交意向时，后台能把它推进到 paid intake / project handoff，不需要在聊天里重新拼资料。
- 为什么重要：
  - 找 lead 和做 mockup 只有接到钱才闭环。
  - 这个节点不能靠人工复制粘贴丢上下文。
- 范围：
  - `/admin/leads` 的 replied / paid handoff 状态继续细化。
  - paid handoff 要携带：
    - lead facts
    - contact path
    - outreach brief
    - mockup / preview link
    - proposed offer
    - next customer action
- 完成标准：
  - `进入成交交接` 能写入 lead note。
  - `lead-to-paid-handoff` 生成可用于 paid intake / Discord project thread 的 payload。
  - `/admin/queue` 能显示 paid handoff 的待处理项。
- hard evidence：
  - `clients/<client>/outreach/lead-notes.jsonl`
  - `data/qa/lead-closure-smoke/lead-to-paid-handoff.json`
  - `/admin/queue` paid handoff screenshot
- 验证命令：
  ```bash
  npm run funnel:test-lead-to-paid-handoff
  npm run funnel:test-lead-outreach-sent
  npm run funnel:test-lead-outreach-index
  ```

---

## 当前总目标

把 ProfitsLocal 的网站业务收成一个稳定闭环：

```text
lead / intake
-> collect / website-ready
-> Open Design concept
-> production handoff
-> repo dev preview
-> QA
-> outreach/demo
-> paid
-> review
-> revision / approval
-> live
-> domain
-> memory / ROI / admin tracking
```

当前主线仍然是：

- **restaurant 为第一个核心 niche**
- `roofing` 作为第二个参考 niche

---

# A. 核心闭环主任务

## A1. 新 fresh 项目从 0 到 dev preview 再完整跑一条

- 状态：`DONE`
- 目标：
  - 用一个全新的 restaurant 项目，再跑一次：
  - `collect -> website-ready -> Open Design -> remote repo bootstrap -> dev preview -> QA -> review package`
- 为什么重要：
  - 这是“新项目生产线”是否真的稳定的最后验证之一
- 完成标准：
  - case 建好
  - Open Design project 建好
  - customer repo / Pages dev preview 正常
  - QA 报告存在
  - review package 可发
- hard evidence：
  - case path
  - repo / workflow run
  - preview URL
  - QA result
  - review package
- 已完成样本：
  - `dark-shepherd-restaurant`
- 关键证据：
  - `data/qa/fresh-remote-dark-shepherd/summary.json`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/ops-checklist.md`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/website-handoff.md`

## A2. 付款后到 live 上线，再完整跑一条 fresh 项目

- 状态：`DONE`
- 目标：
  - 用 fresh 项目验证：
  - `review -> approval -> publish live -> domain onboarding`
- 为什么重要：
  - 这是客户真正付费后的核心兑现链
- 完成标准：
  - approval 映射到同一个 case/workspace
  - live publish 成功
  - live email 发出
  - domain 页面/邮件/Discord 逻辑一致
- hard evidence：
  - GitHub Actions run
  - live URL
  - Resend id
  - case timeline
  - domain request/status 文件
- 已完成样本：
  - `dark-shepherd-restaurant`
- 关键证据：
  - `data/qa/fresh-dark-shepherd-live/approval-live-domain-summary.json`
  - `data/qa/fresh-dark-shepherd-live/approval-workflow-rerun-2.json`
  - `data/qa/fresh-dark-shepherd-live/domain-request.json`
  - `data/qa/fresh-dark-shepherd-live/domain-status-active.json`
  - live URL: `https://dark-shepherd-restaurant-live.pages.dev/`
  - custom domain: `https://dark-shepherd-fresh.profitslocal.com/`

## A3. 真实 revision 闭环再跑一条

- 状态：`DONE`
- 目标：
  - 用真项目验证：
  - `customer revision -> same forum workspace -> Open Design/repo update -> new preview -> review -> approval`
- 为什么重要：
  - 售后闭环决定我们能不能持续接单，而不是只会做第一版
- 完成标准：
  - revision 消耗次数正确
  - 回到同一个 case 和同一个 Discord/forum workspace
  - 继续修改后 preview 可更新
  - 后续 approval 仍能正常 live
- hard evidence：
  - revision request evidence
  - workspace reuse evidence
  - QA/review evidence
  - publish evidence
- 已完成样本：
  - `dark-shepherd-restaurant`
- 关键证据：
  - `data/qa/fresh-dark-shepherd-live/revision-local-review-ready.json`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/artifacts/revision-2026-05-08-desktop.png`
  - `data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/artifacts/revision-2026-05-08-mobile.png`
  - dev deploy run: `25528503496`
  - review email id: `2a7027d2-d272-427d-b20c-5188bb99f727`
  - forum workspace: `[Revision 1/3] Dark Shepherd`

---

# B. Open Design 主线

## B1. Open Design 升级后真实项目链验证

- 状态：`DONE`
- 已验证：
  - 升级后的 Open Design fork 没打断真实项目链
  - `dark-shepherd-restaurant` 的 continuation -> handoff -> port -> build -> QA 已通过
- 证据：
  - `data/qa/open-design/dark-shepherd-upgrade-chain-summary.json`
  - `data/qa/open-design/dark-shepherd-upgrade-chain-qa.json`
  - `data/qa/open-design/dark-shepherd-upgrade-delivery-qa.json`

## B2. Open Design / Discord / repo 双向切换

- 状态：`DONE`
- 已验证：
  - 同一个 `projectId`
  - Open Design app/source 改动可 sync 回来
  - Discord continuation 改动也可 sync 回来
  - 最后 repo 继续 build 成功
- 证据：
  - `data/qa/open-design/dark-shepherd-app-sync-summary.json`
  - `data/qa/open-design/dark-shepherd-switch-cycle-summary.json`
  - `data/qa/open-design/dark-shepherd-discord-sync-qa.json`

## B3. 固定真实餐厅 redesign smoke

- 状态：`DONE`
- 当前固定样本：
  - `Rich & Rare`
- 当前稳定策略：
  - 先 seed 官方 source 页面
  - 再让 Open Design 只做 design
  - 强制要求 `index.html + brand-spec.md + source/* + assets`
- 证据：
  - `data/qa/open-design/rich-and-rare-longterm-smoke-v4-summary.json`

## B4. Open Design pipeline 状态映射到我们的项目状态

- 状态：`PENDING`
- 目标：
  - 把 Open Design 的：
    - `Not started`
    - `Running`
    - `Needs input`
    - `Succeeded`
    - `Failed`
  - 映射成我们自己的：
    - `ready-to-build`
    - `in-design`
    - `needs-human-input`
    - `ready-for-port`
    - `blocked`
- 为什么重要：
  - 这样 admin / Discord / Open Design 的状态语言就统一了
- 是否需要显示到 admin：
  - **需要**
  - 建议显示在项目详情页和列表 health pills

## B5. Open Design 运行分型继续标准化

- 状态：`IN PROGRESS`
- 当前已知：
  - `native clean finish`
  - `artifact_quiet_fallback`
  - `false positive fallback` 已修
  - `stale artifacts` 已修
  - `source/*.html` 误判已修
- 剩余工作：
  - 把 operator 一眼可读的 run 分类继续整理到 admin / docs / evidence 输出
- 是否需要显示到 admin：
  - **需要**
  - 至少要显示：
    - last run status
    - completion mode
    - run id
    - last updated

---

# C. Discord / workspace / 项目记忆

## C1. forum workspace 自动流转

- 状态：`DONE`
- 已完成：
  - `website-leads` forum
  - `website-projects` forum
  - 标题/tag 自动更新
  - route/domain workflow 远端验证
- 证据：
  - `data/qa/discord-forum-smoke/*`

## C2. 售前 lead -> paid 的 forum 流转继续补齐

- 状态：`IN PROGRESS`
- 目标：
  - `qualified`
  - `demo-ready`
  - `outreach-sent`
  - `replied`
  - `paid`
- 当前已完成：
  - `website-leads` / `website-projects` forum 已接通
  - admin 已新增 `/admin/leads`
  - fresh lead 可在 checkout 缺少 `client_slug` 时，仅靠 unique lead email 回到同一个 lead/client 轨道
  - fresh lead 的 `sale` 事件已经能同时创建：
    - `website-leads` workspace
    - `website-projects` workspace
    - paid lead truth source 记录
  - 目前可以从真实数据看到：
    - `demo ready`
    - `draft ready`
    - `outreach sent`（当 live send 已回写到 email artifact）
    - `replied`（当 provider metadata / webhook event 已写回 artifact）
    - `bounced`（当 provider metadata / webhook event 已写回 artifact）
    - `follow-up due`（当 lead note 或 provider metadata 记录了下一次跟进时间）
    - `paid`
    - `missing assets`
    - `missing outreach draft`
- 还缺：
  - external cold email platform live webhook ingest
  - Agentic Inbox live UI 自己触发 event 的最终证据
- 为什么重要：
  - 这决定后面大量项目时 Discord 是否仍然清晰可管
- 是否需要显示到 admin：
  - **需要**
- 最新 hard evidence：
  - `data/qa/lead-closure-smoke/lead-to-paid-handoff.json`

## C3. Lead truth source / lead profile schema

- 状态：`IN PROGRESS`
- 目标：
  - 从“由 outreach artifact 反推状态”逐步演进成明确的 lead truth source
  - 先做 MVP core fields，再按阶段补强
- 主文档：
  - `docs/LEAD_PROFILE_SCHEMA.md`
- Phase 1 先做：
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
  - `hasWebsite`
  - `menuUrl`
  - `evidenceSources[]`
  - `qualificationStatus`
  - `outreachStatus`
  - `replyStatus`
  - `followUpDue`
  - `notes[]`
  - `provider`
  - `externalThreadUrl`
- 当前已完成：
  - `core/funnel/lead-registry.js` 已作为 Phase 1 lead truth source 落地
  - `/admin/leads` 已从独立 lead truth source 读取，不再只在页面层拼接状态
  - 已支持 `resolveLeadByEmail()`：
    - 唯一邮箱 -> 唯一匹配
    - 重复邮箱 -> 返回 `ambiguous_email`
- 为什么重要：
  - 决定 reply matching、follow-up、paid handoff 能不能围绕同一个 lead 继续推进
- 是否需要显示到 admin：
  - **需要**
  - 先落 `/admin/leads`
  - 最终要在 admin 里有专门的 cold outreach / leads 面板

## C3. 项目 milestone 是否需要进 admin

- 状态：`IN PROGRESS`
- 结论：
  - **需要**
- 建议 milestone：
  - `lead_collected`
  - `website_ready`
  - `open_design_started`
  - `open_design_succeeded`
  - `ported_to_repo_dev`
  - `dev_preview_ready`
  - `delivery_qa_passed`
  - `review_sent`
  - `revision_requested`
  - `approved_for_publish`
  - `live`
  - `domain_waiting_customer`
  - `domain_connected`
- admin 建议显示位置：
  - `/admin/intakes`
  - `/admin/intakes/<client>/<order>`
  - `/admin/queue`
- 当前已完成：
  - `/admin/intakes`
    - 已显示当前 milestone 文案
    - 已显示完成进度 `x / 13`
  - `/admin/intakes/<client>/<order>`
    - 已显示 milestone timeline
    - 已显示当前 milestone
  - `/admin/queue`
    - 已增加 milestone 聚合统计
- 当前边界：
  - milestone 还主要根据 repo/case/artifact/timeline 推导
  - 还没有和 Open Design pipeline 原生状态完全对齐
  - 还没有进入 `/admin/leads`

---

# D. Email 体系

## D1. Transactional email（Resend）

- 状态：`DONE`（主方向已明确）
- 规则：
  - 所有 transactional / workflow email 继续走 **Resend**
  - 包括：
    - payment receipt
    - review ready
    - revision receipt
    - approval/live
    - domain status
- HTML 模板：
  - 继续使用品牌化 HTML
  - 这是给 Resend transactional email 用的

## D2. Cold outreach email 体系

- 状态：`IN PROGRESS`
- 当前判断：
  - cold outreach 不需要花哨 HTML
  - **以 plain text / 简洁文本为主更合适**
  - 后期规模化可接：
    - Gmail sender
    - Agentic email inbox
    - Instantly / Smartlead 等
- 当前建议：
  - cold outreach 的核心是：
    - evidence / demo / preview / CTA
    - 不需要 transactional 那一套花哨模板
 - 当前已完成：
   - `/admin/leads` 已能显示 provider-agnostic 的 send/reply/bounce 骨架
   - `clients/<client>/outreach/email/*.json` 已开始支持：
     - `provider`
     - `sourceSystem`
     - `externalCampaignId`
     - `externalLeadId`
     - `externalMessageId`
     - `externalThreadUrl`
     - `providerEvent`（原始 webhook payload）
 - 还缺：
   - Instantly live integration
   - Smartlead live integration
   - 统一 webhook ingest 入口
   - `next follow-up due` 的真实来源

## D3. Agentic email 如何接业务流程

- 状态：`PENDING`
- 当前原则：
  - Resend = transactional sender
  - Agentic email / Agentic Inbox = conversational inbox / draft / later cold outreach support
- 后续要做：
  - 明确 inbound email 怎么映射回 case / workspace
  - 明确 cold outreach reply 怎么落回 admin / case / Discord/forum
- 是否需要显示到 admin：
  - **需要**
  - 后面应该有：
    - outreach sent
    - replied
    - bounced
    - follow-up due

---

# E. Admin 面板

## E1. 当前 admin 已有

- 状态：`DONE`
- 已有页面：
  - `/admin`
  - `/admin/settings`
  - `/admin/intakes`
  - `/admin/intakes/<client>/<order>`
  - `/admin/finance`
  - `/admin/queue`

## E1.1 Settings 页面

- 状态：`DONE`
- 目标：
  - 把第三方依赖、关键 channel/id、重要运行参数收口到一个系统页面
- 当前已完成：
  - 新增：
    - `/admin/settings`
  - 当前覆盖：
    - Core ops
    - Open Design
    - Transactional email
    - Cold outreach providers
    - Checkout & billing
    - Media & uploads
    - Research & scrape
    - Domain & deploy
    - Local AI audit
- 页面规则：
  - secret 只显示脱敏值
  - 项目状态不混到这里
  - 只回答“系统有没有配好、缺什么、会影响哪段业务”

## E2. Cold outreach admin 面板

- 状态：`IN PROGRESS`
- 目标：
  - 增加一个 leads / outreach 运营页
- 当前已完成：
  - 已新增：
    - `/admin/leads`
  - 当前页面已经能显示：
    - cold outreach pipeline 主视图
    - 新线索 / 研究中 / 需人工 / 可做 Mockup / Mockup 制作中 / Mockup 就绪 / 草稿就绪 / 已发送 / 待跟进 / 已回复 / 退信 / 成交交接 / 已跳过
    - 早期自动判断只有两个确定结果：跳过，或可做 Mockup
    - AI 不确定时进入 `需人工`，operator 看证据后点击创建 Mockup 或跳过
    - 每张 card 的中文下一步动作、联系方式、证据状态、工作记录、工具轨迹、AI 判断理由
    - 已有网站 redesign lead 的 current-site audit 证据：
      - 官网链接
      - 桌面/手机截图缩略图
      - 保存到 repo 的 HTML/text
      - `current-site-audit.json` 和 `current-site-audit.md`
      - audit 结论、分数、问题、改进方向
    - audit gate 已固定为：高于 80 分 `skip_or_monitor`，60 到 80 分 `human_review`，低于 60 分 `build_mockup`
    - 已新增 `site-audit` skill，要求 conversion/trust/SEO 三层审计，并禁止把低影响 SEO/信任卫生项包装成主要触达突破口
    - `Mockup 方向` 明确标记为给 Open Design 的输入
    - `触达草稿` 明确标记为模板级，需要 LLM/人工复写
    - `skip` 作为正式筛选结果：必须显示原因和做过的工作
    - 需要人工决定的节点已经有按钮：开始/继续研究、跳过、创建 Mockup、已跟进、标记已回复、进入成交交接、重新打开
    - outreach pack / preview / proof assets / draft artifact 的业务化状态
    - live send metadata（如果 artifact 已回写 `sendResult`）
    - `website-leads` 相关 workspace 名称与 thread id（如果 case 已记录）
    - 推荐下一步
- 当前边界：
  - 这页现在说真话的范围是：
    - `discovery/evidence/mockup/draft/outreach sent/follow-up due/replied/bounced/paid handoff/skipped`
  - 还**没有完全接好的范围**：
    - decision action 后续自动触发真实 Discord / Open Design job
    - future agentic inbox 更完整 reply/thread state
    - live external webhook ingest（Instantly / Smartlead）
    - 更高质量的 cold outreach copywriter step：现在 admin 能显示草稿，但质量仍应由专门 LLM/copywriting 流程重写
    - current-site audit 已有 conversion/trust/SEO 结构化输出，但仍是单站启发式审计；后续要加入更深的网站截图/正文理解、竞争对比和更强 copywriter step
- 最低需求：
  - qualified leads
  - demo-ready leads
  - outreach sent
  - replied
  - paid
  - not-fit
  - next follow-up due
- 数据源建议：
  - `website-leads` forum 状态
  - lead qualification result
  - outreach pack summary
  - future agentic email reply state

## E3. Milestone / pipeline 状态进 admin

- 状态：`IN PROGRESS`
- 目标：
  - admin 不只是看 intake，要看到真正的项目阶段
- 建议先做：
  - 列表页 project milestone pill
  - 详情页 milestone timeline
  - queue 页按 milestone 聚合
- 当前已完成：
  - `/admin/intakes` 列表页
  - `/admin/intakes/<client>/<order>` 详情页
  - `/admin/queue` milestone 聚合
- 当前还缺：
  - `/admin` overview 总览级 milestone 聚合
  - `/admin/leads` 与正式项目 milestone 的衔接
  - Open Design pipeline 状态映射后的统一状态语言

## E4. Open Design 状态进 admin

- 状态：`IN PROGRESS`
- 目标：
  - 直接看到：
    - latest projectId
    - latest runId
    - run status
    - completion mode
    - latest sync source（app / discord / repo）
- 当前已完成：
  - `/admin/intakes`
    - 已显示 Open Design `status`
    - 已显示 `lastRunId`
    - 已显示 `completion mode`
  - `/admin/intakes/<client>/<order>`
    - 已显示 projectId / runId / status / completion mode
- 当前还缺：
  - latest sync source（app / discord / repo）
  - `/admin/overview` 和 `/admin/queue` 的 Open Design 运行聚合
  - 和 Open Design 原生 pipeline 状态语言完全统一

---

# F. 文档审计（发现过期就先登记）

## F1. 高优先级需要审计 / 更新

- 状态：`IN PROGRESS`
- 已发现可能过期或与当前 forum 架构不一致的文档：
  - `docs/HERMES_LOCAL_DISCORD_SOP.md`
  - `docs/HERMES_WEBSITE_AGENT.md`
  - `docs/SALES_FUNNEL.md`
  - `docs/AGENT_TASK_PACKET_CONTRACT.md`
  - `docs/PROFITSLOCAL_OPERATING_RULES.md`
  - `docs/NEXT_WORK.md`
  - `docs/MODULE_STATUS.md`
  - `docs/OPEN_DESIGN_HEADLESS_ORCHESTRATION.md`（需要持续补最新根因/验证）
  - `docs/OPEN_DESIGN_PROJECT_SYNC.md`

### 审计重点

- 还在写 `#website-tasks` thread 的地方，要核对是否应该改成 forum workspace
- 还在把 cold outreach 和 Resend 混在一起的地方，要拆清：
  - Resend = transactional
  - cold outreach = separate channel/system
- 还在把 admin 写成 v1 的地方，要核对是否已经落后

## F2. 审计完成标准

- 文档与当前真实架构一致
- 文档里的命令真实可跑
- 文档里的页面/路由真实存在
- 文档里的 Discord 结构与 forum 现实一致

---

# G. Backlog（现在不阻塞，但不要丢）

## G1. ROI / provider cost 进一步细化

- 状态：`BACKLOG`
- 内容：
  - Places / Firecrawl / OpenAI / Resend / Cloudinary / runtime 的更细 usage 和成本

## G2. Agentic auto-reply 风险框架

- 状态：`BACKLOG`
- 内容：
  - allowlist
  - audit log
  - kill switch
  - low-risk categories first

## G3. Open Design pipeline 视觉借鉴到 admin / task 分类

- 状态：`BACKLOG`
- 内容：
  - 参考 Open Design 的 `Not started / Running / Needs input / Succeeded / Failed`
  - 低优先级地用于我们自己的 task board 视觉分类

---

# 接下来建议执行顺序

## 现在最该做

1. `C2` 售前 lead -> paid 的 forum 流转继续补齐
2. Agentic Inbox 自动 webhook / POST 配置
3. `B4` Open Design pipeline 状态映射到我们的项目状态

## 然后做

4. fresh lead 从 outreach 到 paid 真闭环
5. `F1` 文档审计，把 forum / email / admin 的过期描述统一掉
6. `E2` cold outreach admin 面板
7. `E3 + E4` milestone / Open Design 状态接进 admin

## D2.1 Agentic Inbox 先作为第一类 cold outreach provider 接入

- 状态：`DONE`
- 已完成：
  - `/admin/settings` 明确标注 `Agentic Inbox = current live operator path`
  - `/admin/leads` 明确标注当前 live path
  - `send-cold-email --provider agentic-email` 会产出 provider-aware artifact，并落 `externalThreadUrl`
  - `/api/outreach-provider-event` + `sync-outreach-provider-event.yml` 已能把 `agentic-email` reply 事件回写到 artifact / case / forum / admin
- 仍未完成：
  - `follow-up due` 的 saved views / queue 细化
  - `opened / clicked / unsubscribed / spam complaint` 事件来源与回流
- 已补齐：
  - lead-level notes（人工 follow-up、电话结果、特殊背景、下一步承诺）
  - notes 回写到 `/admin/leads`
  - notes 回写到 `website-leads` forum（若 workspace 已存在）
  - notes 回写到 paid case timeline（若 case 已存在）

## D2.2 Agentic Inbox 自动 provider event 回流上线验证

- 状态：`IN PROGRESS`
- 目标：
  - 把 Agentic Inbox 的真实 operator / inbound 行为自动回流到：
    - `/api/outreach-provider-event`
    - `sync-outreach-provider-event.yml`
    - `/admin/leads`
    - `website-leads` forum
- 已完成：
  - worker 代码已支持：
    - inbound reply -> `replied`
    - new outbound send -> `sent`
    - operator reply -> `sent` + `nextFollowUpDue`
  - 主站 provider event 入口已支持：
    - 仅靠 unique lead email 自动匹配 `clientSlug`
    - 没有 slug 时不再直接 hard fail
  - production worker 已部署：
    - worker: `agentic-inbox-profitslocal`
    - version: `d40fd7ca-5a8d-4a04-b050-7271ce0ae8ed`
    - secret: `PROFITSLOCAL_OUTREACH_WEBHOOK_SECRET`
  - production 主站已验证：
    - unique lead email 可以自动 resolve 到正确 `clientSlug`
    - provider event 可以真实写回 remote outreach artifact
  - 关键证据：
    - `data/qa/agentic-inbox-webhook-deploy-summary.json`
    - `data/qa/agentic-inbox-production-routing-summary.json`
- 剩余 hard evidence：
  - 至少一条事件真正由 live Agentic Inbox UI 触发，而不是直接 POST 到主站 endpoint
  - 如有 case/forum 绑定，再补一条 artifact / case / admin / forum 全写回证据

---

# 当前一句话判断

系统现在已经不是“搭架子阶段”了。  
接下来最重要的是：

- 用 fresh 项目把主生产线再压几次；
- 让 admin 真正显示全业务流程；
- 让文档永远跟得上真实系统；
- 把 cold outreach 和 transactional email 的边界彻底理顺。
