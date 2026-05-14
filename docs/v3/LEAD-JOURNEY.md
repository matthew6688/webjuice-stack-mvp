# V3 · Lead 旅程图 · 从进入到网站准备就绪

> **作用域**: 单个 lead 从首次进系统 → 分类 → 评分 → 分级 → 决策 → 网站就绪。
> **不在范围**: outreach (M4) · 购后 (M5) · M3 网站生成步骤本身。
> **目的**: Operator 一眼看懂每个 lead 在哪、为什么在那、下一步怎么走。
> **owner**: 跨 M1+M2 的 lifecycle 视图 · 与 PRD/SOP-FLOW 互补 (那些是模块视角 · 本 doc 是 lead 视角)。

---

## 0. TL;DR · 漏斗一屏

```
进 100 个 lead
      ▼
[Gate 1] Intake 分类 → niche/city 识别                  ───→ 转人工 (~5%) → human-tag thread · 等 ✅
      ▼ ~95 通过
[Gate 2] Dedup 判重 → 8-key 评分                        ───→ 合并到 canonical (~30-50%) · entity history 累加
      ▼ ~50-70 fresh
[Gate 3] discoveryScore (M1-D2 unified)
      ▼
[Gate 4] cheap-audit-v2 (Tinyfish + 10 规则)             ───→ relevance_fail → D archive (~10-20%)
      ▼ ~40-60 进入深度 audit
[Gate 5] detailedAudit (Playwright + 12 dim 39 rules)
      ▼
[Gate 6] visualAudit (LLM vision · cascade)
      ▼
[Gate 7] 8 个 hard-skip 规则                             ───→ D auto-archive (~30-50%)
      ▼ ~20-30 进入分级
[Gate 8] Grade A/B/C/D 决策
      ▼
[Gate 9] Product Tier T1/T2/T3 (A/B/C only · D跳过)
      ▼
[Gate 10] grade-router 路由
      ▼
A/B → Discord forum thread (sales 直接接)
C   → Discord forum thread + cold-outreach-queue
D   → ARCHIVED + archive_reason
      ▼
A/B/C 实际进入网站 demo build (M3)
      ▼ ~10-15% 原 100 个 lead 最终被做了 demo
```

**真实数据 (10 个 roofing 客户的 audit 状态)**：
平均 audit 70 / visual 4-7 / evidence 6-10 / reviews 35-221 / photos 6。10/10 全部进入 M3 demo build。

---

## 1. Entity Phase 状态机

**位置**: `core/leads/discovery-store.js#ENTITY_PHASE`

```
                       ┌──────────────┐
                       │ AWAITING     │  ← intake 默认 · 等 audit
                       └──────┬───────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼ (A/B/C graded)     ▼ (D)                ▼ (人工干预)
  ┌──────────────┐    ┌──────────────┐     ┌──────────────┐
  │ OUTREACH_ACTIVE│   │ ARCHIVED     │     │ NEEDS_HUMAN  │
  │ (M4 启动后)   │    │ +reason      │     │ +context     │
  └──────┬───────┘    └──────────────┘     └──────┬───────┘
         │                                         │
         ▼                                         ▼ (✅)
  ┌──────────────┐                          回到 AWAITING / 重新分类
  │ REPLIED      │
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │ PROPOSAL_SENT│
  └──────┬───────┘
         ├─→ NURTURE (等)
         └─→ PAID (成交 · M5)
```

| Phase | 含义 | 何时进入 | 何时退出 |
|---|---|---|---|
| AWAITING | 默认 · intake 后等 audit | discovery-store.upsertDiscoveryRun | gradeLead 完后 |
| OUTREACH_ACTIVE | M4 已发外联 | M4 启动 (TODO) | 客户回复 / 超时归 NURTURE |
| REPLIED | 客户回信 | M4 inbound listener | 进 PROPOSAL_SENT |
| PROPOSAL_SENT | 报价已发 | 销售点 | 成交→PAID / 撤回→NURTURE |
| NURTURE | 等待 / drip | 多入口 | 重新 OUTREACH / 归 ARCHIVED |
| PAID | M5 入口 | Stripe webhook | (M5 终态) |
| ARCHIVED | 不再追 | D-grade auto · 手动 · 明确拒绝 | 几乎不退 (要重新 fresh discovery) |
| NEEDS_HUMAN | 自动化卡住 | image-extract 缺字段 · audit fail · 异常路由 | 操作员 ✅ 后回 AWAITING |

