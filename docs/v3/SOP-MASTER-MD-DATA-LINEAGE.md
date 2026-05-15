# SOP · master.md 数据血缘 (Data Lineage)

> cycle-26 (2026-05-15 · Matthew sign-off)
> Single source of truth for **how each data point in master.md is produced**.
>
> 规则: 任何 master.md section 的 bug · 都要从这张表追到数据源 stage · 不要在 builder 层贴补丁。

---

## 0 · 全景: 9-Stage Pipeline → master.md

```
Stage 1 抓客户 ────────────────► entity.latest (name/phone/website/rating/review_count/...)
Stage 2 排除筛选 ──────────────► entity.exclusion_filter (verdict/layer/reasons)
Stage 3 网站审计 (Playwright) ─► detailed_audit (score/decision/issues + 12 sub-modules)
Stage 4 视觉审计 (Vision LLM) ─► visual_audit (freshness/trust/conversion + issues)
Stage 5 打分定级 ──────────────► entity.grade (A/B/C/D + product_tier + pricing)
Stage 6 内部审计报告 (本地) ───► clients/<slug>/v2/master.md (this file)
Stage 7 资格复核 ──────────────► entity.qualification (hard_gates/scorecard/verdict)
Stage 8 建 demo ───────────────► clients/<slug>/v2/concept/reference-adapter/index.html
Stage 9 发布上线 ──────────────► CF Pages live URL + entity.phase=outreach-active
```

master.md = **Stage 6 输出** · 它消费 Stage 1-4 数据 (Stage 5/7/8/9 元数据另存)。

---

## 1 · master.md 完整数据来源表

### Frontmatter (YAML)

| 字段 | 数据源 | 服务/技术 | 目的 (Why) | populate 保证 |
|---|---|---|---|---|
| `business_id` | `entity.entityKey` | discovery-store key | 内部唯一 ID · 跨系统追溯 | 必填 · openLeadThread/buildMasterMd assert |
| `business_name` | `entity.latest.name` | gosom docker scraper Stage 1 | 报告标题 + 销售开场白 | gosom 返回 title 字段 · 必填 |
| `niche` | `entity.latest.niche \|\| category` | gosom / Places API | 行业打分模板 / 销售话术 | intent-router 提取 · niche-config lookup |
| `city` | `entity.latest.city` | gosom (geocoded) | 地区相关销售话术 | gosom 必返 |
| `rating` | `entity.latest.rating` | gosom (Google Maps) | GBP 信号 · 客户口碑强弱判断 | gosom CSV `review_rating` |
| `review_count` | `entity.latest.review_count` | gosom (Google Maps) | 业务规模信号 · niche-config 阈值判断 | gosom CSV `review_count` |
| `website` | `entity.latest.website` | gosom + (optional) enrichment | 是否有独立网站 · 决定 audit 路径 | gosom `web_site` |
| `audit_score` | `detailed_audit.audit_score` | Stage 3 detailedAudit (Playwright + 12-dim DOM rules) | 0-100 综合分 · 销售优先级 | run-audit-pipeline.js Stage 3 写入 |
| `decision` | `detailed_audit.decision` | Stage 3 rescore-v2 | low_priority/moderate/strong_redesign | 同上 |
| `fired_triggers` | `detailed_audit.hard_triggers` | Stage 3 DOM rules | no_https / no_phone / 高优先 alarm | Playwright fetch + DOM scan |
| `visual_freshness/trust/conversion` | `visual_audit.*_score` | Stage 4 Vision LLM (codex_cli/claude_cli/ollama) | 0-10 视觉评分 · 报告核心数据 | rescore-v2 vision call |
| `visual_age` | `visual_audit.design_age_estimate` | Stage 4 Vision LLM | "outdated"/"slightly_outdated" 时代标签 | 同上 |
| `review_trust_signal` | `reviewAnalysis.trust_signal_strength` | (optional) Google Places review analysis | 'strong'/'medium'/'weak' · 销售开场 | review-fetch (T2 paid) |
| `assets.evidence_count` | `clients/<slug>/v2/evidence/*.png` count | Stage 4 截图 + 标注 (本地 Playwright) | 客户证据 PNG 数量 | listEvidence(slug) count |
| `assets.video_url` | `clients/<slug>/v2/video/mobile-throttled.webm` | Stage 4 (Playwright video record · 3G throttle) | mobile 实测视频 | 文件存在性 check |
| `assets.desktop_screenshot` | `clients/<slug>/v2/screenshots/desktop.png` | Stage 4 Playwright 截图 | 桌面端首屏对比 | Playwright headless screenshot |
| `assets.mobile_screenshot` | `clients/<slug>/v2/screenshots/mobile.png` | Stage 4 Playwright 截图 | 移动端首屏对比 | 同上 (mobile viewport) |
| `generated_at` | `new Date().toISOString()` | builder runtime | 报告生成时间 | 总是有值 |

