# SOP-2 · V2 Lead Discovery → Audit → Graduation 完整流程

**这份文档是 V2 此条业务流的唯一 source of truth。**
**配套页面**: `/admin/scoring` （macro overview — 概览看这里；细节看本文档）
**当前 maintain status**: ✅ active，2026-05-12 重写
**协议**: 任何流程变动 **必须同时改这份文档 + admin/scoring 页**

---

## 0. 一句话总结

> 从一个搜索 query（如 "roofing sydney"）开始，**抓 lead → 评分分流 → audit / 起步 / 跳过 → A/B 客户 graduate 到销售 thread → 全程在 Discord lead-discovery-runs forum 一个 thread 看进度**。每个 lead 最终成为可销售的 audit report 和 master.md，A/B 自动开个人 thread 销售跟进。

---

## 1. 4-channel Discord 生命周期架构

V2 的核心思想：**lead 生命周期分 4 段，每段对应一个 Discord channel，channel 之间用"graduation"机制串起来**。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEARCH TASK (SOP-1, 单独维护)                             │
│            gosom Docker scraper 抓 "roofing sydney" 等 query                  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ 产出 N 个 lead 候选
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  #lead-discovery-runs  (forum, ID 1503513633756283070)                       │
│  ────────────────────────                                                    │
│  用途   batch ops 视图 — 监督发现 + 评分 + 审计                                │
│  单位   1 batch task = 1 forum thread                                        │
│  Tag    in-progress / paused / completed / partial-failed /                  │
│         retry-pending / aborted                                              │
│  受众   你 + AI agent（运营监督）                                              │
│  阶段   Stage 0 (Discovery) → Stage 1 (Rescore) → Stage 2 (Detailed audit    │
│         + visual + grade + reviews + report) → Stage 3 (Master MD) →         │
│         Stage 4 (Entity ↔ artifact linkage)                                  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ A/B grade (~ "可成交"客户) 自动 graduate
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  #website-leads  (forum, ID 1501187038706401290)                             │
│  ────────────────────────                                                    │
│  用途   per-lead CRM 视图 — 销售对话 + audit 引用                              │
│  单位   1 A/B lead = 1 forum thread                                          │
│  Tag    awaiting / outreach-active / replied / proposal-sent / nurture /     │
│         paid / archived / needs-human                                        │
│  受众   销售人员                                                               │
│  内容   audit summary card + outreach 邮件 / SMS / phone 历史                 │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ 客户表示有兴趣，想看 demo / proposal
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  #website-projects  (forum, ID 1501945763650080899)                          │
│  ────────────────────────                                                    │
│  用途   demo / proposal 制作追踪                                              │
│  单位   1 demo 候选 = 1 thread                                                │
│  内容   Open Design 输出 / 全新网站 demo / 已有网站改版 demo                  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ 客户付费
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  #paid-websites  (forum, ID 1503529874336383137)                             │
│  ────────────────────────                                                    │
│  用途   付费客户生产部署 + ongoing 维护                                        │
│  单位   1 付费客户 = 1 thread                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**为什么是 4 个不是 1 个**：每 channel 的 **cadence（节奏）/ audience（受众）/ SLA 都不同**。
- batch 节奏 vs per-lead 节奏 vs project 节奏 vs 客户节奏
- 监督 vs 销售 vs 设计 vs 客服
- 不能放一起，会乱

**SOP-2 涵盖的范围 = 前 2 个 channel + 它们之间的 graduation**。`#website-projects` 和 `#paid-websites` 是 SOP-3 / SOP-4 范围（未写）。

---

## 2. 5-stage 完整流程图（pipeline 视角）

每个 batch run 严格走这 5 个 stage，每 stage 在 `#lead-discovery-runs` 的 batch thread 推一条进度。

