# Lead Filtering Design v1 · 排除式筛选

> Matthew 2026-05-14: "先排除，再精选 · 比正向打分效率高得多"
> 状态: **IMPLEMENTED cycle-23 (2026-05-15)** · Matthew sign-off · 3 个决定 (a)(a)(a)
> 取代 cycle-17 的 `LEAD-SCORING-DESIGN.md`（5 维评分 · 太复杂 · 已 archived）
>
> 实现文件:
> - `core/leads/exclusion-filter.js` · 3 层 filter + niche-aware
> - `core/leads/niche-config.json` · 阈值配置 (niche 上限 + 下限)
> - `core/leads/cheap-audit-queue.js` · wire filter 替换 predict-grade 硬阈值
>
> Tinyfish lite homepage fetch · **不实施** (Matthew: 排除式不需要 · Stage 1 Playwright 已经给所需信号)

---

## 1 · 核心理念

**先排除明显不是我们客户的 · 剩下的都进 audit pipeline · 不再分级。**

旧（删）: predict-A/B/C/D 5 维打分 · 100 分阈值
新: 3 层 deterministic 排除 + LLM 兜底 · 剩下的直接 enqueue audit

---

## 2 · 三层排除（按顺序跑 · 任一命中 → archive · 不进 audit）

### Layer 1 · 数据质量 (deterministic)

```javascript
EXCLUDE if (
     (latest.phone == null AND latest.email == null AND latest.website == null
      AND enrichment_attempted AND enrichment_yielded_nothing)   // 见 §3 enrichment 流程
  OR latest.business_status NOT IN ['OPERATIONAL', null, undefined]
  OR /\b(test|demo|测试|sample)\b/i.test(latest.name)
)
```

archive_reason 写明哪条触发: `excluded_layer_1_no_contact_after_enrich` 等

### Layer 2 · 业务类型不对 (deterministic + niche-aware)

```javascript
// Niche-aware review_count 上限 (matthew #2)
const REVIEW_MAX = {
  roofing:    200,   // 屋顶超 200 reviews 必是连锁
  plumbing:   200,
  electrical: 200,
  dental:     400,
  restaurant: 1000,  // 餐饮 1000 才算大
  cafe:       1000,
  default:    300,
};

EXCLUDE if (
     latest.review_count > REVIEW_MAX[niche || 'default']        // 大企业/连锁
  OR /(government|gov|school|university|church|charity)/i.test(categoryHaystack)
  OR /(web design|seo|digital marketing|web develop|marketing agency)/i.test(categoryHaystack)
  OR LLM_niche_judge.relevant === false                          // niche_mismatch (cycle-10 已实装)
)
```

archive_reason: `excluded_layer_2_too_big` / `excluded_layer_2_gov_school` / `excluded_layer_2_competitor` / `excluded_layer_2_niche_mismatch`

**Matthew #3 决定**: 不再判 brand list · 不判地址。review_count > niche_max 就够。

### Layer 3 · 时机不对 (deterministic)

```javascript
EXCLUDE if (
     latest.review_count < 5
  OR (latest.rating > 0 AND latest.rating < 3.0 AND latest.review_count >= 5)
)
```

archive_reason: `excluded_layer_3_too_few_reviews` / `excluded_layer_3_bad_rating`

**Matthew #4 决定**: 冷冻 = 直接 archive · 不 30 天复查 · 不动。

### Layer 4 · 区域竞争分析

**Matthew #5 决定**: 砍掉 · Phase 2 再说。

---

## 3 · Enrichment 流程改造 (Layer 1 关键)

**当前流程** (有 bug):
```
intake → cheap-audit · action=queued_for_enrichment → log → 永远 idle
```

**新流程**:
```
intake → cheap-audit · action=queued_for_enrichment
       → 自动 createTask(kind='enrich', cli='pl:run-enrichment-batch'
           args=['--limit','1','--entity-key',key])
       → enrichment.js 跑 Tinyfish 搜索 + DDG fallback (已实装)
       → 重新 cheap-audit (re-check)
       │
       ├── 找到 phone/email/website → 继续走 cheap-audit · Layer 1 通过
       │
       └── 仍 NULL → Layer 1 hit → archive (excluded_layer_1_no_contact_after_enrich)
```

新增字段:
- `entity.enrichment_attempted_at` (timestamp)
- `entity.enrichment_yielded`: `'contact' | 'nothing'`

---

## 4 · 剩下来的 entity 怎么处理

**不再分 A/B/C/D。** 排除后剩下的 entity 全部:
1. 开 #website-leads thread (现有 cycle-4 cheap-audit-queue 做的)
2. **直接 enqueue detail audit queue** (priority = 100 - rank 或简单 FIFO)
3. detail audit 跑完后 · `core/scoring/lead-grading.js` 出 **真 grade** (A/B/C/D · 这是 audit 之后的)
4. grade A/B → 进 qualification → ready-to-build → 自动 chain build+publish (cycle-18 已实装)
5. grade C → cold backlog (现有逻辑)
6. grade D → archive (现有逻辑)