---

## 2. 旅程 12 阶段 · 每阶段细节

每个 lead 从进入开始，最多走完 12 步。

### Stage 0 · 首次发现 (Discovery)

| 项 | 值 |
|---|---|
| 触发 | Discord 命令 · Hermes 指令 · scheduled scrape |
| Actor | listener daemon → intent-router |
| Input | 自然语言 / Maps URL / phone / image |
| Output | route result (kind + target_cli + args) |
| 状态写入 | task `pending` |
| SLA | < 20s (LLM cascade 含本地兜底) |
| 失败路径 | 全 provider 失败 → regex 兜底 → kind=ops + human tag |
| 文档 | [SOP-1-FLOW §3](./SOP-1-FLOW.md) |

### Stage 1 · 抓取 / 补全 (Extraction)

| 项 | 值 |
|---|---|
| 触发 | dispatcher fs.watch pickup → spawn intake CLI |
| Actor | 4 路 CLI 之一 (places / docker / single / image) |
| Input | route args (--query / --niche --city / --phone / --image-path) |
| Output | lead payload (name + phone + address + place_id + photos refs + ...) |
| 状态 | task `running` |
| SLA | 10-180s (取决于 CLI) |
| 失败路径 | API 配额 / Playwright fail / OCR 漏字段 → kind→human + Discord 提示 |
| 文档 | [SOP-1-FLOW §6](./SOP-1-FLOW.md) |

### Stage 2 · 分类 1 · Niche/City 识别 ✅ Gate

| 项 | 值 |
|---|---|
| 触发 | intent-router 在 routing 时附带提取 |
| 数据源 | NICHE_KEYWORDS (50+ 中英) · CITY_KEYWORDS (17 AU 城市) · LLM 推理 |
| 决策 | niche+city 都识别到 → 继续 · 缺任一 → ① 后续 normalizeArgsForKind 兜底 ② 仍漏 → human gate |
| 失败处理 | image-extract 路径有专门 detailed message (Bug B fix) · 操作员填 ✅ 重试 |
| 真实命中率 | regex 24/24 PASS · ollama 22/24 (2 edge) · paid CLI 24/24 |

### Stage 3 · 分类 2 · Dedup 判重 ✅ Gate

**位置**: `core/leads/dedup-scorer.js` (8-key weighted)

| Signal | Weight | 用途 |
|---|---|---|
| place_id 完全相同 | 60 | Google 唯一 id 几乎是铁证 |
| phone 相同 | 25 | 强 signal · 同店多 GBP 也用同 phone |
| domain (website) 相同 | 25 | 同 URL 极强 |
| name 相同 (normalize) | 20 | 大小写 + 标点 + 公司后缀 normalize |
| coords < 50m | 15 | GPS 距离 |
| address normalized 相同 | 15 | street+suburb+postcode tuple |
| business-hours 相同 | 8 | 弱 signal |
| categories 重叠 | 5 | 弱 signal |

**决策门**:
- 总分 ≥60 → **自动合并** 到 canonical entity
- 30 ≤ 总分 <60 → LLM 判 (codex/claude)
- 总分 <30 → **新建 entity**

**输出**: `data/leads/dedup-decisions.json` 留底每次决策。

### Stage 4 · 评分 1 · discoveryScore (M1-D2)

**位置**: `core/leads/discovery-score.js` (4 entry 统一)

```
Inputs:
  has_website        +20
  has_phone          +15
  has_address        +10
  rating_count >= 10 +15
  rating >= 4.0      +10
  hours_available    +10
  photos_count >= 3  +10
  multi_category_ok  +10  (1-4 category · 5+ 扣分)
                     ───
                     0-100
```

**用途**: 排序 audit 优先级 · 给 cheap-audit-v2 cycle 决定先跑谁。

### Stage 5 · 评分 2 · cheap-audit-v2 (10 规则)

**位置**: `scripts/scoring/rescore-v2.js` + Tinyfish
**频率**: Hermes cron · 每 4 小时 全 niche
**成本**: T0 free (Tinyfish + 本地规则)

**10 规则简表**:
1. relevance_pass · GBP 类目 vs 搜索 niche 是否一致
2. has_real_website (非 directory listing)
3. website_reachable (200 / non-403)
4. mobile-viewport meta 存在
5. analytics 有 (GA4 / GTM / Tag Manager)
6. https
7. fast-enough (TTFB < 5s)
8. has_form (一种 contact 路径)
9. has_review_signal (GBP rating > 0)
10. niche_mismatch hard trigger

