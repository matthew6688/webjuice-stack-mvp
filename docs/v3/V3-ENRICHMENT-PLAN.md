# V3 · Enrichment + Sitemap Surface Plan

> **目的**: 不改变现有 pipeline 大结构 · 把 4 个新数据源 (Tinyfish · WHOIS · ABN · Wayback) + 已有 sitemap 分类数据 surface 到 master.md + internal-audit · 同时把 GMB 链接补到 master.md
> **状态**: 计划阶段 · 未执行
> **不属于本文范围**: V4 整体 pipeline 重构 → 见 [`docs/v4/`](../v4/)
> **关系**: 是 V3 周期的 incremental enhancement · 也为 V4 提前铺路 (用同一份 data 结构)

---

## 三个独立任务

| 任务 | 工作量 | 风险 | 验证 |
|---|---|---|---|
| **Task 1 · GMB 链接补 master.md** | 30 min | 0 (纯 renderer) | 5 entities 重生 master.md · grep "GMB:" |
| **Task 2 · Sitemap 分类 surface 到 3 文档** | 2 hr | 低 (renderer 改) | 10 domains 跑 · 检查 master.md / handoff / audit 含分类段 |
| **Task 3 · 4 路 enrichment + 数据集成** | 2-3 天 | 低 (additive · 新建模块 · 不动 pipeline) | 5 entities 全套数据 · 渲染 · 跟 LOCKED 契约对齐 |

---

## Task 1 · GMB 链接补 master.md (30 min)

### 现状
- profile card 已有 `GMB: [Google 地图](url)` 行 (commit 4e83481f)
- master.md 只有 `一(a)、商户视觉素材 (GMB)` 段 (photos) · 没有 GMB profile link

### 改动
**1 个文件 · 1 个位置 · ~5 行**:

`core/reports/master-md-builder.js` 里 · 在"一、店家现状速览"段加一行:

```markdown
- 电话: ...
- 地址: ...
- 网站: ...
- **GMB**: [Google 地图查看](https://maps.google.com/?cid=...) ← 新加
```

GMB URL 派生用现有 `core/funnel/profile-card.js::buildGmbUrl()` (4 fallback · place_id → cid → data_id ftid) · 抽成 utility 函数 `core/util/gmb-url.js` · profile-card.js + master-md-builder.js 都引用 (DRY)。

### 验证 gate
- 跑 `leads:build-master-md --all-with-detailed` 重生 5 entities master.md
- ✓ 5/5 entities · master.md 含 `GMB: [Google 地图查看]` 行
- ✓ URL 形态正确 (`https://maps.google.com/?cid=...` 或 `?ftid=...`)

---

## Task 2 · Sitemap 分类 surface (2 hr)

### 现状

`core/audit/sitemap-analyzer.js` 已经返回:
```json
{
  "total_urls": 41,
  "content_url_count": 38,
  "seo_structure": {
    "service_page_count": 5,
    "area_page_count": 3,
    "service_area_page_count": 8,           ← 长尾 SEO 落地页
    "service_page_samples": ["/roof-repair", ...],
    "area_page_samples": ["/areas/brisbane", ...],
    "service_area_page_samples": ["/roof-repair-brisbane-cbd", ...],
    "long_tail_coverage": "strong"            ← strong / moderate / service_only_no_area / minimal / none
  },
  "redirect_plan": [{ from, suggested_to, kind: "service_area_page" | "service_page" | "about" | ... }]
}
```

**问题**: 这些字段在 entity 的 audit fixture 里 · 但 master.md / handoff / internal-audit.html **都没渲染**。

### 改动

**3 个 renderer 加新段**:

