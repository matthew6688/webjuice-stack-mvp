# PRE-IMPLEMENT VERIFICATION · 2026-05-13

> Matthew 让我反省 · 我自查后发现初版 PRD 信心不到 95% · 这文档记录我**真**做的核实工作。
> 实施前最后 check · 凡 < 80% 的 deliverable 都列在这里。

## 自查发现的 8 个 < 95% 的点

| # | Deliverable | Before | After 核实 | 怎么核实的 |
|---|---|---|---|---|
| M1-D1 | dedup 5-key fuzzy | 70% | **88%** | 扫 entity store 看 email 字段 · 看 fuzzy lib 装没装 |
| M1-D2/D7 | unified discoveryScore | 75% | **80%** | dump 4 sourceType entity 实际字段 · 对比 shape |
| M1-D3 | Hermes skill | **60%** | **85%** | hermes skills list · 找现有 b2b skills 位置 |
| M1-D5 | bulk archive | 80% | 80% | recount: 94 stuck (不是 96) |
| M2-D1 | rescore --all-niches | 70% | **85%** | 读 rescore-v2-cli.js + niche 真分布 |
| M2-D2 | docker reviews 🔑 | **50%** | **80%** | **真跑 extra_reviews:true** 实测 |
| M2-D4 | batch send | 50% | **80%** | 读 email-template.js + agentic-inbox.js APIs |
| M2-D6 | section 改 | 75% | **90%** | 严扫 master-md-builder · 21 section guard 状态 |
| M2-D7 | niche-tone map | 65% | **65%** | Matthew 设计决策 · 我不该决 |

平均 **85%** · 比初版 PRD ~65% 大幅提升。M2-D7 仍需 Matthew 答。

---

## 重大发现 · 修订原 PRD

### 1. email 字段 M1 阶段 99% 空 · dedup weight 留着但少触发

实测: gosom / Places API / image / single-enrich 4 入口**没一个写 email** 到 entity。

email 在 entity schema 里 (latest.email) · 但只在 SOP-1 enrichment (M2 后期) 才填。

→ M1-D1 dedup 5-key 评分公式不变 (email 权重 30) · 但实际 M1 大多场景靠 phone (35) + domain (25) + name (20) + address (15) · email **作为 future-proof signal** 保留。

### 2. 没有 fuzzy lib · 自己写

实测: package.json + node_modules 都没 `string-similarity` / `fuse` / `natural` / etc.

→ M1-D1 加 ~50 LOC `core/leads/text-similarity.js` · 手写 Levenshtein 标准化函数 + token-set Jaccard · 取 max。不引入 npm dep。

### 3. Places API entity 不含 4 个关键字段

实测: dump 86 个 `sourceType=places_search` entity · 看缺啥:

```
✗ websiteStatus = 空 (gosom 有)
✗ discoveryScore = 空 (gosom 算)
✗ signals.imageCount = 空
✗ signals.hasMenuLink/hasReservationLink = 空
```

→ M1-D2 `computeDiscoveryScore` 必须 **null-safe** · 缺字段时 signal = 0。
→ 额外 helper `classifyWebsiteStatus(website)` 已在 `core/leads/maps-scraper-discovery.js:198-206` · 直接复用 · 4 入口都调一次。

### 4. Hermes skill 装在 ~/.hermes/profiles/<profile>/skills/<category>/<name>/

实测:
```
/Users/matthew/.hermes/profiles/marketer/skills/
├── apple/                 # 8 个内置 skill
├── b2b-marketing/         # 现有 5 个 skill (我们最相关)
│   ├── b2b-restaurant-menu-outreach
│   ├── local-business-preview-site-outreach
│   ├── outbound-b2b-website-agency
│   ├── restaurant-menu-outreach-pipeline
│   └── webjuice-outbound-pipeline  ← V2 已建 · 跟我们 V3 重叠
├── (32 个其他 categories)
```

**重大发现**: `webjuice-outbound-pipeline` 已存在 · V2 设计的完整 outreach pipeline · 跟我们 V3 `profitslocal-website-intake` 概念重叠。

→ **M1-D3 open issue**: 我们写 V3 skill 时是 replace · 补充 · 或 deprecate 老的？建议跟你确认 · 倾向 **deprecate `webjuice-outbound-pipeline`** (V2 设计) · 新 V3 完整覆盖。

### 5. gosom `extra_reviews:true` + `fast_mode:false` 真拿到 8 reviews

实测 cairns plumber · 40 商家 · 121s (2 分钟):

```
商家: Alfa Plumbing Gas Services Cairns
  review_count: 96
  user_reviews: 8 条 (前 8 · 不是全 96)
  每条含: Name / ProfilePicture / Rating / Description (全文)
```