```
═══════════════════════════════════════════════════════════════════════════════
  Stage 0  DISCOVERY · 把候选 lead 写进 entity store
═══════════════════════════════════════════════════════════════════════════════

  Entry source (V2 主用):  gosom Google Maps Scraper (Docker container)
  Container:               localhost:8080  ·  image: gosom/google-maps-scraper
  Mount:                   data/maps-scraper/webdata → /gmapsdata
  API:                     POST /api/v1/jobs · GET /jobs/{id}/download (CSV)
  CLI:                     pl:scrape-docker --query "roofing sydney"
                           --niche roofing --city sydney --batch-id <id>
                           --max-time 240 --limit 20  (待建, ~80 行 bridge 脚本)
  Cost:                    T0 (本地免费, gosom Docker)

  Pipe:
    POST /api/v1/jobs  →  poll  →  download CSV  →  parse  →
      buildMapsScraperDiscoveryRun (现有)  →  upsertDiscoveryRun (现有)  →
      buildDiscoveryQueues (现有)

  Output:
    data/leads/entities/place_*.json × N        (V2 entity, 含 status)
    data/leads/discovery-events.jsonl           (审计轨迹)
    data/leads/discovery-index.json             (去重索引)
    data/leads/queues/{queues, cheap-site-audit,
                      selected-enrichment, outreach-brief}.json

  UI:                      /admin/v2-queue 显示 discovery funnel
  Batch thread post:       "✅ Stage 0 Discovery — N leads scraped..."

═══════════════════════════════════════════════════════════════════════════════
  Stage 0.5  ENRICHMENT (conditional · 只对 thin-contact lead 触发)
═══════════════════════════════════════════════════════════════════════════════

  触发条件: lead 没真网站 AND 没 phone （cheap-audit-v2 输出
            action='queued_for_enrichment'）
  CLI:      (没有独立 CLI; 自动通过 rescore-v2-cli 的缓存查找; 或手动
             调 core/leads/enrichment.js 的 enrichLead)
  Cost:     T0 (Tinyfish free + DDGS free fallback)

  5 路并行 search：
    1. 官方 URL                    (lead 可能 GMB 没挂网站但实际有)
    2. Facebook handle
    3. Instagram handle
    4. LinkedIn handle / decision-maker name
    5. 3rd-party review aggregators (hipages/yelp/productreview/truelocal/houzz)

  Output:                  data/v2/fixtures/enrichment/<entityKey>.json
  Re-judge:                cheap-audit-v2 重新跑，使用 enrichment 数据再分流

═══════════════════════════════════════════════════════════════════════════════
  Stage 1  V2 RESCORE · cheap-audit-v2 → 分 5 路
═══════════════════════════════════════════════════════════════════════════════

  CLI:        npm run rescore-v2-cli -- --niche roofing
              (现有, 跑全 niche 下所有 entity)
  代码:        core/scoring/cheap-audit-v2.js + cheap-audit-config.json
              (9 GBP triage 规则 + 10 site quick-scan 启发式 = 19 项)
              注: ✅ 已提到 config (2026-05-12) — 9 条 GBP rules + 10 条
              site quick-scan 启发式均在 cheap-audit-config.json 声明；
              site-quick-scan.js 仅承载 detection logic，weight/severity 从 config 读取。
              UI 可视化由 /admin/scoring/sop-2 直接渲染 config.stages.*.rules。
  Cost:       T0 (本地脚本) + 可选 T0 (Tinyfish quick-scan if fetchSites=true)

  逻辑:
    Stage 1: GBP triage (9 规则, max 100 = gbp_quality)
             category 不匹配 → SKIP (hard)
    Stage 2: Site quick-scan (only if has_website + fetchSites=true)
             10 redesign 启发式 (max 100 = redesign_need)
    Hard triggers (5 条 override 规则):
      1. no_website_with_contact      → audit_candidate
      2. missing_https_with_evidence  → audit_candidate
      3. high_traction_old_site       → audit_candidate
      4. niche_mismatch               → skip (在 decideAction 而非 config)
      5. third_party_landing_page     → audit_candidate (在 decideAction)
    Final:   gbp_quality × 0.4 + redesign_need × 0.6 → 阈值映射

  输出 action (5 种):
    audit_candidate       →  Stage 2 mainline (跑 detailed audit)
    starter_candidate     →  Stage 2-Starter (跳过 audit, 卖新站)  ⚠
    queued_for_enrichment →  返回 Stage 0.5 (找 contact)
    manual_review         →  操作员决定 (30-69 分 / edge case)
    skip                  →  归档 (<30 / wrong niche)

  Output:     data/v2/fixtures/rescore/<niche>-<ts>.json (含所有 lead 的
              v2.action + final_score + fired_triggers + reason)

  Batch thread post:       "✅ Stage 1 Rescore — N audit / N starter /
                            N manual / N skip"

  ⚠ STARTER_CANDIDATE PATH 当前未完全自动化（见 §6 容易忽略的点）

═══════════════════════════════════════════════════════════════════════════════
  Stage 2  AUDIT MAINLINE · detailed audit + visual + grade + reviews + report
═══════════════════════════════════════════════════════════════════════════════

  CLI:    npm run leads:run-pipeline -- --all-audit-candidates
          --with-reviews --refetch
          (现有, 一锤子跑完每 lead 的 4 段)

  每个 lead 顺序跑：

    Step A: siteFetchFull (Playwright 一次访问, 并行 11 个 sub-audit)
       Stage 2a  site fetch         Playwright headless chromium
       Stage 2b  tech_stack         wapalyzer-style regex
       Stage 2c  form_audit         真去 Playwright submit 表单
       Stage 2d  image_optimization rawHtml 解析
       Stage 2e  trust_signals      rawHtml heuristics
       Stage 2f  third_party_weight Playwright request 拦截
       Stage 2g  sitemap_analysis   HTTP fetch /sitemap.xml /robots.txt
       Stage 2h  ai_geo             LLMS.txt + JSON-LD AI-search readiness
       Stage 2i  pagespeed (PSI)    Google PSI API (T2 free 25k/day)
                                    → 真实 CrUX LCP / CWV / FCP / INP / TTFB
       Stage 2j  domain_history    WHOIS lookup (T2)
       Stage 2k  activity          rawHtml + GBP signals

    Step B: detailedAudit (6 dim × 34 rules → audit_score, dimension_scores,
            decision, hard_triggers, issues)
            注: gbp=8 + technical=7 + ux_conversion=7 + content=6 + seo=5
            + visual=1 (stub, 4 条待补 — backlog SOP-2 §11).
            5 个 hard triggers: no_website / mobile_broken / no_https /
            no_visible_cta_or_phone / high_traction_old_site
            4 档 decision 阈值: 0-49 strong_redesign · 50-64 moderate_candidate
            · 65-79 low_priority · 80-100 not_qualified
            Output: data/v2/fixtures/detailed-audit/<key>.json

    Step C: Visual audit (claude_cli vision → codex_cli → ollama fallback)
            Output: data/v2/fixtures/visual-autoresearch/pipeline/<cand>/<key>.json

    Step D: gradeLead + persistLeadGrade
            → entity.grade {investment_level, product_tier, recommended_pricing,
              skip_reasons, graded_at}
            → entity.phase 转换:
                - A/B → AWAITING (准备进入销售对接)
                - C → 不动 phase (走批量轻触，不开 per-lead thread)
                - D → ARCHIVED
            → if A/B: fire-and-forget 调 openLeadThread →
              GRADUATE to #website-leads (entity.discord_thread_id +
              discord_profile_message_id)  ⭐

    Step E: Spawn build-internal-report --entity-key X --with-reviews
            → 跑 review mining (Google Places + Ollama 分析) (A/B only)
              Output: data/v2/fixtures/reviews/<key>.json
            → 跑 evidence capture (per-issue Playwright 截图 + mobile-throttled
              webm 视频)
              Output: clients/<slug>/v2/{evidence/, video/, screenshots/}
            → 渲染 internal-audit-report.html
              Output: clients/<slug>/v2/internal-audit-report.html
                      + public/audit-reports/<key>/internal-audit-report.html

  Cost:                    T0 (Playwright local) + T2 (PSI free 25k/day +
                           WHOIS) + T1 (claude_cli subscription for vision)
  Per-lead 耗时:            ~30-60s detailed + ~20-30s visual + ~30s report
                           = ~90s total/lead (sequential)
                           10 leads → ~15 min total

  Batch thread post (Stage 2 大段):
    "✅ Stage 2 Audit + Grade + Report — done
     Grade dist: A=N B=N C=N D=N
     LCP measured: N/N · CWV: N/N · form: N/N ok
     Graduated to #website-leads:
       [A] <name> → <thread_url>
       [B] <name> → <thread_url>
     Staying in batch thread (C/D, no per-lead thread): N"

═══════════════════════════════════════════════════════════════════════════════
  Stage 3  MASTER MD · 销售素材源头
═══════════════════════════════════════════════════════════════════════════════

  CLI:                     npm run leads:build-master-md -- --all-with-detailed
                           (现有)
  代码:                     scripts/leads/build-master-md.js +
                           core/reports/master-md-builder.js
  Cost:                    T0 (本地模板渲染, 无 LLM)

  作用:                     **每个 lead 的 master.md 是 source of truth**;
                           HTML 报告 / 视频 / slides 都从这里衍生
  内容:                     YAML frontmatter (business meta + audit_score +
                           grade + fired_triggers + visual fields + assets)
                           + 中文销售导向叙述（投入分级 / 产品档位 / 推荐报价
                           / issue 解读 / redesign blueprint）

  Output:                  clients/<slug>/v2/master.md (~400 行 / lead)

  Batch thread post:       "✅ Stage 3 Master MD — built N/N"

═══════════════════════════════════════════════════════════════════════════════
  Stage 4  ENTITY ↔ ARTIFACT LINKAGE (F5)
═══════════════════════════════════════════════════════════════════════════════

  CLI:                     pl:entity-link-reports --batch-id <id>
                           (待建, ~30 行)
  代码:                     scripts/cli/pl-entity-link-reports.js (新)

  作用:                     entity JSON 加 audit_reports.internal 字段，把
                           HTML 报告 / public URL / master.md 路径 / audit
                           version 显式记录到 entity，admin UI 不再靠 slug
                           推导。

  写入字段:
    entity.audit_reports.internal = {
      html_path:    "clients/<slug>/v2/internal-audit-report.html",
      public_url:   "/audit-reports/<entityKey>/internal-audit-report.html",
      master_md:    "clients/<slug>/v2/master.md",
      audit_version: "<detailed-audit version>",
      built_at:     "<ISO timestamp>"
    }
    entity.batch_id = "<pipe-niche-city-YYYYMMDDHHmm>"   ← 新 V2 字段

  Batch thread post:       "✅ Stage 4 Linkage — N/N entities linked"
                           "🎉 Batch complete — tag swap → completed"
```

