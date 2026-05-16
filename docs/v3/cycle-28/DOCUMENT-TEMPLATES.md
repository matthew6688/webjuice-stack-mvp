# Document Templates · Cycle-28 · 3 最终文档结构

> Pipeline 跑完后产出的 3 个文档 · 服务 3 个 stakeholder

**Live mockup (实际数据渲染)**: https://customer-summaries.pages.dev/mockups/

---

## 3 文档的角色 + 关系

| 文档 | 路径 | 读者 | 用途 | 更新时机 |
|---|---|---|---|---|
| `master.md` | `clients/<slug>/v2/master.md` | 销售 / operator | 看背景 + 决定 outreach + 历史 ref | 每 stage 累积 |
| `final-handoff.md` | `clients/<slug>/v2/handoff/final-handoff.md` | OD (Codex retex) | build 时 prompt input | Stage 3 完成后 |
| `internal-audit-report.html` | `clients/<slug>/v2/internal-audit-report.html` | 销售跟客户讲 | "我们找出+解决的 N 项" 话术 | Stage 2 audit + Stage 5 verification |

```
handoff/raw/* + handoff/content/* + handoff/design/* + handoff/audit-findings.json
                          │
       ┌──────────────────┼──────────────────┐
       ↓                  ↓                  ↓
   master.md         final-handoff.md   internal-audit-report.html
```

---

## 1 · master.md · 销售视图

**目的**: 累积全 pipeline 数据 · 销售看一份文档就够 · 决定 outreach + 后续动作。

**结构** (frontmatter + 9 段):

```markdown
---
business_id: "place_chij..."
business_name: "Mark Squire Roof Restorations"
city: "Brisbane"
niche: "roofer"
website: null               # 或 url
priority_tier: "starter_candidate"   # 或 "redesign_candidate"
abn: "12 345 678 901"
abn_status: "Active"
domain_age_years: 5         # 或 null (no website)
generated_at: "2026-05-16T10:30:00Z"
stages_completed: [0, 0.5, 1, 3]    # 2 跳过 if STARTER
deploy_url: "https://mark-squire-dev.pages.dev"
---

# Mark Squire Roof Restorations

[STARTER badge · 黄色] [投资力 medium badge]

## ① 硬数据 (core-facts · 永不能错)
- 商家名: ... [GBP]
- 电话: ... [GBP]
- 地址: ... [GBP]
- ABN: ... · Active [ABR]
- License: QBCC ... [ABR]
- Google: 4.7★ · 3 评论 [GBP]
- GMB 链接: ↗ [GBP]
- 域名年龄: 5 年 [WHOIS] 或 n/a (no website)

## ② 客户背景 (双语 · Stage 3 生成 · LLM)
### 业务范围
- 服务 1 [GBP, 搜索]
- 服务 2 [LLM推断]
...
### 经营历史
- ABN 注册 X 年 [ABR]
- ...
### 投资能力评估
- medium / small / large [LLM推断]
- ...

## ③ 销售切入点
- 核心 angle: 一句话 (LLM derived from audit + summary)
- 痛点切入: 一句话

## ④ 现状评估 (audit 高层)
| 维度 | 评估 |
| 线上存在 | ... |
| 评论资产 | ... |
| 合规度 | ... |
| 本地 SEO | ... |

## ⑤ 关键问题 (REDESIGN) / 关键缺口 (STARTER)
- REDESIGN: 列 audit-findings.json top 5 critical issues
- STARTER: 列基线缺口 (无 phone-clickable / 无 schema / 无 area pages 等)

## ⑥ 我们的方案
- 新站结构概述 (引用 handoff/structure/page-map.json)
- 链 final-handoff.md 详情

## ⑦ 交付链接
- 🌐 live demo: <URL>
- 📊 internal audit: <link>
- 📦 handoff package: <link>
- 🤖 customer-summary 中文版: <link>
- 🤖 customer-summary English: <link>

## ⑧ 数据完整度
| 有的 | 缺的 |
|---|---|
| ✓ 核心商家信息 | ✗ 邮箱 |
| ✓ ABN active | ✗ 创始人 |
| ... | ... |

## ⑨ 后续动作 (operator)
1. 新站已 deploy · 销售可直接 outreach
2. 电话首联时问 · ...
3. M5 revision · 客户上传真实 photos
```

