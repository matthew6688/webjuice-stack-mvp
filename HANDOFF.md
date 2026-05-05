# WebJuice Stack · Handoff Document

> 创建日期: 2026-05-04
> 状态: Brisbane 测试完成，5 个餐厅 preview 已上线并通过部署巡检
> 运行环境: Mac Mini (macOS) + Cloudflare + GitHub + Resend

---

## 1. 项目概述

WebJuice / Profits Local 是一个 AI 驱动的 B2B 本地商家网站 agency 工具链。

**商业模式**: Outbound 冷启动
1. 从 Google Maps 抓取当地商家信息
2. AI 根据抓取数据自动生成网站
3. 部署 preview 站
4. 生成截图、demo video、outreach pack
5. 客户通过 first-party `/checkout` + Stripe Checkout 购买
6. Stripe webhook / first-party `/revise` → ROI ledger + entitlement + AI agent task
7. Agent 修改 dev branch → preview QA → 客户确认 → live/domain 上线

**当前定价**:
- `$399` 一次性网站，包含 3 次 revisions
- `$799/year` 网站 + monthly maintenance
- `$100` 每次额外 revision

---

## 2. 仓库结构

```
webjuice-stack-mvp/          # 母板模板
├── src/
│   ├── config/
│   │   ├── site.ts          # 品牌配置（会被替换）
│   │   └── pricing.ts       # 按 niche 定价
│   ├── content/             # Markdown 内容
│   ├── layouts/
│   ├── pages/               # 页面
│   └── components/
├── functions/api/
│   ├── contact.ts           # 联系表单
│   ├── create-checkout-session.ts # Stripe Checkout
│   ├── stripe-webhook.ts    # Stripe signed webhook
│   ├── revision-request.ts  # first-party revision form
│   └── tally-webhook.ts     # legacy/fallback Tally webhook
├── scripts/
│   ├── scrape-leads.js       # Google Maps 抓取
│   ├── generate-sites.js     # 批量生成客户站
│   ├── send-cold-email.js    # 冷邮件发送
│   ├── new-client.js         # 单个客户站创建
│   ├── setup-github-secrets.js # GitHub Secrets 自动设置
│   ├── add-domain.js         # 域名上线
│   └── upgrade-client-email.js # 邮件域名升级
├── .github/workflows/
│   ├── deploy.yml            # main branch → live
│   └── deploy-dev.yml        # dev branch → preview
├── DESIGN.md                  # 设计规范（强制）
├── package.json
├── astro.config.mjs
├── wrangler.toml
└── README.md

模板展示站:
├── webjuice-restaurant/       # 餐厅模板（$199/$399）
└── webjuice-roofing/          # 屋顶模板（$499/$799）
```

---

## 3. 环境变量

本地开发使用 `.env.local`，不要把 API key 写进文档、commit、shell history 或生成物。

```bash
npm run setup:local-env
npm run check:env -- --workflow funnel
npm run check:env -- --workflow scrape
npm run check:env -- --workflow deploy
npm run check:env -- --workflow localAudit
```

安全规则见 `docs/SECURITY.md`。

---

## 4. 完整工作流

### 4.1 抓取客户线索 / 建 evidence

```bash
npm run extract:google-places -- \
  --query "restaurant Brisbane Australia" \
  --niche restaurant \
  --city Brisbane \
  --count 20 \
  --campaign brisbane-restaurants
```

Google Places Details、Firecrawl、Firecrawl Parse、Menu parser、OCR wrappers 都应把结果写入 evidence pack，而不是让 renderer 直接读 raw scrape。

### 4.2 生成 client artifacts

```bash
npm run pipeline:build-client -- --client longwang-restaurant-restaurant
npm run outreach:build-pack -- --client longwang-restaurant-restaurant
npm run outreach:capture-assets -- --client longwang-restaurant-restaurant
```

输出包括：
- `content.restaurant.json`
- `design.restaurant.json`
- `brand-spec.md`
- `artifact-manifest.json`
- `funnel/checkout.json`
- `outreach/outreach-pack.json`
- desktop/mobile screenshots
- `outreach/demo.mp4`