---

## 3. cheap-audit-v2 算法（Stage 1 决定后续走哪条路）

### 3.1 5 种 action 输出 → 5 种后续路径

| action | 触发条件 | 后续走哪 | 销售物料 |
|---|---|---|---|
| **audit_candidate** | 有真网站 + final ≥ 70（或 hard trigger lift） | Stage 2 mainline (detailed audit + visual + grade + report) | redesign 提议（基于 audit findings）|
| **starter_candidate** | 无真网站（含 billdu.me 类 3rd-party landing）+ reachable + gbp_quality ≥ 30 | **Stage 2-Starter**（卖新站，不审旧站）⚠ 当前未自动化 | "We'd build you a new website"（不依赖 audit findings）|
| **queued_for_enrichment** | 无网站 + 无 phone | 回 Stage 0.5 enrichment | （先补 contact 再判）|
| **manual_review** | final 30-69 / 边缘 case | 操作员手动决定 | （case-by-case）|
| **skip** | wrong niche / final < 30 | 归档 | （无）|

### 3.2 决策树

```
                            cheap-audit-v2
                                  │
                  ┌───────────────┼───────────────┐
              category 不匹配         ▼          其他
              → SKIP               Stage 1 GBP triage (9 规则, max 100 = gbp_quality)
                                       │
                            hasWebsite?
                       ┌────────┴────────┐
                       ▼ NO              ▼ YES
            reachable?                Stage 2 quick-scan
              ▼                        (10 启发式, max 100 = redesign_need)
            ┌──┴──┐                          │
           YES   NO                          ▼
            │     │                  Hard triggers (4 条)
            │     ▼                   no_site+reachable → starter
            │   queued_for_           HTTP+reviews≥50 → audit
            │   enrichment           reviews≥100 ★≥4.5 → 抬升 floor
            │   (Stage 0.5)
            │                                │
            ▼                                ▼
    gbp_quality ≥ 30?              final = gbp×0.4 + redesign×0.6
      ▼          ▼                          │
      YES        NO                ┌────────┼────────┬────────┐
       │         │                 ▼        ▼        ▼        ▼
   starter   manual_review       ≥70     50-69    30-49    <30
   candidate                  audit_     manual_   manual_   skip
                              candidate  review    review
```