**关键: 删 predict-grade.js 整套**。它现在判的事情完全被排除筛子取代。

---

## 5 · 加成信号 · discovery_rank (matthew 的反问)

`entity.latest.discovery_rank` 已有 (docker scraper 返回顺序 = SEO 排名)。

**不当 exclusion · 当 prioritize 信号**:
- rank 10-30 = 甜蜜点 · audit queue priority 高 (优先深审)
- rank 1-3 = 已经强 · priority 低
- rank 30+ = priority 中

`detailed_audit_queue.priority` 字段可用现有的:
```javascript
priority = 100 - Math.max(0, (rank - 10) * 2)   // rank 10 → 100 · rank 30 → 60 · rank 50 → 20
```

只用于排队顺序 · 不 exclude · 加一段 review_count + rank → priority 简单公式。

---

## 6 · 实施清单

新增:
- `core/leads/exclusion-filter.js` · 3 层 exclude 规则 + niche-aware 阈值
- `core/leads/niche-config.json` · REVIEW_MAX per niche · 可调

改:
- `core/leads/cheap-audit-queue.js`:
  - 加 exclusion-filter 前置 · Layer 1+2+3 命中 → archive · 不开 thread
  - `queued_for_enrichment` → 真正 createTask 触发 enrichment
- `core/scoring/cheap-audit-v2.js`:
  - 简化 · 删 hard_triggers 重复部分 (留 gbp_quality 给 priority 排序用)
- `core/leads/predict-grade.js`:
  - **DELETE** · 整套移除 · 现有 callers 改用 exclusion-filter

删:
- `entity.predict_grade` 字段 (lead-journey-doctor 加迁移)
- 现有 LEAD-SCORING-DESIGN.md (cycle-17 v1) · 归档

数据迁移:
- 现有 entities 跑一次 backfill · 把所有 `predict_grade.grade='D'` 转 `phase='archived'` + 对应 archive_reason

---

## 7 · 预期效果

**当前** (entry 1 实测):
- 抓 5 entity → 全部 cheap-audit + LLM niche judge (5 × $0.1 ≈ $0.5) → 4 predict-C + 1 archived
- 0 自动 audit · 全靠销售手动 🚀

**新流程预期**:
- 抓 5 entity → exclusion filter 现场跑 ($0) → 1-2 enrichment 跑 (~$0.02) → LLM niche judge 仅剩余 1-2 entity 跑 (~$0.1) → 1-2 直接进 audit queue → 自动 audit + build + publish
- 0 销售手动操作 (除非 grade C 想推进)
- 单 query 成本 ~$0.2 (vs 现 $0.5)
- 实际进 audit 的都是「值得做」· 没浪费

---

## 8 · 不动的部分（保护现有投资）

- cheap-audit-v2 niche_mismatch + ecommerce + member_portal + active_blog + too_many_pixels triggers (audit 之后 qualification 用 · 现状保留)
- detail audit · grade · qualification 4-stage 全保留
- Discord milestone 消息 (cycle-17 draft 中) · 适配新流程: Stage 1 显示 "X 排除 · Y 通过 · 进 audit"
- LLM niche judge (cycle-10) · 当 Layer 2 一项使用
- pl-discord-snapshot (cycle-12) 字段精度核对 · 现状保留

---

## 9 · Niche-aware 阈值 · 你确认数字

| niche | review_count 上限 (排除大企业) | review_count 下限 (排除太小) |
|-------|---------------------------------|------------------------------|
| roofing | 200 | 5 |
| plumbing | 200 | 5 |
| electrical | 200 | 5 |
| dental | 400 | 5 |
| restaurant | 1000 | 10 |
| cafe | 1000 | 10 |
| hair / salon | 500 | 5 |
| auto / panelbeater | 300 | 5 |
| painting | 200 | 5 |
| HVAC | 200 | 5 |
| solar | 300 | 5 |
| pet / vet | 400 | 5 |
| landscape / garden | 200 | 5 |
| cleaning | 200 | 5 |
| beauty / spa | 300 | 5 |
| default | 300 | 5 |

数字 OK 吗 · 还是 niche 全部 200 上限 · 5 下限 · 简单粗暴?

---

## 10 · 总结 · 需要你最后 sign-off 3 件

1. **数字** §9 表 OK 吗?
2. **enrichment 自动触发流程** §3 OK 吗?
3. **删 predict-grade.js + entity.predict_grade 字段** OK 吗 (整套清理 · 影响 ~10 个文件)?

Sign off 后我开工 (cycle-N · 估计 200-300 行新增 · 100 行删除)。
