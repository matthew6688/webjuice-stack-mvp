# V3 · Build + Audit 闭环 · 完整计划

> **状态**: 计划阶段 · 暂不执行 · v2 修正后 ~92% confidence (v1 误用 "Open Design" 用词)
> **目的**: 把 handoff → build → 验证 整套闭环建好 · 保证生成的网站满足:
>   1. 核心商家信息 100% 准确 (LOCKED · 不许错)
>   2. fix 尽量多的 audit 问题 (按重要性 + hard evidence 对比 list)
>   3. brand asset 一致 (logo + 设计语言)
>   4. 内容真实 + 适当 AI 延伸 (缺数据如 review 时 AI 生成 · 内部用)
>
> **背景**: docs/v3/HANDOFF-STRUCTURE.md 定义了 handoff 14 文件 · 本文定义 **整套闭环 + audit 体系**

---

## ⚠ 重要 · Build 流程真相 (v2 修正)

我 v1 误用 "Open Design" 一词 · 实际:

**V3 当前 build 流程** (`pl:build-from-reference`):
```js
spawn('claude', ['-p', prompt, '--model', 'claude-sonnet-4-5'])
```
**直接调 claude CLI · 不走任何 Open Design daemon**。

`templates/roofing/families/<family>/open-design-prompt.md` 这些文件是 Matthew 当初**手动喂 OD daemon 用的** · V3 build 不读它。
V3 build 读的是 `reference-adapter-handoff.js::buildReferenceAdapterPrompt()` 拼出来的 28-line prompt + reference-site/index.html + master.md。

所以本计划的 "Path A" 不是 OD daemon · 是 "claude CLI 直接生成 (sonnet-4-5)"。

Matthew 的 weatherproof 模板:
- ✗ 不在 OD daemon database (`/Users/matthew/Developer/open-design/.od/app.sqlite` · 最新 May 10 greg-sign)
- ✓ 在 `/Users/matthew/Developer/Roof-website-demo/`:
  - `weatherproof-roof-restorations.svg` (+ 4 变体 · light/dark/outlined)
  - `weatherproof-visual-style-contract.md` (17 段 + Website Agent Prompt)
  - `weatherproof-logo-usage-preview.html` (brand tokens CSS)
- ✗ HTML 设计本身没在 V3 / Roof-website-demo · 需要拿 visual-contract + logo 输入给 claude 生成一份 reference-site/index.html · 或从 OD UI export

---

## 1. 现状盘点

### 1.1 已有的 OD 流程

```
clients/<slug>/v2/master.md           ← 销售向 · 含 audit + 客户信息
                  │
                  ↓
core/leads/reference-adapter-handoff.js
                  │ 注入 verifiedFacts + anti-invent + anti-slop + CTA + form
                  ↓
scripts/cli/pl-build-from-reference.js
                  │ claude CLI · sonnet-4-5 · ~$0.30 · 3 min
                  ↓
clients/<slug>/v2/concept/reference-adapter/index.html    ← OD 输出
                  │
                  ↓
scripts/cli/pl-publish-demo.js
                  │ Cloudflare Pages
                  ↓
https://<slug>-dev.pages.dev/                            ← 客户看
```

### 1.2 已有的 4 个 template families

| family | sub-niche | bestFor |
|---|---|---|
| **classic-premium-roftix** | premium residential roofing · restoration · replacement | established roofer · 多页或高质量单页 · 视觉信任高 |
| **editorial-bold-commercial** | commercial / B2B | 高客单 · industrial roofing |
| **lead-capture-restoration** | restoration · 单页 lead capture | 单页 · 强 CTA · 紧迫感 |
| **productized-modern-roofing** | productized roofing | modern brand · fixed pricing |

每个 template 含:
- `reference-site/index.html` (锁的设计系统)
- `reference-site/HANDOFF-BOUNDARIES.md`
- `design-language.md` (调色 / 字体 / 节奏)
- `section-patterns.json` (section recipe)
- `template-manifest.json` (含 `selectedImages` · 选好哪张图去哪)
- `open-design-prompt.md` (OD 看的 prompt)
- `image-candidates/` · `screenshots/`

### 1.3 已有的 audit 工具

| CLI | 用途 |
|---|---|
| `pl:audit-doctor` | 整体 audit 健康检查 |
| `pl:build-customer-audit` | 给客户看的 audit HTML |
| `pl:optimize-internal-report` | 5-round critic loop 优化 internal audit |
| `pl:thread-audit-deep` | thread 历史 audit |
| `pl:e2e-audit` | 端到端 audit |
| `cycle:doctor` | cycle 健康 |
| `pl:goals-doctor` | 9 个 goals (G1-G9) |

### 1.4 已有 V3 现成数据 (本周期我们建的)