### 3.3 Hard triggers（5 条 override）

| Trigger | 条件 | 强制 action |
|---|---|---|
| `niche_mismatch` | category 不含 niche 关键词 | SKIP (hard) |
| `third_party_landing_page` | website host 在 billdu.me/sites.google.com 等 3rd-party | starter_candidate (if reachable+gbp≥30) |
| `no_website_with_contact` | no_website + reachable + gbp_quality ≥30 | starter_candidate |
| `missing_https_with_evidence` | site reachable 但无 HTTPS | audit_candidate |
| `high_traction_old_site` | reviews ≥100 + ★≥4.5 | 抬升 floor（不会降到 skip / manual_review） |

---

## 4. 评分 + Grade × Tier 矩阵（Stage 2 输出 → 销售物料决定）

经过 Stage 2 detailed audit + lead grading，每个 lead 拿到：

### 4.1 Investment level (A/B/C/D) — 决定**销售投入度**

| Level | 标签 | 触发条件 | 销售动作 |
|---|---|---|---|
| **A 全攻** | strong_redesign + reviews ≥ 30 + ★≥3.5 + 非全管型 | 完整 OD redesign + 个性化邮件 + 报告 + 3 次跟进 |
| **B 预览试探** | moderate_candidate + reviews ≥30 + audit < 75, OR strong_redesign 弱口碑, OR **starter_candidate 有口碑** | ChatGPT Image 生成 hero 预览 + 1 personalized 邮件 + 1 跟进 |
| **C 批量轻触** | low_priority, OR moderate 弱信号, OR **starter 无口碑** | 标准模板邮件 + master.md PDF 链接, 无跟进 |
| **D 跳过** | 命中任一 hard skip 条件 | 不投入 |