**已测试完成的 5 个 Brisbane 餐厅站**：

| 客户 | Repo | Preview |
|------|------|---------|
| Longwang Restaurant | [repo](https://github.com/matthew6688/longwang-restaurant-restaurant) | [preview](https://longwang-restaurant-restaurant-dev.pages.dev) |
| Babylon Brisbane | [repo](https://github.com/matthew6688/babylon-brisbane-restaurant) | [preview](https://babylon-brisbane-restaurant-dev.pages.dev) |
| Opa Bar & Mezze | [repo](https://github.com/matthew6688/opa-bar-mezze-restaurant) | [preview](https://opa-bar-mezze-restaurant-dev.pages.dev) |
| Joey's | [repo](https://github.com/matthew6688/joey-s-restaurant) | [preview](https://joey-s-restaurant-dev.pages.dev) |
| Chu The Phat | [repo](https://github.com/matthew6688/chu-the-phat-restaurant) | [preview](https://chu-the-phat-restaurant-dev.pages.dev) |

### 4.3 同步到 restaurant renderer repo

```bash
npm run clients:sync-artifacts -- \
  --client longwang-restaurant-restaurant \
  --repo /path/to/longwang-restaurant-restaurant \
  --build
```

### 4.4 部署巡检

```bash
npm run check:links -- --all clients --internal-links false
npm run check:deploys -- --all clients
```

2026-05-04 验证结果：
- 5 个 preview 均 HTTP 200
- 5 个 repo 最新 GitHub Actions 均 `completed/success`

### 4.5 Stripe purchase / revision → AI 修改

```bash
npm run funnel:route-stripe -- --input /tmp/stripe-checkout-session-completed.json --dry-run true
npm run funnel:route-tally -- --input /tmp/first-party-revision.json --dry-run true
npm run funnel:route-event -- --input /tmp/stripe-checkout-session-completed.json --provider auto --dry-run true
npm run agent:run-task -- --task /path/to/task.json --execute
```

Current production sales path:

- `/checkout` creates Stripe Checkout Sessions for `$399`, `$799/year`, and `$100` extra revision.
- `/api/stripe-webhook` verifies Stripe signature and sends sales Discord/customer email.
- `/revise` requires `orderId + checkout email`.
- `/api/revision-request/` sends revision receipt email and Discord notification.
- Main automation router enforces entitlement quota before creating revision tasks.
- Central runner exists: `route-funnel-event.yml` runs `npm run funnel:route-event`, writes entitlement/submission/task/ledger state, and can commit generated state back to `main`.
- Client Pages Functions can dispatch directly to that workflow with `AGENT_GITHUB_TOKEN`, or to `AGENT_WEBHOOK_URL` if a central HTTP endpoint is introduced later.
- Per-order case memory is written under `data/cases/<clientSlug>/<orderId>/`; routed tasks include `case.contextPath`, source-of-truth files, allowed file scope, and Huashu design protocol so agents do not rely on short-term prompt memory.
- `npm run agent:run-task` now loads that case context, validates source-of-truth files, applies restaurant artifacts, runs build, and appends `agent-runs.jsonl`/timeline records. Use `--checkout true --push true` only when ready to update the dev review branch.
- `npm run agent:complete-task` wraps task run, optional dev deploy check, and optional customer review email. Use it for the paid/revision handoff after the task is ready.
- `npm run agent:publish-approved` publishes approved dev to main/live by creating a new main commit from the dev tree, avoiding unrelated-history merges and force-pushes.
- Template/client sites include `/approve` and `/api/approval-request/`; approval dispatches `publish-approved.yml` in the main automation repo using `AGENT_GITHUB_TOKEN`.
- Template/client sites include `/api/order-status/`; `/revise` can show trusted revision quota after matching `orderId + checkout email` against the central entitlement JSON.
- Funnel Discord messages now request webhook responses, try `thread_name`, can use `DISCORD_BOT_TOKEN` to create true text-channel threads, and write returned channel/thread/message IDs into `case.json.discord` plus timeline metadata.
- Dedicated Hermes `website-agent` is configured for `#website-tasks`; route-funnel-event can mirror paid/revision task handoffs there with `WEBSITE_TASKS_DISCORD_CHANNEL_ID`, `WEBSITE_AGENT_MENTION`, and `WEBSITE_TASKS_DISCORD_BOT_TOKEN`.

Tally remains as a fallback/provider boundary, but live payment-block creation failed Tally API schema validation during testing.

---

## 5. 设计规范（强制）

所有网站设计遵循 **webjuice-design** skill：

- 事实验证先于假设（WebSearch）
- 品牌资产协议: Logo > 产品图 > UI > 色值
- 反 AI slop（禁止紫色渐变、Emoji 图标、SVG 手画）
- DESIGN.md 驱动颜色、字体、布局

完整参考：https://github.com/alchaincyf/huashu-design/blob/main/SKILL.md

---

## 6. 已知问题

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| 旧 `matthewatuchat/*` repo 对当前账号不可写 | 已绕过 | 主模板已迁到 `matthew6688/webjuice-stack-mvp`，后续新 repo 默认创建到 `matthew6688` |
| 5 个餐厅站 Actions 构建失败 | 已修复并验证 | `npm run check:deploys -- --all clients` 全部 success |
| 5 个餐厅站内容像空壳 | 已修复 | 已按 Huashu Design 思路重做餐厅首页和 `/menu`；菜单项来自公开官网/PDF/菜单页，并在页面标注 source URL |
| `profitslocal.com` 自定义域名绑定 | 已完成 | 已 attach 到 `profitslocal-live`；CNAME 已设置；Pages verification/validation active；`https://profitslocal.com/` HTTP 200 |
| pynacl 安装失败 | 已绕过 | 改用 `libsodium-wrappers` (npm) |
| 模板复制需要等待 | 已解决 | generate-sites.js 已加 5s 等待 + 5 次重试 |
| Google Places photos | MVP 已完成 | `npm run extract:google-places-photos` 支持 dry-run/live、manifest、evidence append、ledger cost |
| Brand assets | MVP 已完成 | `npm run extract:brand-assets` 支持从官网 HTML/URL 抽 logo、官方图片、颜色和 font hints，并可写入 evidence |
| Live Tally payment form | 已降级为 fallback | Tally payment-block API schema 不稳定；当前主线使用 first-party Stripe |
| Stripe checkout / paid loop | MVP 已验证 | Longwang `$399` test payment 成功 redirect `/thank-you`；`$100` extra revision checkout session smoke 成功 |
| Revision 次数控制 | MVP 已完成 | `orderId + checkout email` 强制匹配；`one_time` 3 次，`yearly` 每月 1 次，超限不创建 task |
| Revision 次数显示 | MVP 已完成 | `/api/order-status/` 从主自动化仓库读取 entitlement；`/revise` 显示已用/剩余/套餐 |
| Discord case workspace | MVP 已完成 | webhook `wait=true` 返回 message/channel；forum/media channel 可自动 thread；配置 `DISCORD_BOT_TOKEN` 后普通 text channel 也可从 webhook message 创建 true thread |
| Hermes website-agent pickup | MVP 已完成 | 本机 `ai.hermes.gateway-website-agent` 已启动；`#website-tasks` @mention smoke 触发 true thread 并完成 `openai-codex / gpt-5.4-mini` 回复；route-funnel-event 可发送 task/case handoff |
| ROI / cost ledger | MVP 已完成 | Stripe/Tally revenue、Places/Firecrawl/OpenAI、Resend、image generation、agent runtime 都可写 ledger；Resend/runtime 为可配置估算成本 |
| Menu document extraction | MVP 已完成 | `extract:menu-document` 统一调度 MarkItDown、direct text、OCRmyPDF、PaddleOCR、Firecrawl Parse fallback，并写 manifest + menu evidence；已用 Opa Bar + Mezze 真实官网菜单验证，并推送远程 dev preview，最终清洗为 7 sections / 52 items |
| Local AI audit | MVP 已完成 | `npm run audit:restaurant-local-llm` 使用本地 Ollama + deterministic checks 审计餐厅 content/menu；5 个 Brisbane restaurant 全部用 `qwen3.5:9b` 通过，score 100，0 findings |
| OCR local runtime | 已配置并验证 | MarkItDown、Poppler、OCRmyPDF/Tesseract/Ghostscript、PaddleOCR/PaddlePaddle 已在本机跑通；详见 `docs/OCR_MENU_PIPELINE.md` |
| Resend customer emails | MVP 已完成 | `fengtalk.ai` verified；payment/revision receipt 和 router accepted/denied 邮件路径已实现 |
| Cold email | Dry-run 已完成 | `npm run outreach:send-cold-email -- --client <slug> --dry true` 已为 5 个 Brisbane restaurant 生成 proof email artifact；live 发送只应发 owner-controlled inbox |
| Ops dashboard | 已规划/暂缓实现 | 先完成 restaurant 闭环；dashboard 只记录方案，详见 `docs/OPS_DASHBOARD_PLAN.md` |

---

## 7. 下一步 TODO

详细模块化计划见：

- `docs/AUTOMATION_ROADMAP.md`
- `docs/MODULE_STATUS.md`
- `docs/WEBSITE_AGENT_CLOSURE_PLAN.md`

### 7.1 Restaurant core loop: launch blockers

- [x] Customer approval endpoint smoke：从 dev preview `/approve?order_id=...&email=...` 提交，必须匹配同一个 central case/thread，并 dispatch `publish-approved.yml`
- [x] Preview fixed footer/banner QA：dev preview 上固定 footer 只作为销售/账户操作入口，包含 `Approve site`、`Request revision`、revision usage、`Buy extra revision`，不能污染餐厅正式内容
- [x] `/revise` full smoke：用 `orderId + checkout email` 提交 feedback，验证 entitlement 扣次数、同一个 case、同一个 `websiteTaskThreadId`
- [ ] Strict pre-review gate：如果 agent run 没有 `contextRead`、`designProtocolUsed`、截图/视觉 QA、dev deploy URL，就不能发 customer review email
- [ ] Opa Bar + Mezze full-loop live-sim：用 test order 跑 paid → agent dev preview → customer approve → publish live，全程不污染真实 ROI/customer data
- [ ] Domain handoff email/page：客户指定 domain/subdomain 后，thank-you/review/live email 需要给清晰 DNS 指引；utility preview pages 保留作为 revise/approve/account 页面
- [ ] Extra revision policy finalization：确认 `$100` extra revision 是给原 entitlement `+1`，还是创建单独 one-revision entitlement，并完成 wiring

### 7.2 Backlog / not launch blockers

- [x] 将主模板迁到 `matthew6688/webjuice-stack-mvp`
- [x] 将 `/tmp/webjuice-client-fix/*` 中 5 个客户 repo 的 `fix: update Astro 6 build config` commits push 到 `main` 和 `dev`
- [x] 给 5 个 `matthew6688/*-restaurant` repo 设置 `PAGES_PROJECT_NAME` variable
- [x] 给 5 个 `matthew6688/*-restaurant` repo 设置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets 后重新跑 Actions
- [x] 给 5 个餐厅站补基于真实公开菜单数据的餐厅首页和 `/menu` 菜单页
- [x] 绑定 `profitslocal.com` 到 `profitslocal-live` Pages project
- [x] 给 `profitslocal.com` 添加 CNAME 到 `profitslocal-live.pages.dev`
- [x] 轮询 `profitslocal.com` Pages custom-domain 状态直到 active
- [ ] `profitslocal.com` 页面由 owner 后续处理，当前不进入执行队列
- [x] 完成 cold email dry-run proof：5 个 Brisbane restaurant outreach email artifacts 已生成，包含 preview、真实菜单 source、AI audit、截图/video proof
- [ ] 完成 cold email live 测试（Resend 已配置；live 只发 owner-controlled inbox）
- [x] 手动修复并验证 5 个 restaurant repo 的 GitHub Secrets / Actions
- [x] 确认 5 个 preview 站构建成功并可访问
- [x] 创建 first-party Stripe checkout/revision forms，并配置 webhook/secrets
- [x] 建 central automation runner，让 Pages webhook 自动触发主仓库 route + commit state
- [x] 确认 agent runner 能读取 case context/source-of-truth 并修改 dev branch
- [x] 添加 approval publish workflow，客户批准后发布 dev 到 live/main
- [x] 添加 `/api/order-status/` 和 `/revise` revision 次数显示
- [x] 建 Discord thread workspace，把 order/thread/message URL 写回 case memory
- [x] 跑一次真实 Discord thread live test（GitHub Actions dispatch 成功发送 Discord；测试订单 state 已清理，避免污染 ROI/customer data）
- [x] 建 dedicated Hermes `website-agent` / `#website-tasks` pickup：独立 profile、LaunchAgent、本地 smoke、bot mention handoff 均验证通过
- [x] route-funnel-event 增加 website-agent handoff：付款/修改 task 可 mirror 到 `#website-tasks` 并记录 `websiteTaskThreadId`
- [ ] 创建正式 `ProfitsLocal Handoff` sender Discord app/token，用于 `WEBSITE_TASKS_DISCORD_BOT_TOKEN`；不能用 `website-agent` 自己给自己发任务
- [x] 改造 website-agent handoff 路由：如果 `case.json.discord.websiteTaskThreadId` 已存在，后续 payment/revision/agent/approval 更新必须复用同一个 thread
- [x] 给 agent run record 增加可审计 checklist：`contextRead`、`designProtocolUsed`、`qaScreenshots`、`devDeployUrl`、`customerEmailId`
- [x] 做完整闭环 fixture：test paid order → feedback revision → dev push/deploy → review email → approval publish → live email，断言始终使用同一个 website task thread
- [x] 接入 ROI/cost ledger：Resend、image generation、agent runtime
- [x] 完成 BrandAssetExtractor：logo、palette、official photos、font hints
- [x] 完成 Menu document extractor MVP：MarkItDown/direct text/OCRmyPDF/PaddleOCR 编排
- [x] 安装配置 MarkItDown/OCRmyPDF/PaddleOCR，并用 PDF、图片菜单、扫描 PDF 跑 live 验证
- [x] 用真实 business 官网菜单验证 document extraction：Opa Bar + Mezze official menu → MarkItDown → 10 sections / 73 items
- [x] 给 `extract:menu-document` 加 Firecrawl Parse optional fallback，并完成 dry-run smoke test
- [x] 用真实菜单 evidence 重新生成一个餐厅 preview，并做截图/视觉 QA：Opa Bar + Mezze dev preview 已 push/deploy success，`/menu` mobile/desktop 均 200，52 menu items，无 console error / overflow
- [x] 重新生成 Opa outreach screenshots/demo video，让 cold email proof 使用最新真实菜单 preview
- [x] 重新生成 5 个 Brisbane restaurant 的 outreach screenshots/demo video，并全部 validate pass
- [x] 加入本地 Ollama AI audit 质量闸门，并用 Opa 真实菜单 artifact 验证通过
- [x] 将本地 Ollama AI audit 跑完 5 个 Brisbane restaurant，全部 pass/100/0 findings
- [x] 跑 sale → case/task/entitlement/ledger 本地 smoke，并生成 Discord case-thread dry-run payload
- [x] 跑 agent runner execute smoke：读取 case context/source-of-truth，apply artifacts，build，通过并写回 case run record
- [x] 跑 approval publish dry-run smoke：验证 dev → main publish runner 步骤链可生成计划并通过
- [x] 跑一次真实 Discord thread live test（通过 GitHub Actions secrets 执行，run 成功；测试订单 state 已清理）
- [x] 添加 agent-complete / live-published Discord follow-up：可回发到 case memory 里保存的 thread，并已用 Opa smoke case dry-run 验证 payload/thread_id
- [ ] 将 5 个 restaurant repo 完全迁到 artifact renderer flow
- [ ] 更多 restaurant 城市测试（如 Sydney, Melbourne），但必须等 Brisbane restaurant 闭环稳定后再做
- [ ] 其他 niche 暂缓；当前只聚焦 restaurant 闭环
- [x] 验证 Stripe test 收款流程和 extra revision checkout