**A. master-md-builder.js · 新段"十、SEO 迁移评估 与 运营活跃度"** (现有段 · 加内容):
```markdown
## 十、SEO 迁移评估 与 运营活跃度

### sitemap 分类 (cycle-V3 enrichment 新)
- 总 URL: 41 个
- 内容页 (过滤 CMS 噪音): 38 个
- 长尾 SEO 落地页覆盖度: **strong** (8 个 service-area combos)

### 页面分布
| 类型 | 数量 | 示例 |
|---|---|---|
| 导航页 (home/about/contact/services 等) | 11 | /, /about-us, /contact-us, ... |
| 服务页 (single service) | 5 | /roof-repair, /metal-roofing |
| 区域页 (single area) | 3 | /areas/brisbane |
| **长尾 SEO 落地页 (service × area)** | **8** | /roof-repair-brisbane-cbd, /metal-roofing-inner-brisbane, ... |
| 博客 / 项目页 | 11 |

### 长尾覆盖评估
strong · 已有完善 service × area 矩阵 · redesign 必须保留 → 否则会丢失这部分 SEO 流量
```

**B. final-prompt.md (handoff aggregator · Task 3 内部一并加) · 新段"⑨ SEO 迁移评估"**:
```markdown
## ⑨ Sitemap 分类 + 迁移评估
现有 sitemap URL 分类 (38 内容页):
- 11 个导航页 · 必须保留
- 5 个服务页 · 必须保留 + 在新站做对应 service 详情页
- 8 个 service-area 长尾页 · **CRITICAL · 不能丢 · build 必须新建对应页**

### Redirect plan (旧 → 新)
| 旧 URL | 新 URL | 类型 |
|---|---|---|
| /roof-repair-brisbane | /roof-repair-brisbane-cbd | service_area_page |
| /metal-roofing-northside | /metal-roofing-brisbane-northside | service_area_page |
```

**C. internal-audit-report.html · 新段"SEO 长尾分布"**:
```html
<section>
  <h2>SEO 长尾覆盖度</h2>
  <p>long_tail_coverage: <b>strong</b></p>
  <table>
    <tr><th>类型</th><th>数量</th><th>含义</th></tr>
    <tr><td>service_area combos</td><td>8</td><td>每个组合是一个本地 SEO 入口</td></tr>
    <tr><td>service-only</td><td>5</td><td>主服务页</td></tr>
    <tr><td>area-only</td><td>3</td><td>区域聚合页</td></tr>
  </table>
  <p>意义: 现网 SEO 长尾已建 → redesign 必须 1:1 保留 + 拓展</p>
</section>
```

### 多 domain 验证
我说"如果多个 domain 都验证有效":

**验证脚本**: `scripts/cli/pl-sitemap-classify-bench.js`
- 跑 10 个 domain (mix: 大型 SEO 站 / 小 biz 站 / 无 sitemap 站)
- 输出 service_area_page_count · 由人工 spot-check 是否准 (随机抽 5 个 URL 看分类对不对)
- 准确率 ≥ 80% → 通过 · 写入 3 文档

### 验证 gate
- 10 domain · 准确率 ≥ 80% (人工抽 5 URL × 10 = 50 sample 检查 classifyUrl 结果)
- master.md / final-prompt / audit HTML 各加一段 · 5 entities 重生 · 内容正确

---

## Task 3 · 4 路 enrichment 集成 (2-3 天 · 不破坏现有流程)

### 设计原则
- **新建模块 · 不改老模块** · 全部代码在 `core/enrichment/*` (新目录)
- **数据写新字段** · `entity.enrichment.*` 子树 · 不动 `entity.latest` / `entity.identifiers`
- **renderer 加新段** · master.md + audit HTML 加段 · 不改老段
- **hook 1 个点**: `scripts/leads/run-audit-pipeline.js` 在 audit 完后追加 1 行调 enrichment · 失败不阻塞

### 3.1 新模块结构

```
core/enrichment/
├── index.js                       ← 主入口 · enrichEntity(entity) → entity.enrichment.*
├── abr-abn.js                     ← ABR API client (SearchByName · AbnDetails)
├── whois-rdap.js                  ← RDAP client (rdap.org/domain/<d>)
├── wayback.js                     ← archive.org first snapshot probe
├── tinyfish-search-summary.js     ← Tinyfish search "name+city+niche" + LLM 后过滤 "非澳洲"
└── tinyfish-fetch-summary.js      ← Tinyfish fetch homepage · markdown 摘要 (我们已经在做 customer-summary · 这个是更轻版)
```

### 3.2 enrichEntity API

