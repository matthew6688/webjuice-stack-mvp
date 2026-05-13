# V3 客户文件夹标准结构 · 2026-05-13

> Matthew 提醒: 每客户有个文件夹 · 含 sales / audit / marketing 素材 · 以前就考虑过
> 我研究后发现**两个并存模式** · V3 决定统一到 enriched v2/

---

## 历史背景 · 两套并存模式

### Pattern A · 老 · 真付费客户用

`clients/opa-bar-mezze-restaurant/` · `clients/rich-and-rare-restaurant/`

```
clients/<slug>/                  (flat at root · 不在 v2/ 里)
├── artifact-manifest.json
├── brand-spec.md
├── content.<niche>.json         (niche-specific · restaurant.json / roofing.json)
├── design.<niche>.json
├── artifacts/                   (menu-document/ etc.)
├── audit/                       (local-llm-audit.json)
├── concept/open-design/         (OD 输出)
├── evidence/                    (evidence.json)
├── funnel/                      (checkout / tally-*)
├── intake/                      (website-survey.json)
└── outreach/                    (email/ · screenshots/ · demo.mp4 · outreach-pack)
```

**特点**: 子目录完整 (sales/audit/marketing/funnel/intake/outreach 都有) · 但**没有 master.md**。是 niche-adapter (restaurant) 模式 · 跟 V2 master.md 模式不兼容。

### Pattern B · 新 · 10+ client 在用

`clients/acacia-plumbing/v2/` · `clients/brisbane-roof-restoration-experts/v2/` · etc.

```
clients/<slug>/v2/               (嵌套在 v2/ 子目录)
├── master.md                    (master-md-builder 输出)
├── master.report.html           (huashu-md-html 主题渲染)
├── internal-audit-report.html   (Stage 4 输出 · operator 看)
├── evidence/                    (issue-*.png 特写)
├── screenshots/                 (desktop.png / mobile.png)
└── video/                       (mobile-throttled.webm)
```

**特点**: 有 master.md · 派生 html · audit 证据齐全。但**子目录少** · 没 sales / marketing / outreach / funnel / intake。

---

## V3 决定 · enrich Pattern B v2/

**不破现有 10 client 用 v2/ flat 结构**。在 v2/ 加新子目录 · 把 Pattern A 的能力补回来。

```
clients/<slug>/v2/                ← V3 标准路径
│
├── 📌 源真理 · 不动
├── master.md                     (master-md-builder · audit / dedup / grade 等 frontmatter)
│
├── 📄 派生 derived doc (LLM 生成 · 可重生 · 不动 = 慎重)
├── master.report.html            (huashu-md-html theme=report · operator 用)
├── internal-audit-report.html    (操作员技术报告 · audit Stage 4 输出)
├── customer-facing-audit.html 🆕 (客户 owner 看 · M2-D9 autoresearch loop 输出 · 人话)
│
├── 🔬 audit raw 证据
├── evidence/                     (issue-*.png · captureIssueEvidence 输出 · 每 audit issue 特写)
├── screenshots/                  (desktop.png / mobile.png · siteFetchFull 输出)
├── video/                        (mobile-throttled.webm · Playwright 录屏)
├── audit/ 🆕                     (raw fixture · symlink 或 copy)
│   ├── detailed-audit.json       → data/v2/fixtures/detailed-audit/<key>.json
│   ├── visual-audit.json         → data/v2/fixtures/visual-autoresearch/.../<key>.json
│   └── reviews.json              → data/v2/fixtures/reviews/<key>.json
│
├── 💼 sales 销售素材 · M3+ (复用老 Pattern A)
├── sales/ 🆕
│   ├── outreach-pack.json
│   ├── outreach-pack.md
│   ├── master-deck.pdf           (M4 · 提案 PDF)
│   ├── demo.mp4                  (复用老 outreach/demo.mp4)
│   └── elevator-pitch.md         (主销售话术 · master.md 第七章提取)
│
├── 🎨 marketing 营销素材 · M3+
├── marketing/ 🆕
│   ├── hero-mockup.png           (B 类 lead · ChatGPT Image 生 · "你的网站长这样"试探)
│   ├── social-cards/             (LinkedIn / FB 帖子用)
│   └── email-banner.png
│
├── 📧 outreach 通讯 · M4
├── outreach/ 🆕
│   ├── email/                    (每发一封 1 个 JSON · `01-{template-id}-{timestamp}.json`)
│   ├── sms/                      (M4 · Android termux 发送)
│   ├── voice/                    (Vapi 录音 transcripts)
│   ├── contact-log.json          (汇总: when / channel / template / status / reply)
│   └── reply-classifications/    (12 类 reply intent · 每 reply 1 个 JSON)
│
├── 🛒 funnel 购买 · M5
├── funnel/ 🆕
│   ├── checkout.json             (Stripe checkout session)
│   ├── stripe-events.json        (webhook 历史)
│   ├── revisions.json            (修改请求 + 用了几次 · 跟 entitlements.js)
│   └── tally-payment-form-payloads.json (复用)
│
├── 📝 intake 客户填的 · M5
├── intake/ 🆕
│   ├── website-survey.json       (复用老 Pattern A · 客户填的网站需求)
│   └── revision-requests.json    (M5 · 修改请求 form 数据)
│
└── 🎭 concept · OD 设计 · M3
    └── concept/ 🆕
        └── open-design/          (OD run 输出 · HTML + brand-spec + assets · 复用现有)
            ├── index.html
            ├── brand-spec.md
            ├── concept-manifest.json
            ├── production-handoff.json
            ├── run-events.sse
            ├── run-status.json
            └── assets/           (hero / logo / 等)
```