**决策**:
- relevance_pass=false → 进 hard_triggers → Stage 8 直接 D
- 其他 → 输出 cheap_score (0-100) + 加 queue

**输出**: `fixtures/rescore/<niche>-<ts>.json`

### Stage 6 · audit 1 · detailedAudit (12 维 39 规则)

**位置**: `core/scoring/detailed-audit.js`
**触发**: cheap-audit 后 chain · 或手动 `leads:run-pipeline`
**成本**: T0 (Playwright + 本地)
**SLA**: 30-90s per entity

**12 维 dimensions**:
trust / mobile / form / cta / speed / typography / visual-hierarchy / content-density / brand-consistency / accessibility / analytics / technical

**输出**:
- `audit_score` 0-100
- `decision` string (sentence + reasons)
- `issues` 数组 (每条含 dim + severity + evidence)
- `hard_triggers` 数组 (送 Stage 8)
- 录屏 `mobile-throttled.webm`
- 截图 `desktop.png` + `mobile.png`

### Stage 7 · audit 2 · visualAudit (LLM vision)

**Cascade**: `claude_cli → codex_cli → ollama`
**位置**: `core/llm/vision-adapter.js`
**输入**: desktop.png · 1280×720 trimmed
**SLA**: 5-15s
**成本**: $0.003-0.005 (claude/codex) · $0 (ollama 兜底)
**输出**: `visual_freshness` 0-10 + `visual_reasoning` 一段

### Stage 7.5 · websiteStatus 分流 · "有网站" vs "无网站" lead

**`entity.latest.websiteStatus`** 4 个值 · audit 流程基于此分两类客户:

| websiteStatus | 含义 | 走向 |
|---|---|---|
| `independent_https_site` | 独立域名 HTTPS (主流) | **常规 audit** (12 dim) · grade 按 audit_score |
| `independent_http_site` | 独立但 HTTP (没续 SSL / 老) | 同上 · audit 会降分 |
| `third_party_landing_page` | 用 Wix/Facebook Page/Linktree | **starter_candidate** path · 走 B-高口碑 / T1-低口碑 |
| `no_website` | 完全没网 | 同上 · starter_candidate |

#### 「有网站」客户路径 (常规)

```
entity 有 website → Stage 6 detailedAudit 跑 (Playwright fetch · 12 dim)
                  → Stage 7 visualAudit (vision LLM 看 desktop screenshot)
                  → Stage 8 hard-skip 8 规则 (recent_redesign · enterprise · too_many_pages · etc.)
                  → Stage 9 grade ABCD by audit_score + signals
                  → Stage 10 tier T1/T2/T3
                  → Stage 11 grade-router → Discord channel
                  → Stage 12 DESIGN_READY → M3 build demo
```

#### 「无网站」客户路径 (starter_candidate)

```
entity 无 website (或 third_party) → no_website 是 detailedAudit hard_trigger
                                   → 跳过 12 dim audit (没站可审)
                                   → 进入 lead-grading.js 的 starter_candidate 分支:
                                       if review_count >= 30 → grade B (口碑强 · 直接销售)
                                       else if t1Signals >= 3 → C/T1 ($399 一次性)
                                   → Discord channel:
                                       grade B → #website-leads (无 demo · 用 GBP 数据冷接触)
                                       grade C → #website-leads + cold-outreach-queue
                                       grade D → archived
```

**关键**: `no_website` **不在 8 hard-skip 规则里** · 不直接 D archive。无网站 + 强口碑 = 优质 starter customer · 我们卖 $399 一次性 site (T1 product)。

#### M3 demo build 时怎么处理这两类

- 有网站客户: M3 `pl:build-from-reference` 用客户现网 audit 数据 (痛点 / 评价 / 视觉对比) 喂 prompt
- 无网站客户: M3 用 GBP-only 数据 (评论 / 营业时间 / 类目) + reference site 默认 sample 内容 · `data-od-sample="true"` 标记 · 客户买后 M5 revision 补真值

详细 SOP: [SOP-2-FLOW.md](./SOP-2-FLOW.md) §4 grade-router

---

### Stage 8 · 分类 3 · 8 个 hard-skip 规则 ✅ Gate (D auto-archive)

**位置**: `core/scoring/lead-grading.js#HARD_SKIP_RULES`