```js
// core/enrichment/index.js
export async function enrichEntity(entity, opts = {}) {
  const enrichment = entity.enrichment || {};
  const tasks = [];

  // 4 路并发 · 失败不阻塞 · 各自单独 try/catch
  if (entity.identifiers?.websiteDomain || entity.latest?.website) {
    tasks.push(whoisLookup(entity).then(r => enrichment.whois = r).catch(() => {}));
    tasks.push(waybackLookup(entity).then(r => enrichment.wayback = r).catch(() => {}));
  }
  if (entity.latest?.name && entity.latest?.city) {
    tasks.push(abnSearch(entity).then(r => enrichment.abn = r).catch(() => {}));
    tasks.push(tinyfishSearch(entity).then(r => enrichment.tinyfish_search = r).catch(() => {}));
  }
  if (entity.latest?.website) {
    tasks.push(tinyfishFetch(entity).then(r => enrichment.tinyfish_homepage = r).catch(() => {}));
  }

  await Promise.all(tasks);
  enrichment._meta = {
    enriched_at: new Date().toISOString(),
    sources_attempted: 5,
    sources_succeeded: Object.keys(enrichment).filter(k => k !== '_meta').length,
  };
  return { ...entity, enrichment };
}
```

### 3.3 entity 新字段 schema

```json
{
  "entityKey": "...",
  "latest": { /* 不动 */ },
  "identifiers": { /* 不动 */ },
  "audit": { /* 不动 */ },
  "grade": { /* 不动 */ },
  "phase": "...",
  
  "enrichment": {                    ← 新加 · 老 entity 没这字段 · 新 entity 有
    "whois": {
      "domain": "viproofingbrisbane.com.au",
      "registered_at": "2020-08-12",
      "registrar": "Identity Digital Australia",
      "domain_age_years": 5,
      "expires_at": "2026-08-12",
      "status": "ok"
    },
    "wayback": {
      "first_snapshot": "2020-09-03",
      "first_snapshot_url": "https://web.archive.org/web/20200903...",
      "total_snapshots": 47,
      "last_snapshot": "2025-12-15"
    },
    "abn": {
      "abn": "12 345 678 901",
      "status": "Active",
      "registered_at": "2018-03-15",
      "entity_type": "Australian Private Company",
      "entity_name": "VIP Roofing Brisbane Pty Ltd",
      "trading_names": ["VIP Roofing Brisbane"],
      "gst_registered": true,
      "search_method": "by_name"
    },
    "tinyfish_search": {
      "query": "VIP Roofing Brisbane brisbane roofer",
      "location": "Brisbane, Australia",
      "results_total": 10,
      "results_au_filtered": 7,         ← LLM 后过滤掉非澳洲
      "external_mentions": [
        { "title": "...", "url": "https://yelp.com/...", "domain": "yelp.com" },
        { "title": "...", "url": "https://facebook.com/...", "domain": "facebook.com" }
      ],
      "latency_ms": 1842
    },
    "tinyfish_homepage": {
      "url": "https://viproofingbrisbane.com.au/",
      "fetched_at": "2026-05-16T...",
      "markdown_bytes": 4134,
      "title": "...",
      "description": "...",
      "extracted_signals": {
        "phone_present_in_md": true,
        "city_mentioned_count": 3,
        "service_keywords_found": ["roofing", "gutter"],
        "trust_keywords_found": ["QBCC", "licensed"],
        "year_mentioned": 2018
      }
    },
    "_meta": {
      "enriched_at": "2026-05-16T...",
      "sources_attempted": 5,
      "sources_succeeded": 4
    }
  }
}
```

### 3.4 hook 进现有 pipeline (1 个改动点)

`scripts/leads/run-audit-pipeline.js` 在 detailed audit 完成 + grade 写入 entity 后 · 追加 1 行:

```javascript
// 现有代码:
const leadGrade = gradeLead({ ... });
persistLeadGrade({ entityKey, grade: leadGrade });

// ============ NEW · 追加 ============
try {
  const { enrichEntity } = await import('../../core/enrichment/index.js');
  const enriched = await enrichEntity(entity, { timeout_ms: 20_000 });
  writeEntity(enriched);  // 用现有 writeEntity helper
  console.log(`  [enrichment] sources=${enriched.enrichment._meta.sources_succeeded}/${enriched.enrichment._meta.sources_attempted}`);
} catch (err) {
  console.warn(`  [enrichment] failed (non-blocking): ${err.message}`);
}
// ============ END NEW ============
```

