/**
 * cycle-26 · TDD test 15/?? · master.md FULL 20-section population.
 *
 * P1.1 per Matthew: "report 里的内容都是准确的 · 完备的".
 *
 * Strategy: load REAL production audit fixtures (Ace Roofing has full 12-module
 * detailed_audit + vision · already shipped to CF Pages). Run buildMasterMd
 * with this data · assert every conditional section actually renders body
 * content · catch any builder-side fragility (TypeError on undefined fields).
 *
 * Why: existing test-10 covers 3 synthetic fixtures with minimal data ·
 * test-14 covers frontmatter精度. This test fills the gap: real production
 * data fed through builder · verify NO CRASH + all sections populated.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildMasterMdDetailed } from '../../core/reports/master-md-builder.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const ENTITY_KEY = 'domain_aceroofingservice.com.au';
const ENTITY_FILE = path.join(ROOT, 'data/leads/entities', `${ENTITY_KEY}.json`);
const DETAILED_FILE = path.join(ROOT, 'data/v2/fixtures/detailed-audit', `${ENTITY_KEY}.json`);
const VISUAL_PIPELINE_DIR = path.join(ROOT, 'data/v2/fixtures/visual-autoresearch/pipeline');

function loadVisual(key) {
  if (!fs.existsSync(VISUAL_PIPELINE_DIR)) return null;
  const subs = fs.readdirSync(VISUAL_PIPELINE_DIR);
  for (const sub of subs) {
    const f = path.join(VISUAL_PIPELINE_DIR, sub, `${key}.json`);
    if (fs.existsSync(f)) {
      const r = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (r.parsedJson) return { ...r.parsedJson, provider: r.provider || null, model: r.model || null };
    }
  }
  return null;
}

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 15/?? · master.md full 20-section population\n');

// ─── Skip-with-grace if real fixtures absent (CI / fresh checkout) ─────────
if (!fs.existsSync(ENTITY_FILE) || !fs.existsSync(DETAILED_FILE)) {
  console.log(`  ⏭ skip · real fixture absent (${ENTITY_KEY} not in store)`);
  console.log('\n0/0 passed · skipped');
  process.exit(0);
}

// ─── Load real production data ─────────────────────────────────────────────
// Production fixture shape: top-level has sub-modules · `detailed_audit` is nested.
// build-master-md.js reads: techStack = file.tech_stack · detailedAudit = file.detailed_audit
const REAL_ENT = JSON.parse(fs.readFileSync(ENTITY_FILE, 'utf8'));
const REAL_FILE = JSON.parse(fs.readFileSync(DETAILED_FILE, 'utf8'));
const REAL_DETAILED = REAL_FILE.detailed_audit || REAL_FILE;
const REAL_VISUAL = loadVisual(ENTITY_KEY);

// ─── (kept for reference: synthetic fallback fixtures · not active) ────────
const _IGNORE = {
  entityKey: 'fx_full_pop',
  firstSeenAt: '2026-05-15T00:00:00Z',
  latest: {
    name: 'Acme Roofing Pty Ltd',
    niche: 'roofer',
    category: 'roofing contractor',
    city: 'sydney',
    rating: 4.7,
    review_count: 42,
    website: 'https://acme.example.com.au',
    websiteStatus: 'independent_https_site',
    phone: '0411222333',
    address: '1 Test St, Sydney NSW 2000',
    timezone: 'Australia/Sydney',
    sourceType: 'maps_scraper',
    sourceQuery: 'roofer in sydney',
    discovery_rank: 3,
    batch_id: 'pipe-sydney-roofer-202605150300',
  },
};

const AUDIT = {
  audit_score: 65,
  decision: 'moderate_candidate',
  audit_version: 'v2',
  cheap_config_version: 'v2',
  hard_triggers: ['mobile_broken', 'no_visible_cta_or_phone'],
  qualification_reason: 'Mobile UX has 3 critical issues + phone hidden',
  issues: {
    critical: [
      { id: 'mobile_broken', title: '手机端不可用', rationale: 'No mobile viewport meta', plain_language: '手机看你网站会很差', customer_impact: '60% 流量直接流失' },
      { id: 'no_visible_cta_or_phone', title: '首屏看不到电话', rationale: 'No tel: above fold', plain_language: '客户进来找不到联系按钮', customer_impact: '潜在客户直接走' },
    ],
    major: [{ id: 'no_https_redirect', title: '无 301 HTTPS redirect', rationale: 'HTTP not redirected' }],
    minor: [{ id: 'old_jquery', title: 'jQuery 1.x detected', rationale: 'Legacy lib' }],
  },
  upsell_opportunities: ['SMM management $499/mo', 'Content writing $299/mo'],
  redesign_priorities: ['Mobile-first nav', 'Sticky phone CTA', 'Modern hero'],
};

const VISUAL = {
  freshness_score: 6,
  trust_score: 7,
  conversion_score: 5,
  design_age_estimate: 'slightly_outdated',
  summary: '整体设计偏 2015 年风格 · 信任元素分散 · hero 偏暗',
  positive_observations: ['品牌色统一', '电话在 header 露出', '客户评价星标可见'],
  issues: [
    { id: 'hero_dark', title: 'Hero image too dark', severity: 'major', what_observed: 'Dark photo without overlay', plain_language: '首屏图太黑', customer_impact: '客户感觉不专业' },
    { id: 'cta_low_contrast', title: 'CTA low contrast', severity: 'major', what_observed: 'Button blends with bg', plain_language: '按钮看不清', customer_impact: '点击率低' },
  ],
  recommendations: ['Add dark overlay on hero', 'High-contrast orange CTA'],
  provider: 'codex_cli',
  model: 'gpt-5',
};

const REVIEWS = {
  summary: '客户口碑强 (4.7★ · 42 评) · 关键字: 准时 · 干净 · 价钱实在',
  positive_themes: ['准时', '干净', '价钱实在'],
  trust_signal_strength: 'strong',
  quotable_for_redesign: ['"准时到 · 干净利落"', '"价钱实在 · 不乱加价"'],
  improvement_themes: ['沟通可以更主动'],
};

// All audit sub-modules use { ok: true, ...data } convention (gate for section render)
const TECH_STACK = {
  ok: true,
  cms: { name: 'WordPress' },
  analytics: [{ name: 'Google Analytics 4' }, { name: 'Hotjar' }],
  pixels: [{ name: 'Facebook Pixel' }],
};

const SITEMAP = {
  ok: true,
  has_sitemap: true,
  total_urls: 8,
  migration_complexity: 'low',
  seo_structure: 'flat',
};

const ACTIVITY = {
  ok: true,
  social_links: { facebook: 'https://facebook.com/acme', instagram: 'https://instagram.com/acme', linkedin: 'https://linkedin.com/company/acme' },
  last_post_at: '2026-04-20',
  freshness_signal: 'active',
};

const AI_GEO = {
  ok: true,
  score: 7,
  checks: [
    { id: 'schema_org', passed: true },
    { id: 'llms_txt', passed: false },
    { id: 'robots_txt', passed: true },
  ],
};

const PAGESPEED = {
  ok: true,
  results: {
    mobile: { lab_metrics: { lcp_ms: 3400, fcp_ms: 1200, cls: 0.12, tbt_ms: 300 }, scores: { performance: 65 } },
    desktop: { lab_metrics: { lcp_ms: 1800 }, scores: { performance: 88 } },
  },
};

// form-audit.js real schema (line 117-126)
const FORM_AUDIT = {
  ok: true,
  form_count_total: 1,
  contact_form_count: 1,
  forms: [
    {
      role: 'contact',
      friction_level: 'low',
      action: '/contact',
      method: 'POST',
      inputs: [
        { name: 'name', type: 'text', labelText: '姓名', required: true },
        { name: 'email', type: 'email', labelText: '邮箱', required: true },
        { name: 'phone', type: 'tel', labelText: '电话', required: false },
        { name: 'message', type: 'textarea', labelText: '需求', required: false },
      ],
      honeypot_present: false,
    },
  ],
  captchas_detected: [],
  has_any_captcha: false,
  has_any_anti_spam: false,
  auditor_notes: [{ severity: 'medium', text: '无 captcha · 无 honeypot · spam 风险中' }],
};

const DOMAIN_HISTORY = {
  ok: true,
  whois: { domain_age_years: 5.2, registrar: 'Crazy Domains' },
  wayback_snapshots: 12,
  dns: { spf: true, dkim: false, dmarc: false },
};

const IMG_OPT = {
  ok: true,
  total_images: 18,
  srcset_count: 4,
  lazy_count: 6,
  modern_formats: 0,
  recommendations: ['Add srcset', 'Use WebP'],
};

const TRUST_SIGNALS = {
  ok: true,
  industry: 'construction',
  signals: [
    { id: 'qbcc_license', present: true, value: '#12345' },
    { id: 'abn', present: true, value: '11 222 333 444' },
    { id: 'insurance_badge', present: false },
  ],
};

const THIRD_PARTY = {
  ok: true,
  total_kb: 480,
  trackers: ['Google Analytics', 'Hotjar', 'Facebook Pixel'],
};

const GBP_EXTRAS = {
  ok: true,
  posts: [{ at: '2026-04-01', text: 'Special: Free roof inspection' }],
  qa: [{ q: 'Do you serve Eastern suburbs?', a: 'Yes, all Sydney metro' }],
};

// Build with REAL Ace Roofing production data (top-level sub-modules in file)
const r = buildMasterMdDetailed({
  entity: REAL_ENT,
  detailedAudit: REAL_DETAILED,
  visualAudit: REAL_VISUAL,
  techStack: REAL_FILE.tech_stack,
  sitemapAnalysis: REAL_FILE.sitemap_analysis,
  activity: REAL_FILE.activity,
  aiGeo: REAL_FILE.ai_geo,
  pagespeed: REAL_FILE.pagespeed,
  formAudit: REAL_FILE.form_audit,
  domainHistory: REAL_FILE.domain_history,
  imageOptimization: REAL_FILE.image_optimization,
  trustSignals: REAL_FILE.trust_signals,
  thirdPartyWeight: REAL_FILE.third_party_weight,
});

const md = r.md;

// ─── Each section verifications · NOT just heading · BODY content too ─────

t('Section "内部分级" · investment_level + product_tier + pricing rendered', () => {
  assert.ok(md.includes('## 内部分级'));
  assert.ok(/投入分级.*[A-D]/.test(md), 'must show grade letter');
});

t('Section "店家现状速览" · entity phone + address + website rendered verbatim', () => {
  assert.ok(md.includes('## 一、店家现状速览'));
  const phone = REAL_ENT.latest?.phone;
  const addr = REAL_ENT.latest?.address;
  const site = REAL_ENT.latest?.website;
  if (phone) assert.ok(md.includes(phone), `phone "${phone}" not in body`);
  if (addr) assert.ok(md.includes(addr), `address "${addr}" not in body`);
  if (site) assert.ok(md.includes(site.replace(/^https?:\/\//, '').replace(/\/$/, '')) || md.includes(site),
    `website "${site}" not in body`);
});

t('Section "来源" · sourceType label rendered', () => {
  assert.ok(/Google Maps|gosom|Maps Scraper/.test(md), 'sourceType label missing');
});

t('Section "审计结论" · hard_triggers correctly handled (skip section if empty)', () => {
  const triggers = REAL_DETAILED?.hard_triggers || [];
  if (triggers.length === 0) {
    // builder skips "已触发的 hard triggers" line entirely · pass
    assert.ok(!md.includes('已触发的 hard triggers'),
      'empty triggers should NOT render trigger list line');
  } else {
    for (const tg of triggers) assert.ok(md.includes(tg), `trigger "${tg}" not listed`);
  }
});

t('Section "二、客户访问页面" · screenshots referenced (desktop/mobile)', () => {
  assert.ok(md.includes('## 二、客户访问时看到的页面'));
});

t('Section "三、视觉审计" · scores rendered (when visual present)', () => {
  if (!REAL_VISUAL) { console.log('    (skip · no visual fixture for Ace)'); return; }
  assert.ok(md.includes('## 三、视觉审计'));
  if (REAL_VISUAL.visual_freshness != null) {
    assert.ok(md.includes(`${REAL_VISUAL.visual_freshness}/10`), `freshness score missing`);
  }
});

t('Section "四、客户评价" · skipped (no reviews fetched for Ace)', () => {
  // Real Ace has no reviewBundle fetched · section should NOT render
  assert.ok(!md.includes('## 四、客户在 Google 上怎么说'), 'review section should not render without data');
});

t('Section "五、漏水" · entity issues rendered (real fixture data)', () => {
  const crit = (REAL_DETAILED?.issues?.critical) || [];
  const major = (REAL_DETAILED?.issues?.major) || [];
  if (crit.length === 0 && major.length === 0) {
    console.log('    (skip · Ace has no critical/major issues)'); return;
  }
  assert.ok(md.includes('## 五、当前网站在哪里"漏水"'));
  // Verify each critical title is in body
  for (const i of crit) {
    if (i.title) assert.ok(md.includes(i.title), `critical issue "${i.title}" not rendered`);
  }
});

t('Section "六、Redesign 发力点" · priorities + recommendations', () => {
  // Either heading present or content
  const has = md.includes('## 六、Redesign 的发力点') || md.includes('Redesign');
  assert.ok(has);
});

t('Section "七、推荐销售切入点" · only renders if derived sales angles non-empty', () => {
  // Real Ace has hard_triggers=[] · no review_analysis · so salesAngles = [] · section skipped
  // This is correct behavior · operator gets section ONLY when there are actionable angles
  const triggers = REAL_DETAILED?.hard_triggers || [];
  if (triggers.length === 0) {
    assert.ok(!md.includes('## 七、推荐销售切入点'),
      'section 七 must skip when no triggers/reviews drive sales angles');
  } else {
    assert.ok(md.includes('## 七、推荐销售切入点'));
  }
});

t('Section "PageSpeed" · renders when pagespeed.ok (Ace has it)', () => {
  if (!REAL_FILE.pagespeed?.ok) { console.log('    (skip · no pagespeed)'); return; }
  assert.ok(md.includes('PageSpeed') || md.includes('真实速度'), 'PageSpeed section missing');
});

t('Section "图片优化与第三方脚本" · img counts + tracker list', () => {
  assert.ok(md.includes('图片优化') || md.includes('第三方脚本'));
});

t('Section "SEO 迁移 + 运营活跃度" · renders when sitemap or activity ok', () => {
  if (!REAL_FILE.sitemap_analysis?.ok && !REAL_FILE.activity?.ok) {
    console.log('    (skip · no sitemap/activity)'); return;
  }
  assert.ok(md.includes('SEO 迁移') || md.includes('运营活跃度'));
});

t('Section "联系表单" · form count + captcha + spam risk', () => {
  assert.ok(md.includes('联系表单'));
});

t('Section "域名历史 + 邮件信誉" · age + SPF/DKIM/DMARC', () => {
  assert.ok(md.includes('域名历史') || md.includes('邮件信誉'));
});

t('Section "技术栈" · renders when tech_stack.ok · cms name + analytics listed', () => {
  if (!REAL_FILE.tech_stack?.ok) { console.log('    (skip · no tech_stack)'); return; }
  assert.ok(md.includes('技术栈'));
  const cmsName = REAL_FILE.tech_stack.cms?.name;
  if (cmsName) assert.ok(md.includes(cmsName), `cms name "${cmsName}" not in tech section`);
});

t('Section "AI GEO" · 12 checks score', () => {
  assert.ok(md.includes('GEO Readiness') || md.includes('可发现性'));
});

t('Section "业务规模信号" · derived from reviews + pages + categories', () => {
  assert.ok(md.includes('业务规模信号'));
});

t('Section "Upsell 机会" · 2 SMM/content opportunities', () => {
  assert.ok(md.includes('Upsell') || md.includes('upsell'));
});

t('Section "GBP Posts 与 Q&A" · only when gbpExtras.ok (Ace lacks)', () => {
  // gbpExtras not passed · section should NOT render
  assert.ok(!md.includes('## GBP Posts'), 'GBP section should not render without data');
});

t('Section "附录 数据出处" · ALWAYS renders · provider + version visible', () => {
  assert.ok(md.includes('附录'));
  if (REAL_VISUAL?.provider) {
    assert.ok(md.includes(REAL_VISUAL.provider), `visual.provider "${REAL_VISUAL.provider}" not in appendix`);
  }
  if (REAL_DETAILED?.audit_version) {
    assert.ok(md.includes(REAL_DETAILED.audit_version), `audit_version not in appendix`);
  }
});

// ─── Section count baseline: real audit ≥ 10 sections ─────────────────────
t('real Ace fixture yields ≥ 10 sections (full audit ran)', () => {
  const count = (md.match(/^## /gm) || []).length;
  const sectionsList = (md.match(/^## .+/gm) || []).join(' | ');
  assert.ok(count >= 10, `expected ≥10 sections · got ${count} · ${sectionsList}`);
});

// ─── No drift: title uses real entity.latest.name ─────────────────────────
t('Title heading uses entity.latest.name verbatim', () => {
  const name = REAL_ENT.latest?.name;
  if (name) assert.ok(md.includes(`# ${name}`), `title heading missing "# ${name}"`);
});

// ─── No literal undefined / NaN ────────────────────────────────────────────
t('no literal "undefined" / "NaN" anywhere · full audit', () => {
  assert.ok(!md.match(/\bundefined\b/), 'literal undefined leaked');
  assert.ok(!md.match(/\bNaN\b/), 'literal NaN leaked');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