| ID | 中文 | 触发条件 |
|---|---|---|
| `niche_mismatch` | 行业不匹配 | detailedAudit 或 cheapAudit `hard_triggers` 含此项 |
| `recent_redesign` | 客户近 12 个月内 redesign 过 | Wayback Machine 信号 |
| `enterprise_size` | 业务规模过大 | businessSizeSignal.tier === 'enterprise' |
| `too_many_pages` | 现网站 >200 页 | sitemap_analysis.total_urls > 200 |
| `too_many_categories` | GBP 多业务分类 ≥5 | entity.categories.length ≥ 5 |
| `relevance_fail` | GBP 类目与 niche 不匹配 | cheapAudit.relevance_pass === false |
| `fully_managed` | 已有 fully-managed 网站服务 | tech_stack.fully_managed === true |
| `not_qualified_decision` | LLM judge 明确否定 | detailedAudit.decision_qualified === false |

**决策**: 任一规则触发 → `investment_level = 'D'` → Stage 9 跳过分级 · 直接 archive。

### Stage 9 · 分级 · Investment Level A/B/C/D ✅ Gate

**位置**: `core/scoring/lead-grading.js#computeInvestmentLevel`
**Pipeline order**: hard-skip 先看 · 没触发再计算 ABC

| Grade | 含义 | 典型 signals |
|---|---|---|
| **A** | 顶级目标 · 直接销售投入 | audit_score ≥75 · 强口碑 (rating ≥4.5 + count ≥30) · 明确痛点 |
| **B** | 优质目标 · 直接销售投入 | audit_score 60-75 · 中口碑 · 网站问题清晰 |
| **C** | 批量冷外联 · 自动化触达 | audit_score 40-60 · 弱口碑 · 网站基础有 |
| **D** | 不追 (Stage 8 hard-skip 触发) | 见 Stage 8 表 |

**Output**: `entity.scoring.grade = 'A'|'B'|'C'|'D'` + `investment_factors[]`

### Stage 10 · 分级 · Product Tier T1/T2/T3 ✅ Gate (A/B/C only)

**位置**: `core/scoring/lead-grading.js#computeProductTier`
**只对 A/B/C 计算 · D 跳过**

| Tier | 价位 | 适用 |
|---|---|---|
| **T1** | $399 一次性 · 含 hosting 永久 + 3 次 revision | 业务简单 · 没真网站 · 单分类 |
| **T2** | T1 + annual maintenance ($299/年 · 12 次 revision) | 中等口碑 · 多业务分类 · 想要月度维护关系 |
| **T3** | Custom · 月度服务 | 强口碑底子 + 数字成熟度 + 月度运营机会 (SEO / 内容 / 广告) |

**输出**: `entity.scoring.tier = 'T1'|'T2'|'T3' | null` + `product_tier_factors[]` + `recommended_pricing`

### Stage 11 · 决策 · grade-router (分流)

**位置**: `core/leads/grade-router.js`
**输入**: grade + tier + entity
**输出**: 3 个 side effect

| Grade | Phase 变化 | Discord thread | Queue 加入 |
|---|---|---|---|
| A | AWAITING (保持) | ✅ 开 forum thread (high priority tag) | — (直接销售接) |
| B | AWAITING (保持) | ✅ 开 forum thread (mid priority) | — |
| C | AWAITING (保持) | ✅ 开 forum thread (low priority) | ✅ `data/leads/queues/cold-outreach-queue.json` |
| D | **ARCHIVED** | ❌ 不开 | ❌ |

**Discord thread 内容** (M2-D3 `openLeadThread`):
- Thread title: `[<grade>] <business name> · <niche> · <city>`
- 首条 message: audit score + decision + top 3 issues + master.md 链接 + audit URL
- Tags: `[graded, <grade>, <tier>]`

### Stage 12 · 网站就绪 · DESIGN_READY phase ✅ (V3 D31 · 2026-05-14 显式化)

**位置**: `ENTITY_PHASE.DESIGN_READY = 'design-ready'`

**何时进入**:
- `core/scoring/lead-grading.js#persistLeadGrade` 在 grade=A/B/C 时调 `setEntityPhase('design-ready')`
- D 仍走 ARCHIVED
- 旧版 "A/B → awaiting · C 不变 phase" 行为已废弃 (D31)