---

## 各模块 own 哪个子目录

| 模块 | own 的子目录 | 写入触发 |
|---|---|---|
| **M1 入库** | `intake/website-survey.json` (来自 Tally form) | webhook · 客户首次填 |
| **M2 audit** | `audit/` · `evidence/` · `screenshots/` · `video/` · `internal-audit-report.html` · **`customer-facing-audit.html` 🆕** · `master.md` 更新 | leads:run-pipeline 完 |
| **M3 设计** | `concept/open-design/` · `marketing/hero-mockup.png` (B 类) | open-design:run-concept |
| **M3 发布** | `<slug>-dev.pages.dev` · `<slug>-live.pages.dev` (CF Pages · 不在 clients/ 里) | publisher.js |
| **M4 outreach** | `sales/` · `outreach/email/` · `outreach/sms/` · `outreach/voice/` · `outreach/contact-log.json` | pl:email-send · pl:c-grade-batch-send · etc. |
| **M5 paid** | `funnel/checkout.json` · `funnel/stripe-events.json` · `funnel/revisions.json` · `intake/revision-requests.json` | Stripe webhook · approval flow · revision flow |

---

## V3 实施 · M2 涉及 v2/ 改动

M2 实装时 deliverable 涉及的新文件:

| Deliverable | 文件 |
|---|---|
| M2-D2 | `audit/reviews.json` (docker reviews via adapter · 或 symlink) |
| M2-D5 | (无新文件 · 30 天 staleness 改 read 逻辑) |
| M2-D6 | `master.md` 重排 + 5 必出 section |
| M2-D7 | (无客户 v2/ 文件 · od-invoke-prep 输出到 data/v2/od-prep/) |
| **M2-D9 🆕** | **`customer-facing-audit.html`** (autoresearch loop 输出) |

新 deliverable **M2-D10 🆕**: 给 v2/ 加 5 个空子目录 + manifest 标记:

```bash
# 任何 entity audit 跑完时 · ensure 子目录存在
clients/<slug>/v2/
├── (existing)
├── sales/.gitkeep
├── marketing/.gitkeep
├── outreach/.gitkeep
├── funnel/.gitkeep
└── intake/.gitkeep
```

或 lazy create · 不强 init · M3-M5 实装时各自 mkdir。

---

## 老 client 文件夹迁移

| 客户 | 现状 | V3 处理 |
|---|---|---|
| opa-bar-mezze-restaurant (Pattern A · 真付费) | clients/opa-bar-mezze-restaurant/ flat | **保留** · 不动 · 老的 (V3 客户进 v2/) |
| rich-and-rare-restaurant (Pattern A · 真付费) | 同上 | 保留 · 不动 |
| acacia-plumbing 等 10+ (Pattern B v2/) | clients/<slug>/v2/ | enrich · 加新子目录 |
| 新 V3 客户 | 进 Pattern B (v2/) | 完整结构 |

**不强迁** · 老 v1 客户保持现状。

---

## TEST + EVIDENCE for M2-D10 (新)

加进 TEST-AND-EVIDENCE:

### M2-D10 · v2/ 完整结构

**TEST**: `scripts/v3/test-m2-d10-v2-structure.mjs`

5 assertion:

1. M2 audit 完后 · v2/ 含: master.md + master.report.html + internal-audit-report.html + **customer-facing-audit.html** + evidence/ + screenshots/ + video/
2. 5 个新子目录创建 (sales/ marketing/ outreach/ funnel/ intake/) · 至少有 .gitkeep
3. audit/ symlink/copy 到 fixture (detailed-audit.json + visual-audit.json + reviews.json)
4. 老 v1 客户 (opa-bar-mezze-restaurant) 不动 · flat 结构保留
5. concept/open-design/ 路径不变 (M3 用)

**EVIDENCE**: `data/qa/m2-d10-v2-structure.json` · 列每文件 + 大小 + 谁写的

**VERDICT**: `npm run v3:test-m2-d10`

---

## M2 deliverable 现 10 个 (8 原 + D9 customer audience + D10 v2 结构)

总工时 22 → 24h · ~3 工作日。

---

## 给 Matthew 的回答 · 是的考虑过 · 我没用全

老 Pattern A 已经有完整子目录 (sales/marketing/outreach/funnel/intake) · 真付费客户在用。
新 Pattern B v2/ 只有 audit 类 · 是因为 master.md 走的是 audit-first 路径 · 还没扩到 sales/marketing 阶段。

V3 = **enrich Pattern B v2/** · 加 5 个老 Pattern A 已有的子目录 · 让 M3-M5 自然落进对应位置 · 同时保留现有 10 client 兼容性。

不创建新 path · 不强迁移老 client · 不破现有 master-md-builder 输出位置。