- ✅ `entity.enrichment.*` · WHOIS + Wayback + Tinyfish search + Tinyfish homepage (commit a9accff6 / f0a99c29 / e4a89bbd)
- ✅ `handoff/` 14 文件结构 · 已生成 5 个 test customer (commit f6861f75)
- ✅ master.md "公司注册 · 域名 · 外部 mention 硬数据" 段 (含 LOCKED + source tags)
- ✅ internal-audit-report.html "公司注册 · 域名 · 外部 mention" 段
- ✅ Live preview: https://customer-summaries.pages.dev/handoff-test/

---

## 2. 整体闭环架构 (本计划要建的)

**v2 修正**: 简化 Path 决策 · 不需要"OD vs template-fit vs hybrid" 三选 · 只一条路径 (claude CLI 直接 build · 但 handoff 喂得更丰富)。



```
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 1 · Handoff 生成 (V3-HANDOFF-STRUCTURE · MVP 已落 · Phase B 待升)│
│   → clients/<slug>/v2/handoff/ (14 文件)                                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 2 · Pre-handoff Audit  ← NEW · 本计划                            │
│   验证 handoff 自身质量 · 不达标不能给 OD                                │
│   - 核心信息完整度 (name/phone/email/address 全 verbatim)               │
│   - audit findings 每条有 fix_prescription + verification rule         │
│   - boundaries.md 每个 LOCKED 字段都列                                  │
│   - brand-tokens / design-style 一致                                   │
│ ✓ 通过 → Stage 3 · ✗ 失败 → 回 Stage 1 补                              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 3 · Family 决策 (单 path · 选 reference family) ← NEW             │
│                                                                          │
│   不是 "OD vs template" 二选 · 都是 claude CLI 跑                        │
│   决策器只选: 用哪个 reference family 当 base                            │
│                                                                          │
│   现有 5 family (待加入 weatherproof 后):                                 │
│   - classic-premium-roftix     · premium 多页 · audit critical 多        │
│   - editorial-bold-commercial  · B2B / commercial · 高客单              │
│   - lead-capture-restoration   · 单页 · 强 CTA · 紧迫感                  │
│   - productized-modern-roofing · 现代 · 固定价 · transparent             │
│   - weatherproof-restoration   · NEW · trade-service direct (Phase A)   │
│                                                                          │
│   决策 (LLM 综合或 rule-based):                                           │
│   - 看 niche · sub-niche · audit findings · invest tier · STARTER/REDESIGN│
│   - 输出 chosen_family                                                   │
│   - 后续 Matthew 加 niche 模板 (electrician/plumber/etc.) · 决策器扩展    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 4 · Build 执行 · 单 path · claude CLI sonnet-4-5                  │
│                                                                          │
│   现有 pl:build-from-reference 增强:                                      │
│   - prompt 喂的不再是 master.md · 改读 handoff/final-prompt.md           │
│   - handoff/audit/findings.json 列每条 issue + fix_prescription          │
│   - handoff/structure/page-map.json 告 OD 要建哪几页                     │
│   - handoff/boundaries.md LOCKED 字段列表                                │
│                                                                          │
│   输出: clients/<slug>/v2/concept/reference-adapter/index.html          │
│         (后续可改成 / 加 about.html · services-*.html 多页)             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5 · Post-build Audit ← NEW · 本计划核心                           │
│                                                                          │
│   对生成的 HTML 跑 3 类 audit:                                            │
│                                                                          │
│   A · Core Info Audit (verify · 不许错)                                  │
│   - 每页 HTML 含 verbatim business_name (出现次数 · 正确拼写)             │
│   - 每页含 phone (tel: link · 正确 number)                              │
│   - 每页 footer 含 ABN / address                                         │
│   - LocalBusiness schema 含正确数据 1:1                                  │
│   → 输出 core-info-audit.json · 任何错 = build 不通过                    │
│                                                                          │
│   B · Audit-Fix Verification (每条 audit issue 跑 verification rule)     │
│   - 读 handoff/audit/findings.json N 条 issue                            │
│   - 每条 issue 跑 verification check (regex / DOM / JSON-LD parse)       │
│   - 输出 fix-verification.json: { issue_id, fixed: bool, evidence }     │
│   → 这是你说的"hard evidence 对比 list"                                  │
│                                                                          │
│   C · Aesthetic / Brand Audit (Vision LLM)                              │
│   - 跑 vision LLM · screenshot 评 freshness/trust/conversion             │
│   - 对比 baseline (现网 vs 新站 · 同维度评分)                            │
│   - brand consistency: logo 出现 · color tokens 一致 · 字体             │
│   → 输出 aesthetic-audit.json                                            │
│                                                                          │
│   全部 pass → Stage 6 · 任何 fail → Stage 4 重 build (3-tier escalation)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 6 · Publish + Internal Comparison Report                          │
│                                                                          │
│   - publish 到 Cloudflare Pages                                          │
│   - 生成 internal-fix-comparison.html · 对比 list:                       │
│     | Audit Issue | Severity | Fixed? | Evidence |                       │
│     | no_phone_above_fold | critical | ✓ | <a href='..'>line 14: tel:</a>│
│     | no_localbusiness_schema | major | ✓ | <pre>{...JSON-LD...}</pre>  │
│     | low_res_images | minor | ✗ | 客户没 high-res 照片 · 待 M5 上传   │
│   - 销售看这个跟客户讲: "我们找到 N 个问题 · 修了 X 个 · Y 个待客户提供"  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 每个 Audit 详细 spec

### 3.1 Pre-handoff Audit (Stage 2) · `pl:audit-handoff`

**目的**: 不让残缺/错的 handoff 进 build

**检查**:
```js
function auditHandoff(handoffDir) {
  const checks = [];

  // A. Core facts 完整度
  const facts = readJson(`${handoffDir}/core-facts.json`);
  checks.push({ name: 'core-facts has business_name', pass: !!facts.business_name });
  checks.push({ name: 'core-facts has phone', pass: !!facts.phone });
  checks.push({ name: 'core-facts has address', pass: !!facts.address });
  checks.push({ name: 'phone_tel_link valid format', pass: /^tel:\+/.test(facts.phone_tel_link) });

  // B. Audit findings 完整度
  const findings = readJson(`${handoffDir}/audit/findings.json`);
  for (const f of findings.findings) {
    checks.push({ name: `${f.id} has fix_prescription`, pass: !!f.fix_prescription });
    checks.push({ name: `${f.id} has verification rule`, pass: !!f.verification });
  }

  // C. boundaries.md 含所有 LOCKED 字段
  const bounds = readText(`${handoffDir}/boundaries.md`);
  for (const k of ['business_name', 'phone', 'address', 'rating']) {
    checks.push({ name: `boundaries.md mentions ${k}`, pass: bounds.includes(k) });
  }

  // D. brand-tokens 完整
  const tokens = readJson(`${handoffDir}/design/brand-tokens.json`);
  checks.push({ name: 'brand-tokens has primary', pass: !!tokens.primary });
  checks.push({ name: 'brand-tokens has accent', pass: !!tokens.accent });

  // E. final-prompt.md 引用所有文件
  const prompt = readText(`${handoffDir}/final-prompt.md`);
  for (const f of ['core-facts.json', 'audit/findings.json', 'structure/page-map.json']) {
    checks.push({ name: `final-prompt references ${f}`, pass: prompt.includes(f) });
  }

  return { all_pass: checks.every(c => c.pass), checks };
}
```

**输出**: `handoff-audit.json` · 不 pass → block build

---

### 3.2 Core Info Audit (Stage 5A) · `pl:audit-core-info`

**目的**: 生成的网站每页都有正确商家信息 · 错了销售完蛋

**检查**:
```js
async function auditCoreInfo(builtHtmlDir, handoffFacts) {
  const checks = [];

  // 扫所有 .html 文件
  for (const htmlFile of glob(`${builtHtmlDir}/**/*.html`)) {
    const html = readFile(htmlFile);
    
    // 商家名 · 每页必须含 · verbatim
    const nameCount = countOccurrences(html, handoffFacts.business_name);
    checks.push({
      page: htmlFile,
      check: 'business_name verbatim',
      pass: nameCount >= 2,            // hero · footer · 至少 2 处
      evidence: `found ${nameCount} occurrences`,
    });

    // 电话 · tel: link · 每页必须
    const phoneDigits = handoffFacts.phone.replace(/\D/g, '');
    checks.push({
      page: htmlFile,
      check: 'phone tel: link',
      pass: html.includes(`tel:`) && html.includes(phoneDigits),
      evidence: extractTelLinks(html),
    });

    // 地址 · footer 必须含
    checks.push({
      page: htmlFile,
      check: 'address in footer',
      pass: extractFooter(html).includes(handoffFacts.address.split(',')[0]),  // street part
    });

    // ABN · 每页 footer 必须含 (if available)
    if (handoffFacts.abn) {
      checks.push({
        page: htmlFile,
        check: 'ABN in footer',
        pass: html.includes(handoffFacts.abn),
      });
    }

    // schema.org LocalBusiness 含正确 data
    const ldJson = extractLDJson(html);
    if (ldJson) {
      const lb = ldJson.find(j => j['@type']?.includes('LocalBusiness') || j['@type']?.includes('Roofer'));
      checks.push({
        page: htmlFile,
        check: 'LocalBusiness schema name match',
        pass: lb?.name === handoffFacts.business_name,
      });
      checks.push({
        page: htmlFile,
        check: 'LocalBusiness schema telephone match',
        pass: lb?.telephone?.replace(/\D/g,'') === phoneDigits,
      });
    }
  }

  return {
    all_pass: checks.every(c => c.pass),
    fail_count: checks.filter(c => !c.pass).length,
    checks,
  };
}
```

**输出**: `core-info-audit.json` · 任一 fail = block publish

---

### 3.3 Audit-Fix Verification (Stage 5B) · `pl:verify-audit-fixes`

**目的**: 这是 Matthew 说的"对比 list with hard evidence" · 每条 issue 是否被 fix 了

**输入**: `handoff/audit/findings.json` + 生成的 HTML

**核心逻辑**:
```js
async function verifyAuditFixes(handoffFindings, builtHtmlDir) {
  const results = [];
  for (const issue of handoffFindings.findings) {
    const r = await runVerification(issue, builtHtmlDir);
    results.push({
      issue_id: issue.id,
      severity: issue.severity,
      weight: issue.weight,
      fix_target: issue.fix_target,
      fix_prescription: issue.fix_prescription,
      verification_rule: issue.verification,
      fixed: r.pass,
      evidence: r.evidence,    // ← hard evidence: file path · line · regex match · DOM xpath
      not_fixed_reason: r.pass ? null : r.reason,
    });
  }

  // 加权: critical=8 · major=4 · minor=1
  const totalWeight = results.reduce((sum, r) => sum + (r.weight || 1), 0);
  const fixedWeight = results.filter(r => r.fixed).reduce((sum, r) => sum + (r.weight || 1), 0);

  return {
    summary: {
      total_issues: results.length,
      fixed_count: results.filter(r => r.fixed).length,
      fix_rate_count: (results.filter(r => r.fixed).length / results.length * 100).toFixed(0) + '%',
      fix_rate_weighted: (fixedWeight / totalWeight * 100).toFixed(0) + '%',
    },
    results,
  };
}
```

**Verification rule 类型**:
```js
// regex match
verification: { type: 'regex', target: 'all_html', pattern: 'tel:\\+617\\d{8}', min_count: 4 }