**Hard skip 8 条规则** (`core/scoring/lead-grading.js#HARD_SKIP_RULES`):

| ID | 条件 |
|---|---|
| `niche_mismatch` | category 不含 niche 关键词 |
| `recent_redesign` | 域名 < 6 月 + 现代化技术栈 |
| `enterprise_size` | 100+ pages 或 enterprise indicators |
| `too_many_pages` | sitemap > 80 pages |
| `too_many_categories` | GMB categories > 5 |
| `relevance_fail` | cheap-audit relevance_pass = false |
| `fully_managed` | 全管型代理 (signal: corporate footer / brand-owned) |
| `not_qualified_decision` | detailed-audit decision = `not_qualified` (score ≥ 80) |

**关键洞察 1**: starter_candidate 也能拿 B/C 级，**也走 lead-grading**。

**关键洞察 2 (C 类的 Discord 处理)**: C 类 **不** 自动开 per-lead thread（避免 channel 灾难）。
- A/B → 自动开 thread 在 `#website-leads` (apply tag `grade-a` / `grade-b`)
- C → 批量轻触（标准模板邮件，在 `#lead-discovery-runs` batch thread 汇总记录）
- **C 一旦回复表达意向** → **手动**晋升：开 thread 在 `#website-leads` + apply `grade-c` tag
- `core/funnel/lead-thread-sync.js#L62` 的 `grade-c` tag 服务的就是这个手动晋升场景（USP 三分支里 C 的"看意向 → 反向预制"路径），不是孤儿代码。

### 4.2 Product tier (T1/T2/T3) — 决定**销售报价**

**V2 productized pricing**（2026-05-11 锁定, 匹配 profitslocal.com live）：

| Tier | 标签 | 触发信号 | 报价 | 包含 |
|---|---|---|---|---|
| **T1** | 1-page (build-and-launch) | 评论 < 30 / 无独立网站 / sitemap < 15 / 单业务分类 / 数字成熟度 < 2 | **$399 一次性** | 1-page · 3 revisions · hosting permanently · subdomain or custom domain (CNAME) |
| **T2** | 1-page + annual maintenance | 中等口碑 30-150 / 多业务分类 / sitemap 15+ / 看到 ongoing 关系 appetite | **$799/年** | 1-page · 12 revisions/yr · monthly maintenance · local SEO cleanup · domain setup |
| **T3** | 多页 / 定制 | 强口碑 ≥ 100 ★≥4.3 + 投过广告/GA4 + 数字成熟度 ≥ 4 + Blog 缺失/停滞 + 复杂业务 | **$1000+ 定制报价** | Multi-page · custom build · quote separately (profitslocal.com FAQ anchor) |

### 4.3 Add-on（跨所有 tier）

| Add-on | 报价 | 适用 |
|---|---|---|
| Extra revision | $100 / revision | T1 (3 之后) · T2 (12/yr 之后) |
| Custom sender domain email setup | $150 一次性 | Any tier |

### 4.4 Investment × Tier 组合实例

| 实例 lead | Grade | Tier | 报价 |
|---|---|---|---|
| 127 reviews ★5, http:// billdu.me, 数字成熟度 3, 投过广告 | A | T3 | $1000+ 定制 |
| 50 reviews ★4.7, 无网站, reachable | B | T1 | $399 一次性 |
| 35 reviews ★4.5, 简单 5-page site, sitemap 12, single category | C | T1 | $399 一次性 |
| 80 reviews ★4.8, 现有 30-page site, 数字成熟度 4 | B | T2 | $799/年 |

---

## 5. 销售 graduation 机制（A/B → #website-leads）

**触发点**: `core/scoring/lead-grading.js:341` 的 `persistLeadGrade()`：

```js
if ((grade.investment_level === 'A' || grade.investment_level === 'B')
    && !process.env.SKIP_LEAD_THREAD_OPEN) {
  import('../funnel/lead-thread-sync.js').then(async ({ openLeadThread }) => {
    await openLeadThread(entityKey);
  });
}
```

**这是 fire-and-forget**, 不会阻塞 pipeline。如果失败，错误 log 但 grade 仍然落地。

**Graduate 过程**：
1. `openLeadThread(entityKey)` 调 Discord API `POST /channels/<#website-leads>/threads`
2. 创建 forum post (thread)，apply tag = `phase:<entity.phase>`（默认 `awaiting`）
3. 第一条 message = profile card (business meta + grade + audit summary)
4. 回写 `entity.discord_thread_id` + `entity.discord_profile_message_id`

