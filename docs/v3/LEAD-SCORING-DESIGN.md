# Lead Scoring Design v1 · 替换硬阈值 predict-A/B/C/D

> Matthew 2026-05-14: "把一开始预筛选，改成评分制"
> 状态: **PLAN ONLY · 不实施 · 等 Matthew review**

---

## 1 · 当前问题（为什么要换）

现在 `core/leads/predict-grade.js` 是硬阈值:
```
predict-A: review ≥ 100 AND rating ≥ 4.3 AND has_website AND cheap=audit/starter
predict-B: review ≥ 30  AND rating ≥ 4.0 AND cheap=audit/starter
predict-C: 没达 A 也没达 B
predict-D: cheap=skip / niche_mismatch
```

**毛病:**
1. **一刀切** — review=29 vs review=30 差一个就掉级 · 不合理
2. **不显示弱点** — operator 看不出来「为什么 B 不是 A」差哪
3. **不衡量 redesign 真实需求** — 现在只看 GBP 信号 (review/rating)，没看现网是不是真旧/烂
4. **加新 niche 要改 threshold** — 不灵活

---

## 2 · 评分制思路

**核心问题**: 一个 lead 值得我们投入多少销售精力 + 技术资源?
**答案**: 两个维度合成总分:
- **A. 商家质量**（值不值得做 · 能不能付钱）
- **B. 网站需求**（真正需要 redesign / 建站 · 不是装样子）

总分 0-100 · 阈值定 A/B/C/D · 阈值可调。

---

## 3 · 五维评分（满分 100）

每维**独立打分**·**最终透明可解释** (operator 一眼看出哪维拉低)。

### 维度 1 · 商家可信度 (max 25)

| 信号 | 来源 | 分值规则 |
|------|------|---------|
| review_count | scrape | 0 / 5 / 10 / 15 / 20 for 0 / 10-29 / 30-99 / 100-299 / 300+ |
| rating | scrape | 0 / 2 / 4 / 5 for <3.5 / 3.5-3.9 / 4.0-4.2 / 4.3+ |

**rationale**: review 数量 = 业务体量 + 时间积累; rating = 操作质量。 < 10 reviews 多半是新业务/僵尸店, > 100 是真营业的。

### 维度 2 · 网站需求紧迫度 (max 30 · **最重要**)

| websiteStatus | 含义 | 分值 |
|--------------|------|------|
| `no_website` | 完全没网站 | **30** (顶级 lead · 100% 需要建) |
| `social_or_third_party_only` | 只有 FB / Insta / 目录 | **25** (几乎肯定需要) |
| `independent_http` | 有独立站但还在 HTTP | **20** (旧站 · 强需求 redesign) |
| `independent_https` | 现代站 (HTTPS) | **8** (可能需要 · 看 audit) |
| (含 ecommerce/CMS 复杂) | Shopify / WooCommerce | **0** + 标 `hard_exclude_ecommerce` |

**rationale**: 这是我们产品最有匹配度的信号。`no_website` 是金矿。`independent_https` 只有 audit 后才知道是不是旧的烂的，所以先给低分 · audit 完再加。

### 维度 3 · 联系可达性 (max 15)

| 信号 | 分值 |
|------|------|
| phone present | 6 |
| email present | 6 |
| address present | 2 |
| opening_hours verified (5+ days) | 1 |

**rationale**: 销售联系不到 = 死 lead。没 phone/email 必须先 enrich · 不然进不了 outreach。

### 维度 4 · Niche 匹配度 (max 15)

| 信号 | 分值 |
|------|------|
| LLM niche judge `relevant=true` 且 `confidence ≥ 0.9` | 15 |
| LLM `relevant=true` 且 `confidence < 0.9` | 10 |
| LLM `relevant=false` | **0 + hard_exclude_niche_mismatch** |

**rationale**: 行业不对的 lead 永远不会买 roofing 网站 · LLM 判定权威 (cycle-10)。

### 维度 5 · 活跃度 / 数字成熟度 (max 15)

| 信号 | 分值 |
|------|------|
| photo count: 0 / 1-3 / 4-9 / 10+ | 0 / 2 / 5 / 8 |
| has menu OR reservation OR order_online link | 3 |
| categories[].length 1-3 (单一业务) | 2 |
| categories ≥ 4 (multi_business) | -10 + 标 `hard_exclude_multi_business` |
| latest review within 90 days (待补 · 现在 scrape 没拿到 review 时间) | 2 |

**rationale**: 活跃的 GBP = 真实营业 · 多 photo = 重视形象的老板。multi_business 通常是 enterprise 或链锁 · 不在我们产品包。

---

## 4 · 总分 + 分级阈值

```
total = dim1 + dim2 + dim3 + dim4 + dim5    (max 100)

audit-A: total ≥ 70 AND no hard_exclude AND dim4 ≥ 10 (niche 强匹配)
audit-B: total 50-69 AND no hard_exclude
audit-C: total 30-49 AND no hard_exclude (cold backlog · 等触发)
audit-D: total < 30 OR hard_exclude 触发 (archive · 不深审)
```

**阈值环境变量化** (易调):
- `LEAD_SCORE_A_MIN=70`
- `LEAD_SCORE_B_MIN=50`
- `LEAD_SCORE_C_MIN=30`

---

## 5 · Hard Exclusion (即使分高也踢 D)