### Body Sections (22 个 H2)

| # | Section | 数据源 | 服务/技术 | 目的 | populate 保证 |
|---|---|---|---|---|---|
| 1 | **内部分级 · 运营优先看这段** | `grading = gradeLead({...})` | `core/scoring/lead-grading.js` (Stage 5) | A/B/C/D 等级 + 产品档位 + 报价 | 总是渲染 · grade 函数 null-safe |
| 2 | **一、店家现状速览** | `entity.latest` + `audit.hard_triggers` | Stage 1 + Stage 3 | 业务基本信息 + 已触发警告 | 必渲染 |
| 2a | **来源** (sales context) | `entity.latest.sourceType/sourceQuery/discovery_rank` | Stage 1 batch metadata | 销售开场: "我搜 X 时找到你" | 总有 (gosom 写) |
| 3 | **一(a)、商户视觉素材 (GMB)** | `entity.gbp_photos[]` | (optional) GBP scrape | 客户 Google Maps 已发图 vs 网站现状对比 | 条件渲染 · GBP scraper 启用才有 |
| 4 | **二、客户访问时看到的页面** | desktop.png + mobile.png + video | Stage 4 Playwright | 客户视角 · 真实首屏体验 | 截图必在 · video 可选 |
| 5 | **三、视觉审计 · Vision LLM 怎么看** | `visualAudit.parsedJson.issues[]` | Stage 4 Vision LLM | 视觉问题列表 + 严重度 + 修复方向 | LLM 返回 JSON parsed |
| 6 | **四、客户在 Google 上怎么说** | `reviewAnalysis` | (optional T2) Places API + LLM 总结 | 客户口碑分析 · 销售切入 | review fetch 启用才有 |
| 7 | **五、当前网站在哪里漏水** | `detailedAudit.issues.critical/major/minor` | Stage 3 12-dim DOM rules + LLM evidence | 技术问题 3-layer (技术事实/普通话/客户影响) | 必渲染 |
| 8 | **六、Redesign 的发力点** | `audit.redesign_priorities` + `visual.recommendations` | Stage 3 + 4 综合 | 销售提案核心 | 条件 |
| 9 | **七、推荐销售切入点** | `deriveSalesAngles({audit, reviewAnalysis})` | builder 计算 (rule-based) | 1-3 句销售话术 | 总渲染 |
| 10 | **GBP Posts 与 Q&A** | `gbpExtras` | (optional) GBP posts/Q&A scrape | GBP 运营活跃度 | grade-gated (B+ 才采集) |
| 11 | **真实速度数据 · Google PageSpeed Insights** | `pagespeed.results.mobile/desktop` | Google PageSpeed Insights API | LCP/FCP/CLS/TBT · 真实 CRUX 字段数据 | PSI API key 配置时有 |
| 12 | **图片优化与第三方脚本体重** | `imageOptimization` + `thirdPartyWeight` | Stage 3 (本地 Playwright + 网络拦截) | 重 site / 3rd-party tracker 数量 | Stage 3 内置 |
| 13 | **SEO 迁移评估 与 运营活跃度** | `sitemapAnalysis` + `activity` | Stage 3 sitemap parser + freshness check | 迁移成本 + 业务活跃度 | 必有 |
| 14 | **联系表单与防垃圾设置** | `formAudit` | Stage 3 Playwright form submit test | 表单可用 + captcha + spam protection | Stage 3 内置 |
| 15 | **域名历史与邮件信誉** | `domainHistory` | whois + Wayback Machine + DNS SPF/DKIM/DMARC | 域名年龄 + 邮件营销可行性 | 第三方查询 |
| 16 | **技术栈与营销基建** | `techStack` | Stage 3 HTML 解析 + 已知库指纹匹配 | CMS / analytics / pixels 清单 | 必有 |
| 17 | **AI 时代可发现性 · GEO Readiness** | `aiGeo` | Stage 3 12-checks (schema.org, llms.txt, robots.txt 等) | AI 搜索 (Perplexity/ChatGPT) 可发现度 | Stage 3 内置 |
| 18 | **业务规模信号 · 内部筛选用** | `deriveBusinessSizeSignal()` | builder rule-based | 大企业/中/小 自动分类 (内部) | 总渲染 |
| 19 | **Upsell 机会** | `audit.upsell_opportunities` | Stage 3 + 4 综合 (SMM / 内容 / 广告 ROI) | redesign 之外月度营收来源 | 条件 |
| 20 | **附录 · 数据出处** | `audit.cheap_config_version` + `visualAudit.provider/model` + `reviewBundle.source` | metadata | 调试/审计 · 哪个版本/哪个 LLM/哪个 review 源 | 总渲染 |