**特性**:
- 失败不阻塞 · audit 继续走完整流程
- 老 entity 没跑过 enrichment → 没 `entity.enrichment` 字段 · renderer fallback null check
- 新 entity 自动跑

### 3.5 renderer 加新段 (master.md + audit HTML)

**A. master.md 加新段 "十一(b)、域名 / ABN / Wayback 硬数据 (cycle-V3 新)"**:

```markdown
## 十一(b)、域名 / ABN / Wayback 硬数据

### 公司注册 (ABR)
- ABN: **12 345 678 901** · Active
- 注册日: 2018-03-15 · 经营 7 年
- 实体类型: Australian Private Company
- GST 注册: 是
- 注册名: VIP Roofing Brisbane Pty Ltd

### 域名 (WHOIS RDAP)
- 注册商: Identity Digital Australia
- 注册日: 2020-08-12
- 域名年龄: 5 年
- 到期日: 2026-08-12

### Wayback Machine
- 第一次上线: 2020-09-03 ([历史首版](https://web.archive.org/web/20200903...))
- 总快照数: 47
- 最近快照: 2025-12-15

### 外部 mentions (Tinyfish search · AU 过滤)
- Yelp listing ↗
- Facebook page ↗
- 5 个其他目录站 (Truelocal / Whereis / etc.)
```

**B. master.md 加新段 "十二(b)、官网内容摘要 (Tinyfish fetch)"**:

```markdown
## 十二(b)、官网内容摘要

> Tinyfish fetched 4134 bytes markdown · 提取的关键信号:

- 电话在首页可见: ✓
- 城市名 mention 数: 3
- 服务关键词: roofing · gutter
- 信任关键词: QBCC · licensed
- 年份提及: 2018
```

**C. internal-audit-report.html 加 2 个段**:
```html
<section>
  <h2>商家注册档案 (ABR)</h2>
  <dl>
    <dt>ABN</dt><dd>12 345 678 901 · Active</dd>
    <dt>注册日</dt><dd>2018-03-15 · 经营 7 年</dd>
    ...
  </dl>
</section>

<section>
  <h2>域名历史 (WHOIS + Wayback)</h2>
  <dl>
    <dt>注册商</dt><dd>Identity Digital Australia</dd>
    <dt>域名年龄</dt><dd>5 年</dd>
    <dt>第一次上线</dt><dd>2020-09-03</dd>
    ...
  </dl>
</section>
```

### 3.6 验证 gate

**Phase 3.A · API 单测**:
- 跑 5 entities 跑 enrichment
- ✓ ABR 成功率 ≥ 60% (小 biz 没注册 ABN 容忍)
- ✓ WHOIS 成功率 ≥ 90%
- ✓ Wayback 成功率 ≥ 70%
- ✓ Tinyfish search 成功率 ≥ 95%
- ✓ Tinyfish fetch 成功率 ≥ 85% (现网 dead/parked 容忍)

**Phase 3.B · pipeline 集成测试**:
- 跑 5 entities 全 pipeline (audit + enrichment + master.md + audit HTML 重生)
- ✓ entity.enrichment 字段写入 5/5
- ✓ enrichment 失败不阻塞 (mock ABR down · pipeline 继续)
- ✓ 老 entity 重渲染 master.md · 没 enrichment 字段 → 新段隐藏 · 老段不变

**Phase 3.C · 数据保护契约 (LOCKED)**:
- ✓ ABN 数字 verbatim · master.md 里跟 entity.enrichment.abn.abn 1:1
- ✓ WHOIS 日期 verbatim · 没 LLM 重写
- ✓ Wayback URL verbatim

---

## 4 个 API 详细 spec