**幂等**: 如果 `entity.discord_thread_id` 已存在，复用，不重开。

**C/D 不 graduate**: 没开发价值，留在 batch thread 里作为 archive（以后可能 upsell）。

---

## 6. 容易忽略的点（核心 gotchas）

### 6.1 ⚠ starter_candidate 当前未完全自动化

cheap-audit-v2 输出 `starter_candidate` → 但是：
- run-audit-pipeline 的 `--all-audit-candidates` 过滤器是 `v2.action === 'audit_candidate' && website` → **不会处理 starter**
- 没有 `--all-starter-candidates` 类似的 CLI

**当前手动 workaround**:
1. 看 rescore fixture 找出 starter_candidate leads
2. 手动跑 gradeLead（输入 cheapAudit + reviews + size signal，无 detailedAudit）
3. 手动跑 master MD（starter 路径模板）

**Roadmap**: 建 `pl:promote-starters` CLI 自动化这条路。

**本批 roofing/sydney 影响**: 20 lead 100% 有真网站 → 不会触发，可忽略。但 dental / restaurant 等 niche 会有不少 starter，需要这条路径。

### 6.2 ⚠ entity.audit_reports.internal 字段当前不存在

历史 V2 entity 没有 `audit_reports` 字段，admin UI（v2-leads / per-lead detail）按 `clients/<slug>/v2/internal-audit-report.html` 约定推导报告路径。

**风险**: slug 重命名 / 目录重组 → 关联断裂，admin UI 显示 broken link。

**修复**: Stage 4（F5 entity-link-reports CLI）写这个字段。**所有新 batch 必须跑 Stage 4**。

### 6.3 ⚠ pagespeed (PSI) 之前因 env key 缺失，所有 LCP/CWV 为 0

历史上有一段时间 `PAGESPEED_API_KEY` 不在 `.env.local`，导致所有 detailed-audit fixture 标 `data_missing: true`，technical 维度被人为压低 40 分。

**当前**: PSI key 已落 `.env.local` (2026-05-11 14:55)。新 batch 都会拿到真数据。

**老 fixture (5/11 09:05 之前)**: LCP/CWV 全 0。如需精确报告，要 `--refetch` 重跑 detailed audit。

### 6.4 ⚠ run-audit-pipeline 一锤子跑完不能 pause

`run-pipeline --all-audit-candidates` per lead 顺序跑 detailed → visual → grade → report，**中间不能停**。要 pause 只能在所有 lead 跑完 Stage 2 之后。

**含义**: pause 节奏 = 5 个（Stage 0 / Stage 1 / Stage 2 / Stage 3 / Stage 4），不是 9 个。

### 6.5 ⚠ Stage 2 evidence capture 占 99.96% 时间

10 lead 跑下来 ~5 分钟，其中 99.96% 是 Playwright per-issue 截图 + mobile-throttled 视频录制。**对 1000 leads 不可线性扩展**。

**优化路线**: 见 [REPORT_BUILD_OPTIMIZATION.md](v2/REPORT_BUILD_OPTIMIZATION.md) — OPT.P0-P4。80 leads 时触发 worker-pool 并行化。

### 6.6 ⚠ Discord rate limit (50 req/s/route)

一次 batch 推 10+ stage update + 预 graduation 时一次开 N 个 thread = burst 容易撞 rate limit。

**当前**: pl:pipeline-batch-step 没有 retry-after backoff。可能 429。

**Roadmap**: 加 exponential backoff in `core/funnel/pipeline-batch-thread.js`。

### 6.7 ⚠ niche 过滤是 substring match（不严）

rescore-v2-cli 过滤 `cat.includes('oof')` for roofing → 任何含 "oof" 的 category 都进。

**风险**: "Roofing & Plumbing" 进。"Roof rack manufacturer" 进。"Roofer's bar"（虚构）也进。

**当前 mitigation**: cheap-audit-v2 内部还有 `relevance_pass` 校验 niche 匹配，不通过 → SKIP hard。

### 6.8 ⚠ 价格三处一致是新规则（这次刚对齐）

历史上：
- profitslocal.com 显示 $399/$799
- SCALING_AND_PRICING.md 锁 $399/$799  
- 代码 PRODUCT_TIER_TABLE 写 $1.5-3K / $3-6K / $5-8K （**老价格**）
- master.md frontmatter 印 "$5-8K + $800-1500/月" （从代码取的）

**2026-05-12 修复**: PRODUCT_TIER_TABLE 已对齐 $399 / $799/年 / $1000+。