---

## 2 · 每个数据 populate 的失败模式 + 防护

### Stage 1 抓客户 (entity.latest)

**服务**: gosom docker scraper (T0 本地免费 · `core/scrape/dokobot.js`)
**失败模式**:
- gosom 返回空 (该地区 0 商家) → `entity.latest = {}` → buildFrontmatter 字段全 null
- gosom 字段缺失 (review_count 偶尔为 "" 字符串) → 数字字段需 `?? null` fallback
**防护**:
- builder line 71-73 `?? null` ✓
- TDD: 给空 entity · 验证 builder 不 crash · 返回 minimal markdown

### Stage 3 网站审计 (detailed_audit)

**服务**: Playwright headless Chromium (T0 本地免费 · `core/audit/site-fetch-full.js`)
**子模块**:
- `tech_stack` = `detectTechStack()` · HTML 解析
- `sitemap_analysis` = `analyzeSitemap()` · /sitemap.xml + /robots.txt
- `activity` = `auditActivity()` · 最近 post / Twitter activity
- `ai_geo` = `auditAiGeoReadiness()` · schema.org markup
- `pagespeed` = `pagespeedAudit()` · **Google PSI API** (T2 metered)
- `form_audit` = `auditFormsOnPage()` · Playwright form interaction
- `domain_history` = `auditDomainHistory()` · whois + Wayback Machine + DNS
- `image_optimization` = `auditImageOptimization()` · `<img>` srcset/lazy check
- `trust_signals` = `auditTrustSignals()` · 行业 adapter (QBCC for AU builders, ABN check)
- `third_party_weight` = `attachThirdPartyWeightInterceptor()` · Playwright network log

**失败模式**:
- Playwright 启动失败 (Chromium 没装) → 整个 Stage 3 失败 · master.md 没 detailed_audit
- PSI API 401 (key 配置错) → pagespeed 节为 null
- Domain whois rate-limited → domain_history 部分字段 null
- 单网站 fetch 超时 (45s) → fallback 用 markdown 模式

**防护**:
- builder line 75-83 全部 `detailed?.xxx || null` ✓
- 每 sub-module 独立 try-catch · 一个失败不阻塞其他
- TDD: 给 detailed=null · 验证 builder 跳过 sections 不 crash

### Stage 4 视觉审计 (visual_audit)

**服务**: LLM Vision (cascade · codex_cli > claude_cli > ollama qwen3.6:27b)
**输出 schema**:
```json
{
  "freshness_score": 6,
  "trust_score": 6,
  "conversion_score": 5,
  "design_age_estimate": "slightly_outdated",
  "issues": [{ id, title, severity, what_observed, plain_language, customer_impact, ... }],
  "provider": "codex_cli",
  "model": "gpt-5",
  "latency_ms": 62000
}
```

