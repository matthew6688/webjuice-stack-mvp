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
5. 客户通过 Tally 购买或提交反馈
6. Tally webhook → ROI ledger + AI agent task
7. Agent 修改 dev branch → preview QA → 客户确认 → live/domain 上线

**当前定价**:
- `$399` 一次性网站，包含 3 次 revisions
- `$799/year` 网站 + monthly maintenance

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
│   └── tally-webhook.ts     # Tally 表单 webhook
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
cp .env.example .env.local
npm run check:env -- --workflow funnel
npm run check:env -- --workflow scrape
npm run check:env -- --workflow deploy
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

### 4.5 Tally purchase / feedback → AI 修改

```bash
npm run funnel:create-tally-payment-forms -- --client longwang-restaurant-restaurant --dry-run true
npm run funnel:create-tally-feedback-form -- --client longwang-restaurant-restaurant --dry-run true
npm run funnel:record-tally -- --input /tmp/tally-payment-submission.json
npm run agent:create-task -- --tally /tmp/tally-payment-submission.json
npm run agent:run-task -- --task /path/to/task.json --execute
```

Live Tally form creation requires `TALLY_API_KEY` in `.env.local` and payment settings configured in Tally workspace.

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
| `profitslocal.com` 自定义域名绑定 | 未闭环 | `domain:inspect` 可检测 DNS；还需要确认 API token/account 能看到该 zone，然后 attach Pages 并轮询 SSL/HTTPS |
| pynacl 安装失败 | 已绕过 | 改用 `libsodium-wrappers` (npm) |
| 模板复制需要等待 | 已解决 | generate-sites.js 已加 5s 等待 + 5 次重试 |
| Google Places photos | MVP 已完成 | `npm run extract:google-places-photos` 支持 dry-run/live、manifest、evidence append、ledger cost |
| Live Tally payment form | 待验证 | 脚本已完成；需要 `.env.local` 中的 `TALLY_API_KEY` 和 Tally workspace payment 设置 |
| Cold email | 待验证 | 需要 `RESEND_API_KEY` 和 sender/domain 配置 |

---

## 7. 下一步 TODO

详细模块化计划见：

- `docs/AUTOMATION_ROADMAP.md`
- `docs/MODULE_STATUS.md`

- [x] 将主模板迁到 `matthew6688/webjuice-stack-mvp`
- [x] 将 `/tmp/webjuice-client-fix/*` 中 5 个客户 repo 的 `fix: update Astro 6 build config` commits push 到 `main` 和 `dev`
- [x] 给 5 个 `matthew6688/*-restaurant` repo 设置 `PAGES_PROJECT_NAME` variable
- [x] 给 5 个 `matthew6688/*-restaurant` repo 设置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets 后重新跑 Actions
- [x] 给 5 个餐厅站补基于真实公开菜单数据的餐厅首页和 `/menu` 菜单页
- [ ] 绑定 `profitslocal.com` 到 `profitslocal-live` Pages project（需要 domain 所在 Cloudflare account 的 token/zone 权限）
- [ ] 完成 cold email 发送测试（等 RESEND_API_KEY 配置）
- [x] 手动修复并验证 5 个 restaurant repo 的 GitHub Secrets / Actions
- [x] 确认 5 个 preview 站构建成功并可访问
- [ ] 创建 live Tally payment/feedback forms，并配置 webhook
- [ ] 确认 Hermes/OpenClaw 能读取 agent task 并修改 dev branch
- [ ] 完成 BrandAssetExtractor：logo、palette、official photos、font hints
- [ ] 完成 MenuPdfExtractor / MenuImageOCRExtractor
- [ ] 将 5 个 restaurant repo 完全迁到 artifact renderer flow
- [ ] 更多城市测试（如 Sydney, Melbourne）
- [ ] 添加更多 niche 模板（如 plumbing, dental）
- [ ] 验证收款流程（Tally live；必要时 Stripe alternative）