**含义**: 新 batch 跑出来的 master.md 会显示新价格。**老 master.md 需要重生成才会更新**（不是自动）。

### 6.9 ⚠ Master MD 是销售素材**唯一**源头

很多新人以为 HTML report 是源头。错。

**正确**: master.md = source of truth → huashu-md-html 衍生 HTML proposal → hyperframes 衍生视频 + slides。

**任何 master.md 编辑必须重新 build 下游产物**。

### 6.10 ⚠ batch_id 字段需要 Stage 0 写入

V2 新加的 `entity.batch_id` 字段必须在 Stage 0 discovery 时写入（每个 lead 都 tag 上当前 batch）。`pl:scrape-docker` bridge 脚本需要把 `batch_id` 透传到 lead object → `mergeLeadIntoEntity` → entity store。

**当前 mergeLeadIntoEntity 不支持 batch_id**：需要小补丁（待做）。

---

## 7. CLI 全集

### 7.1 V2 白名单 (推荐使用)

| CLI | Stage | 状态 | 用途 |
|---|---|---|---|
| `pl:scrape-docker` | 0 | ⚠ 待建 | gosom Web API → entity store |
| `pl:preflight` | (跑前) | ⚠ 待建 | 健康检查 (Docker / PSI / Discord / claude_cli / ollama / 磁盘) |
| `rescore-v2-cli` | 1 | ✅ 现役 | cheap-audit-v2 → 分 5 路 |
| `leads:run-pipeline --all-audit-candidates --with-reviews --refetch` | 2 | ✅ 现役 | 一锤子 detailed + visual + grade + report |
| `leads:build-master-md --all-with-detailed` | 3 | ✅ 现役 | per-lead master.md |
| `pl:entity-link-reports` | 4 | ⚠ 待建 | F5 写 entity.audit_reports.internal |
| `pl:pipeline-batch-start` | (batch 启动) | ✅ 现役 | 建 batch forum thread |
| `pl:pipeline-batch-step` | (每 stage) | ✅ 现役 | 推 progress message + tag swap |

### 7.2 V1 / Legacy（不要照抄使用）

- `core/leads/intake.js`, `research.js`, `lead-ops.js` — V1 paths
- `leads:search-runner` — Google Places paid API（写死禁用）
- `extract:google-places` — 同上
- `image-lead-discovery.js` — 单 lead 流程，不批
- `promote-discovery-run.js` — V1 promote 路径

---

## 8. Pause-and-resume 协议

每 stage 完成后操作员看 Discord batch thread 状态，决定继续 / 暂停 / 中止。

```
                   stage CLI 执行
                          │
                          ▼
                  推 progress 到 batch thread
                          │
                          ▼
                     操作员 review
                ┌─────────┼─────────┐
                ▼         ▼         ▼
            继续        暂停       中止
            │            │          │
            │     swap-tag paused   swap-tag aborted
            │            │          │
            │     fix / re-judge    finalize
            │            │
            │            ▼
            │       swap-tag in-progress
            │            │
            └────────────┘
                          ▼
                  next stage CLI
```

**Pause 时的 check list**（每 stage 都跑一遍）：
- [ ] CLI exit 0?
- [ ] 文件系统：fixture 写盘 (`ls data/v2/fixtures/.../<key>.json`)
- [ ] Admin UI: `/admin/v2-queue` 状态 / `/admin/v2-leads` 数量
- [ ] Discord: batch thread 收到 update message; A/B 已 graduate
- [ ] 关键 metric: LCP / CWV / grade 分布
- [ ] 抽 1-2 lead 详细看（不抽，不 review）

---

## 9. 失败处理 + retry queue

| 失败级别 | 描述 | 应对 |
|---|---|---|
| 单 lead 单 stage | PSI timeout / Playwright crash / 站点 403 | 写进 batch state.issues → mark retry_planned → 继续剩下 |
| 单 stage 全失败 | 全 N lead 都败 | pause batch, 查 root cause, fix, resume |
| 致命 | Docker 死 / Discord bot revoke / PSI quota 用尽 | 立即 pause, swap-tag paused, 修后用相同 batch-id resume |

**retry CLI**（当前手动）:
```bash
npm run leads:run-pipeline -- --entity-key <failed_key> --refetch
npm run pl:pipeline-batch-step -- --batch-id <id> \
  --stage "Retry: <name>" --status ok --summary "..."
```

**Roadmap**: 建 `pl:retry-failed --batch-id <id>` 自动遍历 issues 列表。

---

## 10. 每 batch deliverables checklist

batch 标 `completed` 前**必须**全部 ✓：