→ **M2-D2 修正**:
- 不是 "全部 reviews" · 是**前 8 条 + 完整 description** (Places 5 条 · gosom 8 条多 60%)
- 时间 2-3 分钟 / 40 商家 = 3 秒/商家 · 没 timeout 问题
- Format 是 JSON array `{Name, Rating, Description}` · **跟 Places `{author_name, rating, text}` 不同**
- 需写 adapter (`docker-review-format-to-places.js` ~30 LOC) · 让 `analyze-reviews.js` 不改动消费

### 6. C-grade 邮件 API 都在 · 缺自组模板

实测:
- ✅ `core/funnel/email-template.js · renderProfitsLocalEmail({subject, intro, sections, cta...})` 通用 HTML 渲染器
- ✅ `core/integrations/agentic-inbox.js · sendOutbound({to, subject, html, entityKey, variantId})` 真发 API
- ⚠️ 需 env: `AGENTIC_INBOX_URL` · `AGENTIC_INBOX_MAILBOX_ID` · 加 CF Access token
- ❌ **无 C-grade 专用 template** · 要自组

→ M2-D4 新增 `core/funnel/c-grade-template.js` (~80 LOC) · 用 master.md.frontmatter 拼 sections / cta。

### 7. master-md-builder 21 section · 17 个 conditional · 仅 4 永远输出

严扫 builder · guard 状态:

**永远输出 (4 个)**:
- 内部分级 · 运营优先看这段
- 一、店家现状速览
- 二、客户访问时看到的页面
- 附录 · 数据出处

**条件输出 (17 个)** · 我以前列的 "五/六/七 required" 当前都是 conditional:
- 五、当前漏水 → `IF allCritical.length || allMajor.length`
- 六、Redesign 发力点 → `IF redesignHooks.length`
- 七、销售切入点 → `IF salesAngles.length`

→ M2-D6 修正:
- 改 builder · 5/6/7 三章改成 always output · 数据不足输出占位 `**TBD · audit 不完整**`
- 同时 七、销售切入点 移到 一、 速览 之后 (位置 二、)
- ~50 LOC 改 builder

### 8. Stuck entity 重数 = 94 (不是 96)

实测 entity store:
- Total: 192
- 卡 `queued_for_audit` 且无 V2 phase: **94**

→ M1-D5 bulk-archive 应处理 94 个 · 不是 96。

### 9. niche 不规范 + 20 个 empty niche

实测 niche 分布:
```
roofer = 60
restaurant = 37
plumber = 32
roofing = 25       ← 跟 roofer 重复
(empty) = 20
dentist = 12
cafe = 6
```

→ M2-D1 `--all-niches` 改造必须包含:
- niche normalize map (`roofing → roofer · plumbing → plumber · etc`)
- empty niche entity · skip (不跑 rescore)

---

## M2-D7 niche-tone map · 需 Matthew 决策 (不是研究能定)

我猜的 tone:
```js
const NICHE_TONE_MAP = {
  restaurant: 'Luxury · 看 rating ≥ 4.5; Warm 看 review_count > 50',
  cafe: 'Warm · 社交友好 · Instagram 风',
  plumber: 'Trust · 24/7 · 紧急可靠',
  roofer: 'Trust · 抗气候 · QBCC 牌照',
  dentist: 'Clean · 专业 · gentle',
  lawyer: '?',
  hairdresser: '?',
  ...
};
```

请 Matthew 决:
1. 这 5 个对吗？
2. 哪些 niche 还要加？
3. 还是希望 V3 默认通用 tone "Match brand · refined" 不细分？

---

## 还在 Matthew 那的 open issues 总览

**M1**:
1. bulk-archive 标 archived (不删) · OK?
2. 5-key M1 · ABN/lat-lng V3.1 · OK?
3. LLM dedup decider 用 Claude · OK?
4. Hermes skill 只装 marketer profile (其余跳) · OK?
5. bulk-archive 跑前先 backup entity store · OK?
6. 🆕 **V3 skill 是 deprecate 老的 webjuice-outbound-pipeline 吗** · OK?

**M2**:
1. niche normalize: `roofing → roofer` + empty=skip · OK?
2. docker extra_reviews 时间 2-3 min/40 商家 (实测) · 接受?
3. C-grade batch send 先 dry-run 1 周 · OK?
4. 30 天 staleness 全 niche 统一 · OK?
5. OD invoke fail · 仍出 master.md 标 od_status=failed · OK?
6. 🆕 **niche-tone map · 上面 5 个 default + 通用 fallback** · OK?

---

## 我现在做的 (commit + push)

1. 这个 verification 文档进 git
2. M1 PRD + M2 PRD 加 §13 (本文档引用)
3. push v3-modular branch · 你 GitHub 看
4. 等你回**13 个 open issue** (6 M1 + 7 M2)