```
hard_exclude_ecommerce         (Shopify/Woo/Magento 检测 · cheap-audit 已实现)
hard_exclude_niche_mismatch    (LLM judge relevant=false · cycle-10)
hard_exclude_multi_business    (categories ≥ 4)
hard_exclude_no_contact        (phone+email 都空 · 不可触达)
```

每个 exclusion 在 entity 上记下 `lead_score.exclusions = ['xxx', 'yyy']` 让 operator 看清楚原因。

---

## 6 · 显示在 Discord 的样子（profile card + cheap summary）

替换现在的硬阈值表 (cycle-8 那个):

```
Lead Score: 62/100 · audit-B

维度          得分    满分    备注
────────────────────────────────────
1 商家可信度  18/25   review 67 · rating 4.5★
2 网站需求    20/30   independent_http · 旧站 · 强 redesign 信号
3 联系可达性  14/15   phone✓ email✓ address✓ hours✓
4 Niche 匹配  15/15   LLM relevant=true conf 0.99 (codex_cli)
5 活跃度       5/15   3 photos · 1 category · 无 menu/booking
                       ────────────────
                       total: 62/100

Hard exclusions: 无

→ 入 detail audit 队列 (audit-B · priority 75)
```

或者 audit-C 时:

```
Lead Score: 38/100 · audit-C · cold backlog

维度          得分    满分    
1 商家可信度   8/25   review 12 · rating 4.8★ (评分高但量少)
2 网站需求    20/30   independent_http
3 联系可达性   2/15   email 缺失 + hours 不全
4 Niche 匹配  15/15   LLM relevant=true conf 1.00
5 活跃度       3/15   0 photos · 1 category

→ cold backlog · 销售触发或周期任务再 audit
→ 🚀 推进 (operator override) · 💤 archive · 🔁 重跑
```

---

## 7 · 实施方案

**新增** `core/scoring/lead-score.js`:
```js
export function scoreLead({ entity, cheapAudit, nicheVerdict }) {
  const dim1 = scoreCredibility(entity);
  const dim2 = scoreWebsiteNeed(entity);
  const dim3 = scoreReachability(entity);
  const dim4 = scoreNicheFit(nicheVerdict);
  const dim5 = scoreActivity(entity);
  const exclusions = detectHardExclusions(entity, cheapAudit, nicheVerdict);
  const total = dim1.score + dim2.score + dim3.score + dim4.score + dim5.score;
  const grade = exclusions.length > 0 ? 'D' :
                total >= A_MIN ? 'A' :
                total >= B_MIN ? 'B' :
                total >= C_MIN ? 'C' : 'D';
  return { total, grade, dimensions: [dim1, dim2, dim3, dim4, dim5], exclusions };
}
```

**改 `core/leads/predict-grade.js`**: 不删 · 内部调 scoreLead · 把 score 映射成 predict_grade。entity 字段 `entity.predict_grade` 加 `score: 62, dimensions: [...]`.

**改 `core/funnel/audit-stage-messages.js cheapAuditPredictMessage`**: 显示新表格 (代替 cycle-8 的阈值表)。

---

## 8 · 影响范围 / 风险

| 影响 | 风险 |
|------|------|
| `core/leads/predict-grade.js` | 接口加字段不删 · backward compatible |
| `core/funnel/audit-stage-messages.js` | 仅替换 cheapAuditPredictMessage 内部表格 |
| 已有 entities | 没事 · 重跑 cheap-audit 重算 score |
| Doctor / SOP | 加 1 个不变量 `entity.predict_grade.score 0-100` |
| LLM cascade | 不动 · 复用现有 niche judge |
| /admin scoring 透明度 | 加 score-config endpoint 暴露 dim weights · UI 显示 |

---

## 9 · 未决问题 · 等 Matthew 拍板

1. **维度权重 OK 吗** (25 / 30 / 15 / 15 / 15)? 还是网站需求要 35 · 可信度只 20?
2. **A/B/C/D 阈值 OK 吗** (70 / 50 / 30)? 太严还是太松?
3. **review_count 阶梯 OK 吗** (0/10/30/100/300)? 还是 0/5/15/50/200?
4. **photo count 算不算** · 还是 audit 之前不需要这维 (留给 audit 阶段判)?
5. **categories ≥ 4 真的硬踢 D 吗** · 还是 -10 分软扣?
6. **hard_exclude_no_contact** · 没 phone+email · 是 D 还是先 enrich?
7. **niche LLM confidence ≥ 0.9 阈值合理吗** · 还是 ≥ 0.7?

---

## 10 · 想法 (待 Matthew 输入)

- **B 段细分** — 60-69 与 50-59 销售投入差很多 · 要不要 B+/B-?
- **行业系数** — 某些 niche 利润高 · 同分应该高一档? (e.g. dental vs roofer)
- **地区系数** — Sydney vs 偏远 NSW · 同分应该有别? (不建议加 · 复杂)
- **时间衰减** — entity 半年前抓的 · 数据可能过期 · 重新抓 / 降权?
- **重复 lead 处理** — 同业务多 entity (domain + place) · 取 max score?

---

## 11 · 不在此 scope

- detail audit 给的 grade (lead-grading.js 那个 · master.md audit_score) — 那是 audit 之后的 deep score
- qualification scorecard (qualification-scorecard.js) — 那是 build/no-build gate
- 这个 lead-score 是 **预筛选** · audit 之前 · 决定要不要花钱跑 audit

---

待你回复以上 7 个未决 · 我就开工 (`cycle-N: lead-score 评分制实施`)。