// DOM check
verification: { type: 'dom', selector: 'header a[href^="tel:"]', min_count: 1 }

// JSON-LD parse
verification: { type: 'json_ld', must_contain: { '@type': 'Roofer', 'telephone': '...' } }

// Text content
verification: { type: 'text_contains', target: 'home_first_1500_chars', keywords: ['quote', 'contact'], min_match: 1 }

// Sitemap presence
verification: { type: 'route_exists', pattern: '/roofer-{city}-(cbd|northside|southside)' }
```

**输出**: `audit-fix-verification.json` + 渲染成 internal-fix-comparison.html

---

### 3.4 Aesthetic / Brand Audit (Stage 5C) · `pl:audit-aesthetic-brand`

**目的**: 视觉是否过得去 · brand 一致

**检查**:
```js
async function auditAesthetic({ builtScreenshot, baselineScreenshot, brandTokens }) {
  // A. Vision LLM 评分 (codex)
  const vision = await runVision(builtScreenshot);
  // { freshness_score: 8/10, trust_score: 7/10, conversion_score: 8/10, design_age: 'modern' }

  // B. Brand consistency
  const tokensActual = extractActualBrandTokens(builtHtmlDir);
  const tokensExpected = brandTokens;
  const matches = {
    primary: tokensActual.primary === tokensExpected.primary,
    accent: tokensActual.accent === tokensExpected.accent,
    font: tokensActual.font_heading === tokensExpected.font_heading,
  };

  // C. Logo presence
  for (const page of htmlPages) {
    checks.push({
      check: 'logo on page',
      pass: hasLogoImg(page),
    });
  }

  // D. Before/after vision diff (有 baseline 时)
  if (baselineScreenshot) {
    const diff = await runVisionDiff({ before: baselineScreenshot, after: builtScreenshot });
    // { freshness_lift: +7, trust_lift: +6, conversion_lift: +5 }
  }

  return { vision, brand_matches: matches, diff };
}
```

**输出**: `aesthetic-audit.json` + before/after vision comparison

---

### 3.5 Internal Comparison Report (Stage 6) · `pl:build-internal-fix-comparison`

**这是 Matthew 说的"对比 list"·销售直接看 + 跟客户讲**

**结构**:
```html
<h1>Build Verification · <Customer></h1>

