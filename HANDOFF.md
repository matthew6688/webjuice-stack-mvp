# WebJuice Stack · Handoff Document

> 创建日期: 2026-05-04
> 状态: Brisbane 测试完成，5 个餐厅站已生成
> 运行环境: Mac Mini (macOS) + Cloudflare + GitHub + Resend

---

## 1. 项目概述

WebJuice 是一个 AI 驱动的 B2B 网站 agency 工具链。

**商业模式**: Outbound 冷启动
1. 从 Google Maps 抓取当地商家信息
2. AI 根据抓取数据自动生成网站
3. 部署 preview 站
4. 发送 cold email 给目标客户
5. 客户回复意见 → AI agent 修改 → 上线

**月费**: $0（Cloudflare Pages + Resend 免费额度内）

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

在 `~/.zshrc` 或 `~/.bash_profile` 中添加：

```bash
# GitHub
export GH_PAT="github_pat_xxx"

# Cloudflare
export CF_API_TOKEN="xxx"
export CF_ACCOUNT_ID="2b67d2288df946ac22f408b60a9bcc11"
export CF_EMAIL="matthew6688@gmail.com"

# Google Places
export GOOGLE_PLACES_API_KEY="AIza..."

# Resend
export RESEND_API_KEY="re_xxx"
```

---

## 4. 完整工作流

### 4.1 抓取客户线索

```bash
node scripts/scrape-leads.js --niche restaurant --city "Brisbane, Australia" --count 20
```

输出: `leads-restaurant-brisbane-australia.json`

### 4.2 生成网站

```bash
node scripts/generate-sites.js   --leads leads-restaurant-brisbane-australia.json   --template matthew6688/webjuice-restaurant
```

会自动：
- 从模板生成新 repo（如 `longwang-restaurant-restaurant`）
- 替换 `site.ts` 为客户品牌信息
- 创建 dev branch
- 创建 Cloudflare Pages 项目（live + dev）
- 设置 GitHub Secrets（需要 `libsodium-wrappers`支持）
- 输出 `outreach.json`

**已测试完成的 5 个 Brisbane 餐厅站**：

| 客户 | Repo | Preview |
|------|------|---------|
| Longwang Restaurant | [repo](https://github.com/matthewatuchat/longwang-restaurant-restaurant) | [preview](https://longwang-restaurant-restaurant-dev.pages.dev) |
| Babylon Brisbane | [repo](https://github.com/matthewatuchat/babylon-brisbane-restaurant) | [preview](https://babylon-brisbane-restaurant-dev.pages.dev) |
| Opa Bar & Mezze | [repo](https://github.com/matthewatuchat/opa-bar-mezze-restaurant) | [preview](https://opa-bar-mezze-restaurant-dev.pages.dev) |
| Joey's | [repo](https://github.com/matthewatuchat/joey-s-restaurant) | [preview](https://joey-s-restaurant-dev.pages.dev) |
| Chu The Phat | [repo](https://github.com/matthewatuchat/chu-the-phat-restaurant) | [preview](https://chu-the-phat-restaurant-dev.pages.dev) |

### 4.3 发送冷邮件

```bash
node scripts/send-cold-email.js   --leads leads-restaurant-brisbane-australia-outreach.json   --dry false
```

默认 `--dry true`，先跑一次确认内容没问题再发送。

### 4.4 客户反馈 → AI 修改

1. 客户回复邮件给修改意见
2. 转发到 Discord thread（每客户一个线程）
3. Hermes 读取线程 → 修改 dev branch
4. GitHub Actions 自动部署到 preview
5. 客户确认 → merge dev → main → live 上线

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
| 5 个餐厅站 Actions 构建失败 | 已定位，本地已修复 | 原因是 workflow 使用 Node 20，但 Astro 6 需要 Node >=22.12；同时内容集合配置需迁移到 `src/content.config.ts` |
| `longwang-restaurant-restaurant` 的 CLOUDFLARE_API_TOKEN Secret 设置失败 | 未解决 | 手动在 GitHub Settings → Secrets 中添加 |
| pynacl 安装失败 | 已绕过 | 改用 `libsodium-wrappers` (npm) |
| 模板复制需要等待 | 已解决 | generate-sites.js 已加 5s 等待 + 5 次重试 |
| Google Places API 需要开启 + 绑定信用卡 | 已配置 | - |

---

## 7. 下一步 TODO

- [x] 将主模板迁到 `matthew6688/webjuice-stack-mvp`
- [ ] 将 `/tmp/webjuice-client-fix/*` 中 5 个客户 repo 的 `fix: update Astro 6 build config` commits push 到 `main` 和 `dev`
- [ ] 完成 cold email 发送测试（等 RESEND_API_KEY 配置）
- [ ] 手动修复 `longwang-restaurant-restaurant` 的 GitHub Secrets
- [ ] 确认 5 个 preview 站构建成功
- [ ] 设置 Tally 表单 webhook（如需要客户主动填写）
- [ ] 确认 Hermes 能够读取 Discord thread 并修改 dev branch
- [ ] 更多城市测试（如 Sydney, Melbourne）
- [ ] 添加更多 niche 模板（如 plumbing, dental）
- [ ] 验证收款流程（Stripe/Tally 整合）