### 4.1 ABR (ABN lookup)
- Endpoint: `https://abr.business.gov.au/json/AbnDetails.aspx?abn=XXX` (直接查) OR `https://abr.business.gov.au/json/MatchingNames.aspx?name=XXX&maxResults=10` (按名查)
- Auth: 免费 (需注册 GUID 但 1 分钟搞定)
- Rate limit: 自评 (没公开数字)
- 失败处理: 缓存负面结果 (同名 biz 不重查) · 24h TTL

### 4.2 WHOIS (RDAP)
- Endpoint: `https://rdap.org/domain/<domain>`
- Auth: 无 · 完全公开
- Rate limit: 一般站 1 req/sec
- 失败处理: 不缓存负面 (域名状态可能变)

### 4.3 Wayback
- Endpoint: `https://archive.org/wayback/available?url=<URL>&timestamp=2000`
- Auth: 无
- Rate limit: 较宽松
- 失败处理: 容忍 timeout

### 4.4 Tinyfish search + fetch
- 已有 client `core/extractors/tinyfish.js`
- 复用 · 不重写

---

## 总计 · 工作量 + 验证

| Task | 工时 | 文件改动 | 风险 |
|---|---|---|---|
| 1 · GMB → master.md | 30 min | 1 文件 (master-md-builder.js) + 1 新 util | 0 |
| 2 · Sitemap 分类 surface (3 文档) | 2 hr | 3 renderer + 1 验证 CLI | 低 |
| 3.A · 4 enrichment 模块 | 1 天 | 5 新文件 `core/enrichment/*` | 0 (新建) |
| 3.B · pipeline hook + entity schema | 0.5 天 | 1 文件 (run-audit-pipeline.js · 加 try/catch 块) | 低 (失败不阻塞) |
| 3.C · 3 renderer 加新段 | 1 天 | master-md-builder.js + audit HTML 生成器 + final-prompt aggregator | 低 (additive) |
| **总** | **2.5-3 天** | **9 文件** | **低** (全 additive · 老 entity 不受影响) |

---

## 验证 gate 总览

| Gate | 测试 | 通过标准 |
|---|---|---|
| 1 | 5 entities 重生 master.md | 含 GMB 行 · 100% |
| 2 | 10 domains sitemap classify bench | 准确率 ≥ 80% (50 URL 抽样 spot-check) |
| 3A | 5 entities 跑 enrichEntity | 4/5 sources 成功率达标 |
| 3B | 5 entities 全 pipeline | enrichment 失败不阻塞 · 老 entity 不受影响 |
| 3C | LOCKED 字段对照 | ABN/WHOIS/Wayback 数字/日期 verbatim |

全 5 gate 通过 → V3 enrichment 上线。

---

## 后续 (本计划之外)

- enrichment 数据用到 light-audit (Stage 1 评分 · V4 才落)
- enrichment 数据进 customer-summary LLM input (V4)
- enrichment doctor (weekly · 检查 API 失败率)
- Wayback diff (检测客户网站重建/重大改动)

这些都进 V4 计划 · 不在本任务范围。

---

## 决策记录

| # | 决策 | 选项 | 时间 |
|---|---|---|---|
| E1 | enrichment 模块全新建 · 不动现有 pipeline 代码 | ✅ | 2026-05-16 |
| E2 | 入口 hook 在 run-audit-pipeline.js · grade 写完之后 1 行 | ✅ | 2026-05-16 |
| E3 | entity.enrichment.* 子树 · 不动 entity.latest / identifiers | ✅ | 2026-05-16 |
| E4 | enrichment 失败不阻塞 · audit pipeline 正常完成 | ✅ | 2026-05-16 |
| E5 | renderer 老段不动 · 加新段 (老 entity 没 enrichment 字段 → 段隐藏) | ✅ | 2026-05-16 |
| E6 | sitemap 分类已有 · 只补 renderer (不重做 classifyUrl) | ✅ | 2026-05-16 |
| E7 | 10 domains 抽样 50 URL 验证 classifyUrl 准确率 ≥ 80% 才上线 | ✅ | 2026-05-16 |
| E8 | LOCKED 字段 verbatim 检 · 数字/ABN/日期/URL 1:1 | ✅ | 2026-05-16 |

---

## 文档版本

- v1 · 2026-05-16 · Matthew + Claude · V3 enrichment 计划 · 未执行