<section>
  <h2>核心信息核对 (Core Info Audit)</h2>
  <table>
    <tr><th>字段</th><th>handoff value</th><th>每页出现</th><th>状态</th></tr>
    <tr><td>business_name</td><td>VIP Roofing Brisbane</td><td>11 页 · 平均 4 处/页</td><td>✓</td></tr>
    <tr><td>phone (tel:)</td><td>+61730627779</td><td>11/11 页 · 47 处</td><td>✓</td></tr>
    <tr><td>address</td><td>39/71 Eagle St ...</td><td>2 页 (footer · contact)</td><td>✓</td></tr>
    <tr><td>ABN</td><td>(待 ABR 补)</td><td>—</td><td>⏳ skip</td></tr>
    <tr><td>LocalBusiness schema</td><td>—</td><td>11 页全 · 数据 verbatim</td><td>✓</td></tr>
  </table>
</section>

<section>
  <h2>Audit Fix Verification · 19 issues</h2>
  <p><b>Fixed: 16/19 (84%)</b> · weighted: <b>92%</b> (critical 优先修了)</p>
  
  <table>
    <tr><th>Issue</th><th>Severity</th><th>Weight</th><th>Fixed</th><th>Evidence</th></tr>
    <tr>
      <td>no_phone_above_fold</td><td>critical</td><td>8</td><td>✓</td>
      <td>nav.html line 23 · header sticky tel:+61730627779 · 4 处覆盖</td>
    </tr>
    <tr>
      <td>parked_page_no_content</td><td>critical</td><td>10</td><td>✓</td>
      <td>home.html · 0 "parked" 关键词 · 1820 字 markdown</td>
    </tr>
    <tr>
      <td>no_localbusiness_schema</td><td>major</td><td>5</td><td>✓</td>
      <td>head JSON-LD · @type=Roofer · 11/11 页</td>
    </tr>
    <tr style="background:#fff8dc">
      <td>low_res_images</td><td>minor</td><td>2</td><td>✗</td>
      <td>客户无 high-res 照片 · 用 niche typical stock · 待 M5 客户上传</td>
    </tr>
    ... 19 条全列
  </table>