**Mockup**: https://customer-summaries.pages.dev/mockups/master-md.html

---

## 2 · final-handoff.md · build 视图 (OD 输入)

**目的**: 给 Open Design (Codex retex) 当 prompt input · 替代当前 master.md 作 build 输入。

**结构** (frontmatter + 9 段):

```markdown
---
business_id: "place_chij..."
build_target: "classic-premium-roftix"       # reference template family
route: "STARTER"                              # 或 REDESIGN
logo_mode: "generated"                        # 或 existing
handoff_version: "v2-cycle28"
references: [
  handoff/raw/gbp-full.json,
  handoff/raw/abn-record.json,
  handoff/content/services-list.json,
  handoff/content/about-narrative.md,
  handoff/content/faq.json,
  handoff/content/reviews/selected.json,
  handoff/content/photos/selected/,
  handoff/design/logo-generated.svg,
  handoff/design/brand-tokens.json,
  handoff/structure/page-map.json,
  handoff/audit-findings.json,
  handoff/issue-fix-matrix.json
]
---

## ① Core Facts (硬数据 · 渲染必须用)
表格:
| 字段 | 值 | 放哪里 |
| 商家名 | XXX | title · nav · hero · footer · alt |
| 电话 | XXX | nav · hero CTA · footer · tel: |
| 地址 | XXX | footer · contact · schema |
| ABN | XXX | footer · about · schema |
| QBCC License | XXX | footer · hero badge · about |
| Niche | XXX | title · meta · schema |

## ② Design System
### Logo
- mode: existing / generated
- file: <handoff/design/logo-*.svg>

### Brand Tokens
```json
{
  "primary": "#1a3d5c",      // 从 logo 提
  "accent":  "#d97706",
  "font_heading": "Inter",
  "font_body": "Inter"
}
```

### Design Style
- LLM 推断的 visual style description

## ③ Page Map (新站结构)
表格:
| 页 | URL | 目的 |
| Home | / | hero + 3 services + trust + reviews + map + CTA |
| Service 1 | /service-name | 详情 · before/after · process · FAQ |
| Area 1 | /<niche>-<area> | SEO 长尾落地页 |
| About | /about | 公司故事 + ABN + license · trust 集中 |
| Contact | /contact | form 3 字段 + tel: + map |

## ④ SEO Strategy
- 主关键词
- 长尾 target
- Schema 列表 (LocalBusiness · AggregateRating · FAQ)

## ⑤ Content Blocks
### Services (3 条 · 引用 handoff/content/services-list.json)
- 每条带描述 · niche typical 补全 · 标 [来源]

### About Narrative (LLM 综合)
- 引用 handoff/content/about-narrative.md
- 含 ABN + license + 经营年限 · 综合 review 语气

### FAQ (niche typical · 6 问)
- 引用 handoff/content/faq.json

## ⑥ Visual Assets (Photos)
- if photos/selected/ 有: 按 placement 用
- else: 标 data-od-sample="true" · 等 M5 客户上传

## ⑦ Reviews (top 3-5 selected)
- 引用 handoff/content/reviews/selected.json
- 真实 reviews 带 deep-link URL
- AI 生成 reviews 不标 placeholder (内部用)

## ⑧ Audit Issues to Fix
- REDESIGN: 列 handoff/audit-findings.json · 每条带 fix_prescription
- STARTER: "无 audit · 按 niche typical best practices 做"

### Issue-Fix Matrix
- 引用 handoff/issue-fix-matrix.json
- audit issue → 新站哪页 · 哪 section · 怎么 verify

## ⑨ Boundaries (locked · OD 不能改)
- Brand tokens · primary / accent / fonts 已锁
- Reference site structure (data-od-locked) 不改
- Sample data 标 data-od-sample="true" 可见
- 不许编造: 具体 license 号外的 · price · 团队规模 · 奖项
```

