# ProfitsLocal 核心业务闭环 TODO 台账

更新日期：2026-05-08

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
  - 目前可以从真实数据看到：
    - `demo ready`
    - `draft ready`
    - `outreach sent`（当 live send 已回写到 email artifact）
    - `paid`
    - `missing assets`
    - `missing outreach draft`
- 还缺：
  - `replied`
  - `next follow-up due`
  - external cold email platform / agentic inbox reply state
- 为什么重要：
  - 这决定后面大量项目时 Discord 是否仍然清晰可管
- 是否需要显示到 admin：
  - **需要**
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

- 状态：`PENDING`
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
  - `/admin/intakes`
  - `/admin/intakes/<client>/<order>`
  - `/admin/finance`
  - `/admin/queue`

## E2. Cold outreach admin 面板

- 状态：`IN PROGRESS`
- 目标：
  - 增加一个 leads / outreach 运营页
- 当前已完成：
  - 已新增：
    - `/admin/leads`
  - 当前页面已经能显示：
    - demo-ready / draft-ready / outreach-sent / paid / missing assets / missing email
    - outreach pack / preview / proof assets / draft artifact
    - live send metadata（如果 artifact 已回写 `sendResult`）
    - `website-leads` 相关 workspace 名称与 thread id（如果 case 已记录）
    - 推荐下一步
- 当前边界：
  - 这页现在说真话的范围是：
    - `demo/outreach draft/outreach sent/paid`
  - 还**没有**真实接上的范围：
    - `replied`
    - `next follow-up due`
    - future agentic inbox reply state
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

1. `A3` 真实 revision 闭环再跑一条
2. `B4` Open Design pipeline 状态映射到我们的项目状态
3. `C2` 售前 lead -> paid 的 forum 流转继续补齐

## 然后做

4. `F1` 文档审计，把 forum / email / admin 的过期描述统一掉
5. `E2` cold outreach admin 面板
6. `E3 + E4` milestone / Open Design 状态接进 admin
7. `D3` agentic email 如何回流 case / forum / admin

---

# 当前一句话判断

系统现在已经不是“搭架子阶段”了。  
接下来最重要的是：

- 用 fresh 项目把主生产线再压几次；
- 让 admin 真正显示全业务流程；
- 让文档永远跟得上真实系统；
- 把 cold outreach 和 transactional email 的边界彻底理顺。