</section>

<section>
  <h2>视觉 / 品牌对比 (Before vs After)</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr">
    <div><img src="before.png"/><p>Before · freshness 1/10</p></div>
    <div><img src="after.png"/><p>After · freshness 9/10 (+8)</p></div>
  </div>
  <p>Brand consistency: ✓ primary #1a3d5c 匹配 · ✓ accent · ✓ font Inter</p>
  <p>Logo: ✓ 出现于 11/11 页 (nav + footer)</p>
</section>

<section>
  <h2>销售话术 (auto-generated)</h2>
  <blockquote>
    "客户您好 · 我们做了完整 audit · 找到 19 个问题 · 修了 16 个 (84%)。
    具体改了:
    1. 您的电话现在每页 4 个位置可以点击拨打 (之前 parked 页根本看不到)
    2. 16 个之前的弱点 → 修了 14 个 critical/major · 2 个待您提供 high-res 照片
    3. 视觉新鲜度从 1/10 提升到 9/10 (Vision LLM 评)
    
    待补 (3 条 minor): 高清照片 · 真实施工案例 · 实际员工照片 (建议您拍 + 提供)
    您可以现在试试 https://...pages.dev"
  </blockquote>
</section>
```

---

## 4. 关键决策点 · 回答 Matthew 13 个问题

| # | Matthew 问 | 我的答 / 决策 |
|---|---|---|
| 1 | Photos 不要 AI 分析所有 · 只首页有价值的复用 | ✅ 改 photos pipeline · 默认只 LLM-vision-analyze 现网 hero 截图 (1 张 · ~$0.02) · 找到有 personal value 的 1-3 张 · 其他用 niche stock |
| 2 | 给客户没 logo 时创建 brand asset | ✅ 调 `logo-design` skill (~/.claude/skills/) · 输出 logo.svg + brand-tokens · 设计语言后续统一用这套 |
| 3 | 核心信息错了就完蛋 · 必须 audit + verify | ✅ Stage 2 (pre-handoff) + Stage 5A (post-build core-info) · 两道关卡 · 任一 fail 不放出 |
| 4 | 文案真实+延伸·按 local biz 优化 | ✅ Cascade A LLM · prompt 含 "stay verbatim on locked fields · extend on style 不编造数字" |
| 5 | 缺数据时 AI 生成 (review 等) | ✅ Reviews real < 3 时 fallback AI · 不标 placeholder (内部用 · 客户 M5 替换) |
| 6 | 单页 vs 多页? 每页讲啥? block 具体? | ✅ **决策器**: STARTER → 多页 (home+about+contact+3 services+3 area) · REDESIGN audit critical ≥ 5 → 多页 · 简单 case → 单页 · 详见 § 5 |
| 7 | Handoff 给出去之前要 audit | ✅ Stage 2 · pre-handoff audit · 不达标不放 |
| 8 | OD 出来后 audit (核心 + 审美 + fix 对比) | ✅ Stage 5 三 audit · A 核心信息 · B 修复对比 · C 审美 brand |
| 9 | 图片预算控制 | ✅ 每 lead 最多 1 次 vision LLM (hero 截图) · ~$0.02 · 1000 leads = $20 |
| 10 | 建素材库 vs 模板套? | ✅ **双轨** · 4 个 family 已有 (内置 stock) 是默认 · 客户 personal 图复用 1-3 张 · 素材库不建 (维护成本太高) |
| 11 | autoresearch 测最优解? | ✅ 小批 (5 leads × 3 path) 跑 · 看对比 · 不全量 autoresearch (太贵) · 详见 § 6 |
| 12 | 新 weatherproof 模板加入 | ✅ Phase A · 把 weatherproof 拉进 templates/roofing/families/ · 加 template-manifest · 5 个 family |
| 13 | 整套决策 (OD vs 模板 vs 混合) | ✅ 决策器在 Stage 3 · 看 niche match · audit findings 数 · 投资力 · 综合判 path A/B/C |

---

## 5. 单页 vs 多页 · Block 级 spec (决策器规则)

### 决策树

```
看 priority_tier + audit_findings_count + invest_tier:

if STARTER (no website):
  → 多页 · 6-8 页 standard 结构
  · home / about / service-1..3 / area-1..N / contact
  
elif REDESIGN audit_critical_count ≥ 5:
  → 多页 (audit findings 多 · 单页装不下 fix)
  · home / about / service-1..N / area-1..N / reviews / contact
  · 每 critical 至少 1 个 section 对应解决

elif REDESIGN audit_critical 1-4:
  → 单页 long-scroll
  · 1 个 home · 大 scroll · 含所有 sections
  · 适合 lead capture 场景

elif investment_tier === 'low':
  → 单页 · 简化
  
else:
  → 多页 default
```

### 多页 Block 级 spec (每页 sections)

```yaml
home.html:
  sections:
    - top-bar: "X+ Years · Y Warranty · Servicing {city}"
    - nav: logo + 5 links + tel: + FREE QUOTE btn
    - hero: H1 + sub + 2 CTA + (form 或 video)
    - trust-bar: 4 logos (QBCC, Master Builders, ABN, insurance)
    - services-grid: 3-card (top 3 services)
    - process: 4 steps (call → inspect → quote → schedule)
    - reviews: 3-5 cards (real + AI fallback)
    - about-snippet: 100 字 · CTA "Learn more"
    - faq: 4-6 items
    - cta-banner: "Get your free quote"
    - footer: logo + nav + address + ABN + license + social

about.html:
  sections:
    - hero-banner: title + sub
    - story: 3-4 段 · ABN since X · license # · QBCC verified
    - team: 真人 + AI fallback if 无照
    - certifications: QBCC · insurance · industry membership
    - service-area-map: embed Google Maps + suburb list
    - cta-banner

service-X.html:    # roof-restoration / metal-roofing / gutter
  sections:
    - hero: service-specific
    - what-we-do: 3-5 bullet
    - process
    - before-after: 2-3 image pair
    - faq-service-specific
    - related-services: 2 cards
    - cta-banner

area-X.html:       # roofer-brisbane-cbd
  sections:
    - hero: "<service> in <area> · trusted by N homes"
    - local-context: 1 段 · area name + landmarks (LLM 生成)
    - services-here: 3 card 链 service page
    - reviews-from-area: filter reviews mention area + AI fallback
    - service-area-map
    - cta-banner

contact.html:
  sections:
    - hero
    - form (3 字段 max · name + phone + service)
    - tel + email + map + hours
    - cta-banner
```

### 单页 Block (long-scroll)

按上面 home.html sections · 但每 section 加更多 detail · 总 ~8-10 个大 sections。

---

## 6. Autoresearch 决策框架 (不全量跑)

**Problem**: 不知道哪个 build path 出来质量最高

**解决** · 小批 controlled test:

```
5 个测试 customer × 3 paths (A/B/C) = 15 builds
              ↓
Stage 5 audit 都跑 (3 audit per build · 45 audit runs)
              ↓
对比表:
| Customer | Path | Core-Info | Fix-Rate | Aesthetic | Cost | Time |
| VIP      | A-OD | 100%      | 89%      | 9/10      | $0.30| 3min |
| VIP      | B-tpl| 100%      | 72%      | 7/10      | $0   | 30s  |
| VIP      | C-hybrid| 100%   | 91%      | 9/10      | $0.20| 2min |
| ... 14 more rows ...
              ↓