**失败模式**:
- LLM 返回非 JSON / JSON parse fail → `parsedJson = null` → master.md visual section 缺
- ollama fallback 给奇怪的中英混合 issues → render 时仍 OK 但质量差
- 截图丢失 → vision LLM 无 input · 返回 "无法判断"

**防护**:
- builder line 67 `visualAudit || {}` ✓
- rescore-v2 内部 cascade · 任一 provider 成功就用
- TDD: 给 visual=null · 验证 Section 5 整段跳过

### Stage 5 打分定级 (entity.grade)

**服务**: `core/scoring/lead-grading.js` (pure JS · rule-based)
**输出**:
```js
{
  investment_level: 'A'|'B'|'C'|'D',
  product_tier: 'T1'|'T2'|'T3',
  recommended_pricing: { one_time, monthly },
  investment_factors: ['触发原因 1', ...],
  skip_reasons: [{ id, reason }]
}
```
**失败模式**:
- 数据不全时返回 'C' grade default + 无 factors → master.md 内部分级段落空
**防护**: gradeLead 内 100% null-safe · 总返回有效对象

---

## 3 · TDD: master.md 数据完整性测试

按 cycle-26 TDD discipline · 测试 = spec · 测试通过 = 报告 populate 正确。

### Test fixture 设计

3 套 fixture · 覆盖 ready-to-build (data full) · qa-pending (partial) · D-grade (minimal):

**Fixture A · Full audit** (Trusted Roof Restorations 真数据)
- entity.latest 全字段
- detailed_audit 全 12 sub-modules
- visual_audit 全字段
- review_bundle 在
- gbp_extras 在
- cloudinary_manifest 在

**Fixture B · Partial** (典型本批)
- entity.latest 在
- detailed_audit 在 · 但 pagespeed=null (无 API key) · domain_history=null (rate-limited)
- visual_audit 在
- review_bundle=null
- gbp_extras=null

**Fixture C · Minimal** (Stage 1 完 · Stage 3 失败)
- entity.latest 在
- 其他全 null

### Assertions per fixture

**Fixture A 应验证**:
1. Frontmatter 18 个字段全有非 null 值 (除 review_trust_signal 如 N/A)
2. master.md 含 20 个 section (`## ` 开头)
3. 每个 section 有非空 body (至少 200 字节)
4. fired_triggers 列出 · sales_angles 推导出
5. 内部分级 grade=A/B/C (非 D)
6. Vision issues count ≥ 5

**Fixture B 应验证**:
1. Frontmatter pagespeed/domain_history 相关字段为 null
2. master.md 跳过 PSI section · 域名历史 section
3. 仍有 ≥ 12 section
4. 内部分级仍渲染
5. 不 crash

**Fixture C 应验证**:
1. Frontmatter 只有 entity.latest 相关字段 + null 其他
2. master.md 仅 渲染必填 sections (现状速览 + 内部分级 + 附录)
3. 总 section ≥ 3
4. 不 crash · 输出 valid markdown

### 防回归 invariants (无关 fixture · 任何 build)

- master.md 总以 `---\n` 开头 (frontmatter) 
- frontmatter 含 `business_id` + `business_name` + `generated_at` (必填三件套)
- section count 与 sectionCount 返回值一致
- 无字段值是 literal `"undefined"` 或 `"NaN"` (说明数据流问题)
- 无 deprecated 词 (predict-grade / 本地资产 / 等)

---

## 4 · Asset Integrity (Matthew cycle-26 强制)

**核心需求**: master.md 完备 + 在线 + 素材 (图片/视频) 上链 + 在报告中正常引用。

### Asset 类型 + 来源