- [ ] N 个目标 lead 都有 `data/leads/entities/<key>.json`
- [ ] N 个都有 `entity.batch_id` 字段对应本批
- [ ] 所有 audit_candidate lead 都有 detailed-audit fixture（LCP / CWV 非 null）
- [ ] 所有 audit_candidate 都有 visual_audit fixture
- [ ] 所有 audit_candidate 都有 grade
- [ ] A/B grade leads 都有 reviews fixture
- [ ] 所有 audit_candidate 都有 internal HTML report (clients/<slug>/v2/internal-audit-report.html)
- [ ] 所有 audit_candidate 都有 master.md
- [ ] 所有 N 个 entity 都有 `audit_reports.internal` 字段 (F5)
- [ ] A/B 都有 Discord per-lead thread (entity.discord_thread_id 非 null)
- [ ] batch thread tag = `completed`
- [ ] batch state.issues = [] OR 所有 issue 都 `retry_planned: true`

**partial-failed** 允许标完成，但 retry plan 必须写明。

---

## 11. 维护规则

**改了流程 = 同时改这份文档 + admin/scoring 页**。

### 11.1 何时改文档

| 触发 | 要改的 section |
|---|---|
| 加 / 拆 stage | §2 + §10 |
| 改 CLI 名 / 参数 | §7 |
| 改 cheap-audit-v2 action 集合 | §3 |
| 改 grade / tier 表格 | §4 |
| 改 pricing | §4.2 + `core/scoring/lead-grading.js` PRODUCT_TIER_TABLE + profitslocal.com homepage 同步 |
| 改 Discord channel | §1 |
| 新发现 gotcha | §6 加一条 |

### 11.2 何时改 admin/scoring 页

任何 §1-§7 改动都同步到 admin/scoring。**页面是 macro view，看完知道大局**；细节才回查文档。

### 11.3 Decision records（不删，标 REVISED 加注释）

| ID | 决策 | 日期 |
|---|---|---|
| **D-SOP2-1** | 4 channel 分层（discovery batch / website-leads / website-projects / paid-websites） | 2026-05-12 |
| **D-SOP2-2** | discovery batch channel 用 forum type (type 15) | 2026-05-12 |
| **D-SOP2-3** | 6 个 forum tag = lifecycle 状态, 不混 niche/city tag | 2026-05-12 |
| **D-SOP2-4** | Pause = 5 个（每 stage 后），不是 9 个 | 2026-05-12 |
| **D-SOP2-5** | C/D 不 graduate to #website-leads（archive 在 batch thread） | 2026-05-12 |
| **D-SOP2-6** | gosom Docker Web API = V2 主入口（不用 Google Places paid API） | 2026-05-12 |
| **D-SOP2-7** | starter_candidate 有 sub-pipeline 但当前未完全自动化（roadmap） | 2026-05-12 |
| **D-SOP2-8** | V2 pricing 锁定 $399 / $799年 / $1000+ 定制，对齐 profitslocal.com | 2026-05-12 |
| **D-SOP2-9** | master.md = source of truth, HTML/video/slides 都从此衍生 | 2026-05-12 |
| **D-SOP2-10** | entity.audit_reports.internal = 显式关联字段（不靠 slug 推导） | 2026-05-12 |

---

## 12. 版本历史

- **v0.1** (2026-05-12) — 初稿
- **v0.2** (2026-05-12) — Action-first rewrite
- **v1.0** (2026-05-12) — 完整版作为 source of truth，对齐 profitslocal.com 真实 pricing，加 4-channel + 5-stage + gotchas + maintenance protocol

---

## 13. 相关文档

| 文档 | 范围 |
|---|---|
| [SCALING_AND_PRICING.md](v2/SCALING_AND_PRICING.md) | Pricing 锁定 + Pages slot 瓶颈 |
| [REPORT_BUILD_OPTIMIZATION.md](v2/REPORT_BUILD_OPTIMIZATION.md) | OPT.P0-P4 优化路线 |
| [ENRICHMENT_ROUTING.md](v2/ENRICHMENT_ROUTING.md) | Stage 0.5 enrichment 5 路 search 详情 |
| [AUDIT_REPORT_SCHEMA.md](v2/AUDIT_REPORT_SCHEMA.md) | detailed-audit fixture schema |
| [V2_UPGRADE_PLAN.md](v2/V2_UPGRADE_PLAN.md) | V2 整体升级背景 |
| [BACKLOG.md](v2/BACKLOG.md) | V2 backlog tasks |
| `/admin/scoring` (page) | SOP-2 macro overview |

---

**这份文档 + `/admin/scoring` 页 = V2 lead pipeline 唯一 source of truth。**
**改动任一方，必须同步改另一方。**