找最优 (一般是): 
- niche fit family · audit ≤ 8 critical → B
- audit > 8 critical → C
- 完全 outlier (sub-niche family 不 fit) → A
```

**总 cost**: $0.30 × 15 = $4.50 · 算 testing budget · 一次性投入。

之后每个新 customer 走决策器分流 · 不需要再 autoresearch。

---

## 7. 实施路线图

### Phase A · Foundation (3-4 天) · 必做
1. **新 weatherproof 模板集成** · 拉进 templates/roofing/families/ + manifest
2. **pl:audit-handoff** · pre-handoff audit (5 类 check)
3. **pl:audit-core-info** · post-build core info verify
4. **pl:verify-audit-fixes** · audit fix verification (verification rule engine)
5. **pl:build-internal-fix-comparison** · 对比 list HTML 生成器

### Phase B · Build Path 决策 (3-4 天) · 必做
6. **Logo skill 接入** · existing-logo-brand / logo-design 调用
7. **Brand-tokens 真提取** · 现有 logo → SVG + extract colors
8. **photos AI 选 1 张** · vision LLM · hero 截图判断 personal-value
9. **pl:build-from-template-fit** · path B · 套现有 family 不调 LLM
10. **pl:build-decision** · 决策器 · 输出 path A/B/C

### Phase C · 闭环验证 (2-3 天)
11. **pl:audit-aesthetic-brand** · vision LLM 评 + brand consistency
12. **3-tier escalation** · build fail 时自动 retry / regen / qa-pending
13. **集成进现有 pipeline** · 在 pl-publish-demo 之前跑 Stage 5 audit

### Phase D · Autoresearch (1-2 天 · optional)
14. **5 customers × 3 paths bench** · 跑一次 · 看 cost/quality 对比
15. **决策器调参** · 根据 bench 结果调阈值

**总: 9-13 工作日**

---

## 8. 新 weatherproof 模板集成 (Phase A · Task 1) · v2 修正

### 现有资产 (实际位置)

| 资产 | 路径 | 现状 |
|---|---|---|
| Logo SVG × 5 变体 | `/Users/matthew/Developer/Roof-website-demo/weatherproof-roof-restorations*.svg` | ✓ 有 (light/dark/outlined) |
| Visual style contract | `/Users/matthew/Developer/Roof-website-demo/weatherproof-visual-style-contract.md` | ✓ 17 段 · 含 Website Agent Prompt |
| Logo usage preview | `/Users/matthew/Developer/Roof-website-demo/weatherproof-logo-usage-preview.html` | ✓ brand tokens CSS |
| **HTML 设计 (index.html)** | — | ❌ 不在 V3 / Roof-website-demo / OD daemon |
| Screenshot · desktop/mobile | — | ❌ 没有 · screenshot 是 OD 编辑器 UI 截图 |

### 集成步骤

1. **复制 logo + 资产** · `cp /Users/matthew/Developer/Roof-website-demo/weatherproof-*.{svg,md,html} → templates/roofing/families/weatherproof-restoration/`
2. **生成 reference-site/index.html** · 两条路:
   - **A.** 从 OD UI export (Matthew 手动 · 你登录 OD 的那个项目 · "weatherproof-redesign...")
   - **B.** Claude CLI 一次性生成 · 喂 visual-style-contract.md + logo SVG + niche=roofing-restoration → 生成完整 reference-site/index.html (~$0.30 一次性)
3. **生成 reference-site/desktop.png + mobile.png** · Playwright 截 index.html
4. **创建 design-language.md** · 从 visual-style-contract.md 17 段提取 (转 V3 family 标准格式)
5. **创建 section-patterns.json** · 从 visual contract "Header And Footer Guardrails" / "Cards Forms" 等段抽
6. **创建 template-manifest.json** · 含 fit/bestFor/factsPolicy/selectedImages
7. **创建 HANDOFF-BOUNDARIES.md** · 复制 4 family 的格式 + 填 weatherproof 具体 LOCKED 数据
8. **注册到 FAMILY_REGISTRY** · `core/leads/reference-adapter-handoff.js`:
   ```js
   roofing_restoration: 'weatherproof-restoration',  // sub-niche
   weatherproof:        'weatherproof-restoration',  // exact match
   ```

### 决策 · 哪些客户用这个 family

- niche 含 "restoration" / "roof restoration" / "maintenance"
- audit findings 突出 "no_form" / "no_cta_above_fold"
- 单页 lead-capture 场景
- 跟现有 `lead-capture-restoration` family 比 · weatherproof 更 trade-service · less luxurious

### 待 Matthew 确认

- Step 2 选 A (从 OD export) 还是 B (claude CLI 生成)?
  - A 工作量小 · 但需要你登录 OD UI 找项目 export HTML
  - B 自动 · 但 reference-site 是 claude 生成的 · 可能跟 OD 编辑器里 visual 不一致 (要靠 visual-style-contract.md 强力约束)

---

## 9. 关键不确定点 (我也没答案)

| 不确定点 | 我的建议 |
|---|---|
| OD 真生成 vs template-fit 哪个客户更买账 | autoresearch 5 leads × 3 path 实测 (Phase D) · $4.50 |
| Page-map 决策准确率 (单页 vs 多页) | 起步用规则树 · 跑 10 个 lead 看 operator 推翻率 · 高 → 改 LLM 决策 |
| AI 生成 review 风险 (虚假宣传?) | 内部开发版没问题 · 客户买后 M5 必须替真 review · 法律风险 = 客户接受时点头 |
| Brand consistency 怎么 enforce | brand-tokens.json LOCKED · build 时强制 inject · audit 时 grep color hex 命中 |
| weatherproof 模板适用范围 | 等你确认 · 我看截图猜是 restoration 单页 lead capture · 不一定对 |
| 多 niche 扩展 (electrician/plumber) | V3 暂只 roofing · electrician/plumber 沿用 family 是 LLM 自动 retex · 不新建 family |

---

## 10. 决策记录 · 待 Matthew 拍

| # | 决策点 | 选项 |
|---|---|---|
| AL-1 | Photos vision LLM · 1 张 hero only · $0.02/lead | ✅/✗ |
| AL-2 | Logo skill 自动调 · existing-logo-brand 失败 fallback logo-design | ✅/✗ |
| AL-3 | Audit fix verification rule 必须存 audit-findings.json · 每条 issue 写 verification 字段 | ✅/✗ |
| AL-4 | 多页决策 · STARTER + audit ≥ 5 critical → 多页 · 其他 → 单页 | ✅/✗/调阈值 |
| AL-5 | Autoresearch 5 × 3 = 15 builds · $4.50 testing budget | ✅/✗ |
| AL-6 | weatherproof 模板归入 sub-niche=restoration 默认 family | ✅/✗ |
| AL-7 | Internal-fix-comparison 模板 (上面 § 3.5) 结构 OK | ✅/✗ |
| AL-8 | AI-generated review 不标 placeholder (内部用 · M5 替换) | ✅/✗ |
| AL-9 | brand-tokens primary/accent LOCKED · LLM 不能改 · build 时 grep verify | ✅/✗ |
| AL-10 | ~~OD path A 默认只在 "现有 family 不 fit" 触发~~ → **v2 修正**: 单 path · claude CLI direct · 决策只选 family · 不需 path B/C | ✅/✗ |
| AL-11 | weatherproof 模板 step 2 · A (OD export 手动) 还是 B (claude CLI 自动生成) | A / B |
| AL-12 | Matthew 后续加 niche 模板 · electrician/plumber/dental 等 · 同结构 5 文件 (reference-site + design-language + section-patterns + manifest + boundaries) | ✅/✗ |

---

## 11. 文档版本

- v1 · 2026-05-16 · Matthew + Claude · 初版 (75% confidence · 误用 "Open Design" 用词 · path A/B/C 三选过度复杂)
- v2 · 2026-05-16 · Claude 重新调查 + 修正 (~92% confidence):
  - V3 build 实际是 `claude CLI direct` · 不走 OD daemon · `open-design-prompt.md` 是历史遗物
  - 简化为单 build path · 决策器只选 family · 不需 path B/C
  - weatherproof 资产实际在 `Roof-website-demo/` · HTML 设计本身没在 V3 · 需 export 或 claude 生成
  - 新增 AL-11 (weatherproof step 2 选 A/B) + AL-12 (niche 扩展同结构)
- 状态: 等 Matthew 拍 AL-1 至 AL-12 · 然后开 Phase A

## 12. v2 剩余不确定 (~8%)

1. **OD UI export 是否 viable** (AL-11 选 A) · Matthew 那边 OD UI 是 hosted 还是另一个 install? 能否 export HTML 出来?
2. **多页生成单次 LLM call 够不够** · 现有 reference-adapter 是一次 prompt 出一个 index.html · 多页需要 N 次 call · 每次 ~$0.30 · 或一次 call 出多页 HTML zip (claude 能不能稳定?)
3. **AI-generated review 法律风险** · 内部开发版没问题 · 但客户 demo URL public · 万一被同行截图 + 投诉编造 review 怎么办? 加 footer disclaimer "demo content · client to verify"?
4. **Page-map 决策准确率未实测** · 规则树看着合理 · 实际 10 个 lead 跑下来可能误判一半 · 需要 Phase A 先小批验证
5. **Brand consistency enforce 机制** · brand-tokens.json 设了 primary=#1a3d5c · claude CLI 生成 HTML 时实际颜色不一定 1:1 · Stage 5C aesthetic audit 抓 · 但 fail 后重 build 还是 fail 怎么办