**判断 ready 完整 invariant**:
1. ✅ `entity.phase === 'design-ready'`
2. ✅ `entity.scoring.grade ∈ {A, B, C}`
3. ✅ `entity.scoring.tier ∈ {T1, T2, T3}` (非 null)
4. ✅ `clients/<slug>/v2/master.md` 22 章满
5. ✅ `clients/<slug>/v2/screenshots/desktop.png` 存在

**M3 触发**: `pl:build-from-reference --slug <slug>` → SOP-3-FLOW。
**Doctor 守**: `pl:lead-journey-doctor` invariant #7 验证 DESIGN_READY → grade A/B/C。

---

## 3. 决策矩阵 · grade × tier → next_action

`next_action` 写在 `entity.scoring.next_action` 字段 · operator 在 Discord thread 里也能直接看。

| Grade | Tier | next_action (建议) | 谁接 |
|---|---|---|---|
| A | T1 | 直接打电话 · pitch $399 · 1 周内发 demo URL | 销售 (Matthew) |
| A | T2 | 直接打电话 · pitch $399 + $299/年 maintenance | 销售 |
| A | T3 | 见面 / 视频 · 谈 custom · 月度 retainer 启动 | 销售 |
| B | T1 | 邮件 + demo URL · 5 天内 follow-up call | 销售 |
| B | T2 | 邮件 + demo URL · 提 maintenance plan | 销售 |
| B | T3 | 邮件深度 audit · 邀视频谈 | 销售 |
| C | T1 | 冷邮件批量 · 链接 demo URL · 自动 drip | 自动化 (M4) |
| C | T2 | 同上 · 增加 maintenance 卖点 | 自动化 |
| C | T3 | 同上 · 含 "monthly partnership" 着陆页 | 自动化 |
| D | — | archive · 不追 · skip_reasons 留底 | — |

---

## 4. STATUS_RANK · 内部状态字段 (与 phase 平行)

**位置**: `core/leads/discovery-store.js#STATUS_RANK`

数字代表 lifecycle 先后 · 用于 admin UI 排序 + bulk operation gate。

| Rank | Status | 含义 |
|---|---|---|
| 5 | skipped | D archive · hard-skip 触发 |
| 10 | discovered | 刚 intake · master.md skeleton 在 |
| 20 | scored | discoveryScore 算完 |
| 25 | manual_review | 转人工 (NEEDS_HUMAN phase 时) |
| 30 | queued_for_audit | 进 cheap-site-audit.json 队列 |
| 40 | queued_for_enrichment | 进 selected-enrichment.json (T2/T3) |
| 50 | ready_for_outreach_brief | grade ABC + audit 全部done |
| 60 | promoted | sales 把 lead 推到 outreach |
| 70 | contacted | M4 已发外联 |

---

## 5. 真实漏斗数据 · 10 真客户 (roofing niche)

10 个 brisbane 屋顶 lead 全程跑通后实测：

| Stage | 进 | 出 | 漏 |
|---|---|---|---|
| Intake (places) | 25 | 25 | — |
| Dedup | 25 | 14 fresh | 11 merged |
| cheap-audit | 14 | 12 (passed relevance) | 2 D (relevance_fail) |
| detailedAudit + visual | 12 | 12 | 0 |
| hard-skip | 12 | 10 (passed) | 2 D (recent_redesign + enterprise_size) |
| Grade decision | 10 | 6B + 3C + 1A | 0 D |
| Tier decision | 10 | 6T2 + 3T1 + 1T3 | — |
| M3 demo built | 10 | 10 live URL | 0 |
| **总转化** | 25 → 10 demo | **40% 进入 M3** | |

注：A=1 / B=6 / C=3 是 roofing niche 抽样 · 其他 niche 可能不同。

---

## 6. 当前漏斗 bleed points (诚实自查)

| 阶段 | 当前问题 | 建议修 |
|---|---|---|
| Stage 0 routing | ollama 偶发漏 niche/city (规模未量化) | 上 paid-first cascade (已做 D27) · 加 doctor #5 (已做 D29) |
| Stage 3 dedup | 30-60 LLM judge 区间 ~5% 的客户没 ledger 看 | 加 dedup-decisions audit log UI (TODO) |
| Stage 8 hard-skip `recent_redesign` | Wayback Machine API 不稳 · false negative | 加 retry + cache (TODO) |
| Stage 9 grade A/B 区分 | 边界靠 audit_score · 没 sales feedback loop | 加 sales 反馈表单 (TODO · 需 admin UI 配合) |
| Stage 11 C → cold queue | M4 还没建 · queue 累积但不消化 | M4 启动 (优先级 TBD) |
| Stage 12 DESIGN_READY | ~~没显式 phase~~ | ✅ D31 已修 · A/B/C → setEntityPhase('design-ready') |
| ⚠️ 240 entity 中 234 个 no-phase + 240 个 no-grade (现状 audit 还没批量回跑) | 真问题 · 已 doctor 监控 (pl:lead-journey-doctor §funnel) | 跑 `npm run scoring:rescore-v2 -- --all-niches` 批量重 grade · 看 funnel 是否 ABC 分布合理 |
| 整体 | 没 funnel dashboard · 漏斗指标手算 | admin UI 加 funnel page (TODO) |