| Asset | 本地路径 | 上传位置 | master.md 引用 |
|---|---|---|---|
| desktop screenshot | `clients/<slug>/v2/screenshots/desktop.png` | CF Pages `/<slug>-dev.pages.dev/screenshots/desktop.png` (publish copy) · 可选 Cloudinary CDN | profile card 现状证据 + master.md "二、客户访问时看到的页面" |
| mobile screenshot | `screenshots/mobile.png` | 同上 | 同上 |
| evidence PNGs | `evidence/issue-*.png` | 同上 (publish copy) · Cloudinary CDN (build-internal-report --cloudinary) | master.md 五、漏水 章节内联 ![] |
| mobile video | `video/mobile-throttled.webm` | 同上 | 现状证据 section · video_url frontmatter |
| master.md | `master.md` | CF Pages copy | self · frontmatter generated_at |
| master.report.html | `master.report.html` | CF Pages copy (huashu-md-html render) | profile card 在线资源 4-link |
| internal-audit-report.html | `internal-audit-report.html` | CF Pages copy | profile card 在线资源 + master.md 附录 |
| customer-facing-audit.html | `customer-facing-audit.html` | CF Pages copy | profile card 在线资源 + Stage 9 message |

### Publish Pipeline (pl-publish-demo.js)

```
1. cp clients/<slug>/v2/index.html → stage/
2. cp 5 HTML 文件 (if 存在 disk):
   - master.md
   - master.report.html
   - internal-audit-report.html
   - customer-facing-audit.html
   - internal-audit-report.optimized.html (optional)
3. cp 3 folders (recursive):
   - screenshots/
   - evidence/
   - video/
4. wrangler pages deploy → CF Pages live
5. write cf-pages-deploy.json (demo_url + 4 doc URLs)
6. setEntityPhase(OUTREACH_ACTIVE) → title [待发]
7. open #website-projects thread + post Stage 9 message
```

### Verify (cycle-26 新)

**Pre-publish (本地)**:
```bash
node -e "
import('./core/reports/asset-integrity.js').then(async ({verifyAssetsLocal}) => {
  const md = require('fs').readFileSync('clients/<slug>/v2/master.md', 'utf8');
  console.log(verifyAssetsLocal({md, clientV2Dir: 'clients/<slug>/v2'}));
});
"
# 期望: { ok: true, missing: [] }
```

**Post-publish (远程 HTTP)**:
```bash
npm run pl:asset-integrity-doctor -- --entity-key domain_xxx
# 期望: ✓ <slug> · N assets all 200 · <demo-url>
```

或扫所有已部署 entity:
```bash
npm run pl:asset-integrity-doctor
```

**TDD 测试**: `test-cycle26-asset-integrity.mjs` (13 assertions)
- `extractAssetRefs` 找出 3 类引用 (image / link / video) + frontmatter assets
- `verifyAssetsLocal` 检测漏文件
- `verifyAssetsRemote` 模拟 HTTP 404 + 网络错误

### Asset 失败 fallback 行为

| 情况 | 现行行为 | 是否 acceptable |
|---|---|---|
| Cloudinary 未跑 → `manifest.evidenceUrls` 空 | master.md 内联图片用本地 `./evidence/x.png` · CF Pages copy 后 live URL 正常 | ✓ (Cloudinary 仅当 CDN 抗 CF Pages 慢的时候用) |
| Stage 3 fetch 失败 → 无 detailed_audit → 无 evidence/截图 | master.md 跳过 "二、客户访问页面" 整段 · profile card "现状证据" 显示 "—" | ✓ |
| publish 跑了但 master.md 没 copy 进 stage (磁盘 race) | `pl:asset-integrity-doctor` HEAD `/master.md` 返 404 → 报警 | ✓ (用 doctor catch) |
| 截图 PNG 上传但 evidence PNG 没上 | doctor 列出 broken refs | ✓ |
| Video 文件存在 disk 但 publish stage 漏 copy | doctor HEAD `.webm` 返 404 → 报警 | ✓ |

### 还要加 (待 cycle-doctor 升级)

`pl:cycle:doctor` 当前只检查 lint + Discord contract。建议加: 对每个 phase=outreach-active entity · 自动跑 asset-integrity-doctor · 任一 fail → cycle-doctor fail。这样 Matthew 任何时候跑 `cycle:doctor` 都能看到部署完整性。

---

## 5 · 何时更新 SOP

任何下列变化必须同步更新本文档:
- 新增 master.md section
- 新增 Stage 数据源
- 修改 frontmatter schema
- 删除 service / 替换 LLM provider
- 调整 grading 规则

否则 cycle-doctor 会因 SOP 漂移 fail (待加 doctor check)。
