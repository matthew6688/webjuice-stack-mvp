#!/usr/bin/env node
/**
 * pl:build-handoff · V3 build · 生成 clients/<slug>/v2/handoff/ 14-file 结构
 *
 * Per docs/v3/HANDOFF-STRUCTURE.md · V3 立刻推进的 handoff 文档完整结构
 *
 * Usage:
 *   npm run pl:build-handoff -- --entity-key <key>
 *   npm run pl:build-handoff -- --all-active
 *
 * MVP version (本 commit):
 *  - core-facts.json   · 从 entity + enrichment LOCKED 数据 verbatim
 *  - design/*          · niche typical defaults (logo skill 暂未接 · 占位)
 *  - content/*         · 从 entity / GBP / audit 推 · 标 source
 *  - structure/*       · niche + city 模板 page-map
 *  - audit/*           · 从现有 detailed-audit fixture 转 schema
 *  - boundaries.md     · LOCKED 字段清单 (per-customer)
 *  - README.md         · handoff 包入口 + 索引
 *  - final-prompt.md   · build prompt aggregator (引用全部上述)
 *
 * 后续 (Phase B · 不在本 commit):
 *  - Logo skill 真调 (existing-logo-brand / logo-design)
 *  - LLM 综合 about narrative (Cascade A)
 *  - Photos AI 分析 selection
 *  - Reviews 真聚合 + AI fallback
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const CLIENTS_DIR = path.join(REPO, 'clients');
const FIXTURE_DIR = path.join(REPO, 'data/v2/fixtures/detailed-audit');
const ACTIVE_PHASES = new Set(['ready-to-build', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid', 'qa-pending', 'audit-ready']);

function args() {
  const out = {}; const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2); const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i += 1; }
  }
  return out;
}
function die(msg) { console.error(`pl:build-handoff: ${msg}`); process.exit(1); }
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }
function writeText(p, txt) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); }

// ── niche-typical defaults ──────────────────────────────────────────
const NICHE_DEFAULTS = {
  roofer: {
    services: [
      { id: 'roof-restoration', name: 'Roof Restoration', desc: '全面屋顶翻新 · 高压清洁 + 修补 + 重涂 + 防水', icon: 'sparkles' },
      { id: 'roof-repair', name: 'Roof Repair', desc: '漏水修复 · 屋瓦更换 · 紧急维修', icon: 'wrench' },
      { id: 'gutter-replacement', name: 'Gutter Replacement', desc: '排水沟更换 · Colorbond / Zincalume', icon: 'water' },
      { id: 'gutter-guard', name: 'Gutter Guard', desc: '防堵排水沟方案 · 长期维护', icon: 'shield' },
      { id: 'metal-roofing', name: 'Metal Roofing', desc: '金属屋顶安装 · 商业 + 住宅', icon: 'rectangle' },
    ],
    faqs: [
      { q: 'How much does roof restoration cost in {city}?', a: 'Free quote · pricing depends on damage extent · we provide written estimates within 24 hours.' },
      { q: 'Are you QBCC licensed?', a: 'Yes · we hold a current Queensland Building and Construction Commission license · public record at ABR.' },
      { q: 'Do you offer free quotes?', a: 'Yes · no obligation site visit · written quote within 24 hours.' },
      { q: 'How long does a roof replacement take?', a: 'Typically 2-5 days depending on roof size and weather · we keep you updated throughout.' },
      { q: 'What\'s your warranty?', a: 'All workmanship guaranteed · Colorbond materials carry manufacturer warranties up to 36 years.' },
      { q: 'Do you handle insurance claims?', a: 'Yes · we work directly with insurance companies for storm/hail damage claims.' },
    ],
    brandTokens: { primary: '#1a3d5c', accent: '#d97706', font_heading: 'Inter', font_body: 'Inter', dominant_palette: 'navy + warm orange (industrial trades typical)' },
    designStyle: 'Modern Industrial · Trust-heavy · Editorial layout · Navy anchor with warm orange accent · Professional roofer aesthetic',
  },
  electrician: {
    services: [
      { id: 'switchboard-upgrade', name: 'Switchboard Upgrade', desc: '老旧 fuse box 升级到现代 RCBO 配电盘', icon: 'zap' },
      { id: 'emergency-electrician', name: 'Emergency Electrician', desc: '24/7 急修 · 跳闸 / 火花 / 断电', icon: 'alert' },
      { id: 'lighting-installation', name: 'Lighting Installation', desc: 'LED 节能照明 · 室内外', icon: 'bulb' },
      { id: 'safety-inspection', name: 'Safety Inspection', desc: '电气安全检测 + 报告', icon: 'check' },
    ],
    faqs: [
      { q: 'Are you a licensed electrician?', a: 'Yes · we hold a current Electrical Contractor License · public record at the electrical safety regulator.' },
      { q: 'Do you provide emergency callouts?', a: '24/7 emergency response · usually on-site within 60 minutes.' },
      { q: 'How much does a switchboard upgrade cost?', a: 'Typically $1,500-3,000 · depending on size and complexity · free fixed-price quote.' },
      { q: 'Do you handle insurance work?', a: 'Yes · storm damage and electrical fire repairs · we liaise with insurers directly.' },
    ],
    brandTokens: { primary: '#0a4d8f', accent: '#fbbf24', font_heading: 'Inter', font_body: 'Inter', dominant_palette: 'blue + yellow (electrical trade typical)' },
    designStyle: 'Modern Trades · Safety-first · Bold yellow accent · Trust badges prominent',
  },
  plumber: {
    services: [
      { id: 'hot-water', name: 'Hot Water Systems', desc: '热水器安装 + 维修 + 更换', icon: 'flame' },
      { id: 'emergency-plumber', name: 'Emergency Plumber', desc: '24/7 急修 · 漏水 / 堵塞 / 爆裂', icon: 'alert' },
      { id: 'drainage', name: 'Drainage', desc: '排水道清通 + CCTV 检测', icon: 'water' },
      { id: 'gas-fitting', name: 'Gas Fitting', desc: '燃气管道安装 + 维修', icon: 'flame' },
    ],
    faqs: [
      { q: 'Are you a licensed plumber?', a: 'Yes · we hold a current plumbing license · public record.' },
      { q: 'Do you provide emergency callouts?', a: '24/7 emergency response · most jobs same-day.' },
    ],
    brandTokens: { primary: '#0369a1', accent: '#06b6d4', font_heading: 'Inter', font_body: 'Inter', dominant_palette: 'water blue + cyan' },
    designStyle: 'Clean Plumbing Trade · Cool blue palette · Trust + 24/7 availability emphasized',
  },
};

const FALLBACK_NICHE = NICHE_DEFAULTS.roofer;

function nicheDefaults(niche) {
  const n = String(niche || '').toLowerCase();
  for (const key of Object.keys(NICHE_DEFAULTS)) {
    if (n.includes(key)) return NICHE_DEFAULTS[key];
  }
  return FALLBACK_NICHE;
}

// ── derivation helpers ──────────────────────────────────────────────
function deriveCoreFacts(entity) {
  const latest = entity.latest || {};
  const id = entity.identifiers || {};
  const enr = entity.enrichment || {};
  return {
    business_name: latest.name || entity.entityKey,
    phone: latest.phone || null,
    phone_tel_link: latest.phone ? `tel:${String(latest.phone).replace(/[^\d+]/g, '')}` : null,
    email: latest.email || null,
    address: latest.address || null,
    city: latest.city || null,
    state: deriveState(latest),
    niche: latest.niche || latest.category || null,
    gbp_categories: Array.isArray(latest.categories) ? latest.categories : (latest.category ? [latest.category] : []),
    rating: latest.rating ?? null,
    review_count: latest.review_count ?? null,
    google_maps_url: buildGmbUrl({ latest, identifiers: id }),
    domain: id.websiteDomain || (latest.website ? safeHost(latest.website) : null),
    website: latest.website || null,
    website_status: latest.websiteStatus || (latest.website ? 'has_website' : 'no_website'),
    social_links: latest.social_links || latest.socials || {},
    hours: latest.hours || null,
    // Enrichment LOCKED data
    abn: enr.abn?.abn_formatted || null,
    abn_status: enr.abn?.abn_status || null,
    abn_registered_at: enr.abn?.abn_status_effective_from || null,
    entity_type: enr.abn?.entity_type_name || null,
    trading_names: enr.abn?.trading_names || [],
    domain_registered_at: enr.whois?.registered_at || null,
    domain_age_years: enr._derived?.domain_age_years_effective ?? enr.whois?.domain_age_years ?? null,
    domain_age_source: enr._derived?.domain_age_source || enr.whois?.domain_age_source || null,
    first_online: enr.wayback?.first_snapshot_date || null,
    wayback_first_snapshot_url: enr.wayback?.first_snapshot_url || null,
    _meta: {
      generated_at: new Date().toISOString(),
      entity_key: entity.entityKey,
      entity_phase: entity.phase || null,
      sources: {
        business_name: '[GBP]',
        phone: '[GBP]',
        address: '[GBP]',
        abn: enr.abn ? '[ABR]' : null,
        domain_registered_at: enr.whois?.registered_at ? '[WHOIS RDAP]' : null,
        first_online: enr.wayback?.first_snapshot_date ? '[Wayback]' : null,
      },
    },
  };
}

function buildGmbUrl({ latest, identifiers }) {
  if (latest?.google_maps_url) return latest.google_maps_url;
  if (identifiers?.place_id) return `https://www.google.com/maps/place/?q=place_id:${identifiers.place_id}`;
  if (identifiers?.cid) return `https://maps.google.com/?cid=${identifiers.cid}`;
  if (identifiers?.data_id && /0x[0-9a-f]+:0x[0-9a-f]+/i.test(identifiers.data_id)) {
    const second = identifiers.data_id.split(':')[1];
    try { return `https://maps.google.com/?cid=${BigInt(second).toString()}`; } catch { return null; }
  }
  return null;
}

function safeHost(url) { try { return new URL(url.includes('://') ? url : `https://${url}`).host.replace(/^www\./, ''); } catch { return null; } }

function deriveState(latest) {
  const addr = String(latest.address || '');
  const m = addr.match(/\b(QLD|NSW|VIC|WA|SA|TAS|NT|ACT)\b/);
  return m ? m[1] : null;
}

function loadAudit(entityKey) {
  const p = path.join(FIXTURE_DIR, `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function deriveServices(entity) {
  const niche = entity.latest?.niche || 'roofer';
  const defaults = nicheDefaults(niche);
  // For MVP · use niche typical · later replace with LLM抽取 from existing audit / homepage
  return {
    services: defaults.services.map((s) => ({
      ...s,
      page_slug: `/${s.id}`,
      source: ['[niche typical]'],
    })),
    _meta: {
      generator: 'pl:build-handoff (MVP · niche typical · LLM 升级待 V3-HANDOFF-STRUCTURE Phase B)',
      derived_from: 'niche typical · GBP categories fallback',
    },
  };
}

function deriveAbout(entity) {
  const facts = deriveCoreFacts(entity);
  const lines = [
    '---',
    `generator: "pl:build-handoff MVP"`,
    `last_updated: "${new Date().toISOString()}"`,
    'sources:',
    '  - "[GBP]"',
    facts.abn ? '  - "[ABR]"' : null,
    facts.first_online ? '  - "[Wayback]"' : null,
    '---',
    '',
    `# About ${facts.business_name}`,
    '',
    facts.first_online
      ? `${facts.business_name} 自 ${facts.first_online.slice(0, 4)} 在 ${facts.city || 'Australia'} 经营${facts.domain_age_years ? ` · 至今 ${facts.domain_age_years} 年` : ''}。`
      : `${facts.business_name} 是 ${facts.city || 'Australia'} 的本地 ${facts.niche || 'business'}。`,
    '',
    facts.abn
      ? `我们持有 ABN ${facts.abn} (${facts.abn_status})${facts.entity_type ? ` · 实体类型: ${facts.entity_type}` : ''}。`
      : '',
    '',
    facts.rating
      ? `Google 评分: ${facts.rating}★ · ${facts.review_count} 条评论。`
      : '',
    '',
    '## 备注',
    '',
    'MVP 阶段 · 这段为 niche typical + 硬数据综合 · LLM 综合升级见 V3-HANDOFF-STRUCTURE Phase B (Cascade A 调用)。',
  ].filter(Boolean).join('\n');
  return lines;
}

function deriveFaq(entity) {
  const niche = entity.latest?.niche || 'roofer';
  const city = entity.latest?.city || 'Australia';
  const defaults = nicheDefaults(niche);
  return {
    faqs: defaults.faqs.map((f) => ({
      q: f.q.replace('{city}', city),
      a: f.a,
      source: '[niche typical · MVP]',
    })),
    _meta: {
      generator: 'pl:build-handoff MVP',
    },
  };
}

function derivePageMap(entity) {
  const facts = deriveCoreFacts(entity);
  const niche = entity.latest?.niche || 'roofer';
  const defaults = nicheDefaults(niche);
  const services = defaults.services;
  const city = facts.city || 'Australia';
  const cityKebab = slugify(city);

  // Build area pages from niche + suburbs (niche typical · LLM 升级时换真实 sitemap area pages)
  const niceCity = cityKebab || 'australia';
  const areaPages = [
    { slug: `/${slugify(niche)}-${niceCity}`, name: `${niche} ${city}`, type: 'area', primary: true },
    { slug: `/${slugify(niche)}-${niceCity}-cbd`, name: `${niche} ${city} CBD`, type: 'area' },
    { slug: `/${slugify(niche)}-${niceCity}-northside`, name: `${niche} ${city} Northside`, type: 'area' },
    { slug: `/${slugify(niche)}-${niceCity}-southside`, name: `${niche} ${city} Southside`, type: 'area' },
  ];

  return {
    pages: [
      { slug: '/', name: 'Home', type: 'home', purpose: 'hero + 3 services + reviews + trust + map + CTA', priority: 1 },
      ...services.map((s) => ({ slug: s.page_slug || `/${s.id}`, name: s.name, type: 'service', priority: 2 })),
      ...areaPages.map((a) => ({ ...a, priority: 3 })),
      { slug: '/about', name: 'About', type: 'about', purpose: 'company story + ABN + license · trust 集中', priority: 2 },
      { slug: '/reviews', name: 'Reviews', type: 'reviews', purpose: `${facts.review_count || 0} reviews aggregator`, priority: 3 },
      { slug: '/contact', name: 'Contact', type: 'contact', purpose: 'form + tel + map', priority: 1 },
    ],
    total_pages: 5 + services.length + areaPages.length,
    service_pages: services.length,
    area_pages: areaPages.length,
    _meta: {
      generator: 'pl:build-handoff MVP',
      rationale: `${city} ${niche} · 标准结构: home + ${services.length} services + ${areaPages.length} area 长尾 + about + reviews + contact`,
    },
  };
}

function deriveSeoStrategy(entity) {
  const facts = deriveCoreFacts(entity);
  const niche = facts.niche || 'roofer';
  const city = facts.city || 'Australia';
  return [
    '---',
    `generator: "pl:build-handoff MVP"`,
    'source: "niche typical · city + niche combo"',
    '---',
    '',
    `# SEO Strategy · ${facts.business_name}`,
    '',
    '## Primary Keywords',
    `- "${niche} ${city}"`,
    `- "best ${niche} ${city}"`,
    `- "${niche} near me ${city}"`,
    '',
    '## Long-tail (Service × Area)',
    `- "roof repair ${city} CBD"`,
    `- "roof restoration ${city} Northside"`,
    `- "gutter replacement Inner ${city}"`,
    '',
    '## Schema (per page)',
    '- LocalBusiness (whole-site · ABN + phone + address)',
    '- Service (per service page)',
    `- AggregateRating (${facts.review_count || 0} reviews · ${facts.rating || 0}★)`,
    '- FAQ (per page · FAQPage)',
    '',
    '## 备注',
    '',
    'MVP 阶段 long-tail target 为 niche typical · LLM 升级时综合 audit sitemap classify 真实长尾页 + 竞品分析。',
  ].join('\n');
}

function deriveAuditFindings(entity) {
  const audit = loadAudit(entity.entityKey);
  if (!audit?.detailed_audit?.issues) {
    return {
      audit_score: null,
      decision: null,
      findings: [],
      _meta: {
        generator: 'pl:build-handoff MVP',
        note: 'No detailed-audit fixture found · STARTER 路径或未审计 · build 按 niche typical best practices',
      },
    };
  }
  const issues = audit.detailed_audit.issues || {};
  const findings = [];
  for (const sev of ['critical', 'major', 'minor']) {
    for (const issue of (issues[sev] || [])) {
      findings.push({
        id: issue.id,
        severity: sev,
        weight: issue.weight || issue.lost_points || null,
        what_observed: issue.what_observed || issue.rationale || issue.title || '',
        why_it_costs: issue.why_it_matters || issue.plain_language || null,
        fix_prescription: issue.how_to_fix_in_redesign || issue.fix || null,
        fix_target: issue.fix_target || null,
        verification: issue.verification || null,
        source: '[审计 · detailed-audit]',
      });
    }
  }
  return {
    audit_score: audit.detailed_audit.audit_score ?? null,
    decision: audit.detailed_audit.decision || null,
    findings,
    _meta: {
      generator: 'pl:build-handoff MVP',
      derived_from: `data/v2/fixtures/detailed-audit/${entity.entityKey}.json`,
      total_findings: findings.length,
    },
  };
}

function deriveIssueFixMatrix(findings) {
  // MVP: simple mapping · LLM 升级时综合 page-map decide
  return {
    matrix: findings.findings.map((f) => ({
      issue_id: f.id,
      resolved_in_pages: ['all'],
      resolved_in_sections: f.fix_target ? [f.fix_target] : ['(待 LLM 推断)'],
      verification_check: f.verification ? { type: 'manual', target: f.verification } : null,
    })),
    _meta: {
      generator: 'pl:build-handoff MVP · LLM 升级见 V3-HANDOFF-STRUCTURE Phase B',
    },
  };
}

function deriveBoundaries(entity) {
  const facts = deriveCoreFacts(entity);
  return [
    '# OD 不能改的 (LOCKED · 严格)',
    '',
    `## 商家硬数据 (verbatim · 一字不改 · ${facts.business_name})`,
    '',
    `- **business_name**: \`${facts.business_name}\``,
    `- **phone**: \`${facts.phone || '(none)'}\``,
    `- **phone_tel_link**: \`${facts.phone_tel_link || '(none)'}\``,
    `- **address**: \`${facts.address || '(none)'}\``,
    `- **abn**: \`${facts.abn || '(待 ABR 补)'}\` (${facts.abn_status || '?'})`,
    `- **rating**: ${facts.rating ?? '?'}★ (${facts.review_count ?? 0} reviews)`,
    `- **google_maps_url**: \`${facts.google_maps_url || '(none)'}\``,
    '',
    '## 不许做的',
    '',
    '- 编造 license 号 / award / 价格 / 团队规模',
    '- 改 Reference template 的 data-od-locked 区',
    '- 删 data-od-sample 标记 (M5 客户要改占位)',
    '- 用 "Welcome to" / "Your trusted" / "X years of excellence" 这种模板套话',
    '- 修改商家名拼写 / 改电话格式 / 简化地址',
    '',
    '详见 docs/v4/DATA-PRESERVATION-CONTRACT.md',
  ].join('\n');
}

function deriveHandoffReadme(entity, structure) {
  const facts = deriveCoreFacts(entity);
  return [
    `# Handoff Package · ${facts.business_name}`,
    '',
    `> Generated by \`pl:build-handoff\` · ${new Date().toISOString()}`,
    `> Entity: \`${entity.entityKey}\` · Phase: \`${entity.phase || 'unknown'}\``,
    '',
    `## 商家概览`,
    '',
    `- **名字**: ${facts.business_name}`,
    `- **行业**: ${facts.niche || '?'}`,
    `- **城市**: ${facts.city || '?'} ${facts.state ? `(${facts.state})` : ''}`,
    `- **网站**: ${facts.website || '_(none · STARTER 路径)_'}`,
    `- **电话**: ${facts.phone || '?'}`,
    `- **ABN**: ${facts.abn ? `${facts.abn} · ${facts.abn_status}` : '_(待 ABR_GUID 注册后补)_'}`,
    `- **域名年龄**: ${facts.domain_age_years ?? '_(无)_'} 年 ${facts.domain_age_source ? `(${facts.domain_age_source})` : ''}`,
    `- **第一次上线**: ${facts.first_online || '_(无 Wayback)_'}`,
    `- **Google**: ${facts.rating ?? '?'}★ · ${facts.review_count ?? 0} reviews`,
    '',
    `## Handoff 14 文件结构`,
    '',
    `- **core-facts.json** · 硬数据 · ${structure.coreFactsKeys} 字段 · LOCKED`,
    `- **design/brand-tokens.json** · brand color/font tokens`,
    `- **design/design-style.md** · visual style 描述`,
    `- **content/services.json** · ${structure.serviceCount} 服务条目`,
    `- **content/about.md** · 公司故事 (niche typical + 硬数据综合)`,
    `- **content/faq.json** · ${structure.faqCount} 问 (niche typical)`,
    `- **structure/page-map.json** · ${structure.pageCount} 页 · ${structure.serviceCount} 服务 + ${structure.areaCount} area 长尾`,
    `- **structure/seo-strategy.md** · long-tail target list`,
    `- **audit/findings.json** · ${structure.findingsCount} issue${structure.findingsCount ? '' : ' (无 audit · STARTER 路径)'}`,
    `- **audit/issue-fix-matrix.json** · issue → page+section 映射`,
    `- **boundaries.md** · LOCKED 字段清单`,
    `- **final-prompt.md** · build prompt aggregator`,
    `- **README.md** (本文)`,
    '',
    '## 待 Phase B 升级 (LLM 调用 · Cascade A)',
    '',
    '- Logo skill 真调 (现在是 brand-tokens niche default · 没真 logo)',
    '- about-narrative LLM 综合 (现在是模板综合 · 没用 review 语气 / 原网内容)',
    '- services 描述 LLM 抽 (从现网 markdown / GBP types)',
    '- FAQ LLM 生成 (现在是 niche typical · 没 customize)',
    '- Photos AI 分析 + selection',
    '- Reviews 真聚合 + AI fallback',
    '- Page-map LLM 决策 (现在 area pages 是 city+方位 hardcode · 没 sitemap analysis)',
    '',
    '详见 [docs/v3/HANDOFF-STRUCTURE.md](../../../docs/v3/HANDOFF-STRUCTURE.md)',
  ].join('\n');
}

function deriveFinalPrompt(entity, structure) {
  const facts = deriveCoreFacts(entity);
  return [
    `# Build Prompt · ${facts.business_name}`,
    '',
    'You are adapting a reference website to a real customer. This is the build prompt aggregator',
    'for Open Design (Codex retex). Read all referenced handoff files before generating.',
    '',
    `## Target Customer`,
    '',
    `- **Business**: ${facts.business_name}`,
    `- **Phone**: ${facts.phone}`,
    `- **Address**: ${facts.address}`,
    `- **Niche**: ${facts.niche}`,
    `- **City**: ${facts.city}, ${facts.state || 'Australia'}`,
    `- **Website**: ${facts.website || '(none · build from scratch)'}`,
    `- **Route**: ${facts.website_status === 'no_website' ? 'STARTER' : 'REDESIGN'}`,
    '',
    `## Read these handoff files (in order)`,
    '',
    '1. `core-facts.json` — LOCKED data · use verbatim, do not paraphrase',
    '2. `design/brand-tokens.json` + `design/design-style.md`',
    '3. `content/services.json` — features to highlight',
    '4. `content/about.md` — about narrative (may tighten copy · keep facts)',
    '5. `content/faq.json` — 6 FAQs to embed',
    '6. `structure/page-map.json` — build these N pages',
    '7. `structure/seo-strategy.md` — long-tail target',
    `8. \`audit/findings.json\` — ${structure.findingsCount} audit issues (REDESIGN only)`,
    '9. `audit/issue-fix-matrix.json` — which page solves which issue',
    '10. `boundaries.md` — what you CANNOT do',
    '',
    `## Build Requirements`,
    '',
    '- Every LOCKED field from `core-facts.json` must appear verbatim',
    '- Each `audit/findings.json` issue must be addressed per `fix_prescription`',
    '- Output must pass verification checks in `audit/issue-fix-matrix.json`',
    '- Follow `boundaries.md` strictly',
    '',
    `## Reference Template Family`,
    '',
    'Default: `classic-premium-roftix` (roofer/trades family · adaptable to other niches via LLM retex)',
    '',
    '---',
    '',
    `_Generated by pl:build-handoff · ${new Date().toISOString()}_`,
  ].join('\n');
}

// ── Main ───────────────────────────────────────────────────────────
function buildHandoff(entity) {
  const facts = deriveCoreFacts(entity);
  const slug = entity.promotedClientSlug || slugify(facts.business_name);
  const handoffDir = path.join(CLIENTS_DIR, slug, 'v2', 'handoff');

  // Generate all artefacts
  const services = deriveServices(entity);
  const about = deriveAbout(entity);
  const faq = deriveFaq(entity);
  const pageMap = derivePageMap(entity);
  const seoStrategy = deriveSeoStrategy(entity);
  const findings = deriveAuditFindings(entity);
  const fixMatrix = deriveIssueFixMatrix(findings);
  const boundaries = deriveBoundaries(entity);
  const niche = entity.latest?.niche || 'roofer';
  const defaults = nicheDefaults(niche);

  // Write
  writeJson(path.join(handoffDir, 'core-facts.json'), facts);
  writeJson(path.join(handoffDir, 'design', 'brand-tokens.json'), {
    ...defaults.brandTokens,
    _meta: { generator: 'pl:build-handoff MVP · niche typical · logo skill 待接' },
  });
  writeText(path.join(handoffDir, 'design', 'design-style.md'),
    `# Design Style · ${facts.business_name}\n\n${defaults.designStyle}\n\n_(niche typical · LLM 升级待 V3-HANDOFF-STRUCTURE Phase B)_\n`);
  writeJson(path.join(handoffDir, 'design', 'logo-mode.json'), {
    mode: 'placeholder',
    note: 'Logo skill 未接 · 用 reference template 内置 logo · 客户提交 logo 后 M5 替换',
    skill_to_invoke: facts.website_status === 'no_website' ? 'logo-design' : 'existing-logo-brand',
  });
  writeJson(path.join(handoffDir, 'content', 'services.json'), services);
  writeText(path.join(handoffDir, 'content', 'about.md'), about);
  writeJson(path.join(handoffDir, 'content', 'faq.json'), faq);
  writeJson(path.join(handoffDir, 'structure', 'page-map.json'), pageMap);
  writeText(path.join(handoffDir, 'structure', 'seo-strategy.md'), seoStrategy);
  writeJson(path.join(handoffDir, 'audit', 'findings.json'), findings);
  writeJson(path.join(handoffDir, 'audit', 'issue-fix-matrix.json'), fixMatrix);
  writeText(path.join(handoffDir, 'boundaries.md'), boundaries);

  const structure = {
    coreFactsKeys: Object.keys(facts).filter((k) => !k.startsWith('_')).length,
    serviceCount: services.services.length,
    faqCount: faq.faqs.length,
    pageCount: pageMap.total_pages,
    areaCount: pageMap.area_pages,
    findingsCount: findings.findings.length,
  };
  writeText(path.join(handoffDir, 'README.md'), deriveHandoffReadme(entity, structure));
  writeText(path.join(handoffDir, 'final-prompt.md'), deriveFinalPrompt(entity, structure));

  return { slug, handoffDir, structure };
}

(async () => {
  const a = args();
  const targets = [];
  if (a['entity-key']) {
    const f = path.join(ENTITIES_DIR, `${a['entity-key']}.json`);
    if (!fs.existsSync(f)) die(`entity not found: ${a['entity-key']}`);
    targets.push(a['entity-key']);
  } else if (a['all-active']) {
    for (const f of fs.readdirSync(ENTITIES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
        if (ACTIVE_PHASES.has(e.phase)) targets.push(f.replace('.json', ''));
      } catch { /* skip */ }
    }
  } else if (a['entity-keys']) {
    // comma-separated
    for (const k of String(a['entity-keys']).split(',')) targets.push(k.trim());
  } else {
    die('Usage: --entity-key <k> | --entity-keys k1,k2,... | --all-active');
  }

  console.log(`pl:build-handoff · ${targets.length} target(s)`);
  const summary = [];
  for (const key of targets) {
    const f = path.join(ENTITIES_DIR, `${key}.json`);
    if (!fs.existsSync(f)) {
      console.log(`  ✗ ${key} not found`);
      summary.push({ key, ok: false, error: 'entity not found' });
      continue;
    }
    const entity = JSON.parse(fs.readFileSync(f, 'utf8'));
    const name = entity.latest?.name || key;
    try {
      const r = buildHandoff(entity);
      console.log(`  ✓ ${name.padEnd(35)} → ${r.handoffDir.replace(REPO, '.')}`);
      summary.push({ key, name, ok: true, ...r });
    } catch (err) {
      console.log(`  ✗ ${name}: ${err.message}`);
      summary.push({ key, name, ok: false, error: err.message });
    }
  }

  // SUMMARY
  console.log(`\n══════════════════════════════════════`);
  console.log(`SUMMARY`);
  console.log(`══════════════════════════════════════`);
  for (const s of summary) {
    if (s.ok) console.log(`  ✓ ${s.name.padEnd(35)} ${s.structure.pageCount} pages · ${s.structure.findingsCount} findings`);
    else console.log(`  ✗ ${s.name?.padEnd(35) || s.key} · ${s.error}`);
  }
  const okCount = summary.filter((s) => s.ok).length;
  console.log(`\n${okCount}/${summary.length} handoffs built`);
  fs.writeFileSync('/tmp/handoff-build-summary.json', JSON.stringify(summary, null, 2));
})();