---

## 7. Operator 一日流程 (典型 · 怎么往下推)

**早上**:
1. 看 `pl:intake-doctor` 日报 (Discord webhook · 09:00 cron) → 红灯 fix
2. 看 `#website-tasks` forum 新 thread (overnight Hermes cron 跑出的 A/B/C)
3. 优先级: **A first → B → C**

**对每个 A/B thread**:
1. 看 thread 首条 audit summary (score / 痛点 top 3)
2. 点 audit URL 看 internal-audit-report.html (中文 · 5 min 扫)
3. 决定: 直接打电话 / 发邮件 / 跑 M3 demo
4. 跑 `pl:build-from-reference + pl:publish-demo` (~5 min) → 拿 demo URL
5. 把 demo URL 贴回 thread · 操作员后续基于此外联

**对 C thread**:
- 查 cold-outreach-queue · 等 M4 启动消化
- 或人工挑选高潜力 C 升级为 B (改 grade + 重跑 router)

**晚上**:
- `npm run pl:bulk-publish-demo -- --all` 把当天新 graded 客户全部出 demo
- 看真客户 master.md 状态表 (README §真客户状态)

---

## 8. Hermes agent 在 journey 中的角色

| Stage | Hermes 行为 |
|---|---|
| 0 (intake) | 平行入口 · Matthew 直接对话 (替代 Discord) |
| 4 (rescore cron) | `every 4h` 触发 `scoring:rescore-v2 --all-niches` |
| 5-7 (audit) | rescore-v2 内部 chain run-pipeline |
| 11 (grade router) | 自动开 thread + 入 queue · 不需 Hermes |
| 12 (M3) | Matthew 手动调 `pl:build-from-reference` · 或 Hermes 通过 SKILL 调 |

**Skill files**:
- `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/SKILL.md`
- 未来加: `profitslocal-website-publish` · `profitslocal-website-grade-review`

---

## 9. 相关文档

- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · 模块视角: intake (Stage 0-3 实现)
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · 模块视角: audit + grade (Stage 4-11 实现)
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · 模块视角: publish (Stage 12 出口)
- [M2-PRD.md](./M2-PRD.md) · §3 Architecture 含 4 stage 详细图
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D26 customer/internal language · D27 cascade · D29 doctor · D30 dispatcher

---

## 10. 关键 invariants (必须永远成立)

| Invariant | 检查方法 |
|---|---|
| 每个 lead 必有 entity.key (place_/domain_/image_/manual_) | `node -e "..." 扫 data/leads/entities` |
| phase ∈ ENTITY_PHASE 8 个值 | `setEntityPhase` 内部 validate |
| grade ∈ {A,B,C,D} 或 null (未 audit) | runtime validation in lead-grading |
| D-grade 必带 archive_reason | `setEntityPhase` 强制 |
| tier 为 null iff grade=D | 同上 |
| 每个 thread 至少一个 tag (kind 或 graded) | Discord listener patchThreadTags |
| 每次 dedup 决策都 append 到 dedup-decisions.json | discovery-store.upsertDiscoveryRun 内部 |

✅ **`pl:lead-journey-doctor` 已实装 · 10/10 invariant 验证 + funnel 快照** (V3 D32 · 2026-05-14)

用法:
```bash
npm run pl:lead-journey-doctor            # 彩色 · 10 check + funnel by phase + by grade
npm run pl:lead-journey-doctor -- --json  # JSON 机器读 · 含 entities_count / by_phase / by_grade
```

输出含 funnel 快照 (phase 分布 + grade 分布) · 5/14 首跑暴露真发现:
- 240 entity 中 234 no-phase · 240 no-grade → 必须批量跑 rescore + grade 才能填满。

Heartbeat: `data/heartbeats/lead-journey-doctor.txt`。