**Mockup**: https://customer-summaries.pages.dev/mockups/final-handoff.html

---

## 3 · internal-audit-report.html · 销售话术

**目的**: 销售跟客户讲"我们找了什么问题 + 怎么解决" · 用于 outreach 跟进。

**结构** (按 audit + verification 闭环):

### REDESIGN 模式 (有现网 audit)

```
<h1>Internal Audit Report · <name></h1>

① 总评
- Score / Grade / Verdict
- 5-dim scorecard 或 6-category 缺口

② Audit Findings (按 severity 分组)
- 关键 N 项 · 主要 N 项 · 次要 N 项
- 每条:
  - title + severity badge
  - evidence screenshot
  - what's observed
  - why it costs them money
  - how we fix
  - verification (新站怎么验证修了)

③ Build 后 · Verification 闭环
- 表格 · 每条 audit issue × verification 检查结果
- ✅ N/M pass

④ 销售话术 (基于 verification)
- 黄色 box · 直接拷给客户讲
- "我们找到这 N 个问题 · 已修 N 个 · 这是 angle"

⑤ Before vs After
- 双栏 · before (red) | after (green)
- 关键指标对比 (LCP / mobile score / review count / etc.)
```

### STARTER 模式 (无现网 audit)

```
<h1>Internal Audit Report · <name></h1>

① 总评
- STARTER · 无现网可 audit
- 0 原生 audit issues · 10 基线建议落实 · 10/10 build verification pass

② 说明
- STARTER 客户没网站 · 不跑 audit
- 改为列"基线必备" · build 后跑 verification 验证全部覆盖

③ Build 前 · 基线缺口 (基线表 · 8 类)
- 转化 · 信任 · 本地 SEO · SEO · 内容 · 评论 · 视觉 · 性能

④ Build 后 · Verification 闭环
- 表格 · 每条基线缺口 × verification 检查结果

⑤ 销售话术 (基于 verification)
- 黄色 box · 直接拷给客户讲

⑥ Before vs After
- 双栏: before (无网站 · 全靠 GBP) | after (新站 N 页 · 全 SEO 覆盖)
```

**Mockup**: https://customer-summaries.pages.dev/mockups/internal-audit.html

---

## 何时生成 / 何时更新

| 文档 | 第一次生成 | 后续更新 |
|---|---|---|
| `master.md` | Stage 0 后立刻 (含 core-facts) | 每 Stage 完成后 append 新段 |
| `final-handoff.md` | Stage 3 完成后 (build 决策已定) | Stage 5 后加 verification 链接 |
| `internal-audit-report.html` | Stage 2 audit 完后 (REDESIGN) · 或 Stage 3 后 (STARTER) | Stage 5 verification 完后加"Build 后" 段 |

---

## Backward-compat

| 老 entity (没 handoff/) | 新 entity (有 handoff/) |
|---|---|
| master.md 现状结构保留 (不动) | master.md 用 cycle-28 新模板 |
| build 读 master.md | build 读 handoff/final-handoff.md · fallback master.md |
| 没 internal-audit-report.html verification 段 | 含 verification 段 |

`pl-build-from-reference.js` 加 if-else:
```js
const handoffPath = path.join(client, 'v2', 'handoff', 'final-handoff.md');
const masterPath = path.join(client, 'v2', 'master.md');
const briefSource = fs.existsSync(handoffPath)
  ? fs.readFileSync(handoffPath, 'utf8')
  : fs.readFileSync(masterPath, 'utf8');  // backward-compat
```
