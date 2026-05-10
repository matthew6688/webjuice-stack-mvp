/**
 * Detailed Audit V2 — runs on V2 audit_candidate or starter_candidate.
 *
 * 6 dimensions × ~40 rules → audit_result (PRD schema). Pure function,
 * no network. Caller fetches site data via Playwright/Tinyfish and
 * passes in. Visual dimension is currently stubbed (Block E fills it).
 *
 * Inputs (any may be omitted; rules without data score 0 + note
 * "data_missing"):
 *   - entity: discovery store entity (always required for GBP)
 *   - businessProfile: enrichment output (richer GBP signals)
 *   - fetchPayload: { url, markdown, rawHtml?, lighthouse?, performance? }
 *   - visualScore: 0-100 from Block E (defaults to stub 50)
 *
 * Output matches V2 PRD audit_result schema.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { narrate } from './rule-narrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH_CANDIDATES = [
  path.join(__dirname, 'detailed-audit-config.json'),
  path.join(process.cwd(), 'core/scoring/detailed-audit-config.json'),
];

let _config = null;
export function loadDetailedAuditConfig() {
  if (_config) return _config;
  for (const p of CONFIG_PATH_CANDIDATES) {
    if (fs.existsSync(p)) {
      _config = JSON.parse(fs.readFileSync(p, 'utf8'));
      return _config;
    }
  }
  throw new Error('detailed-audit-config.json not found');
}

export function reloadConfig() { _config = null; return loadDetailedAuditConfig(); }

// ─── Per-rule evaluators ───────────────────────────────────────────────

function gbpRules({ entity, businessProfile }) {
  const latest = entity?.latest || {};
  const signals = latest.signals || {};
  const reviewCount = Number(latest.review_count || 0);
  const rating = Number(latest.rating || 0);
  const imageCount = Number(signals.imageCount || 0);
  const replyRate = businessProfile?.gbp?.replies_replied_pct ?? null;
  const hasHours = Boolean(latest.hours || latest.openingHours || signals.hasHours);
  const hasDescription = Boolean(latest.description || signals.hasAboutAttributes);
  const hasServiceArea = Boolean(latest.serviceArea || signals.hasServiceArea);

  const rules = [
    { id: 'has_website_link', earned: latest.website ? 10 : 0, max: 10, hit: Boolean(latest.website),
      rationale: latest.website ? `website: ${latest.website}` : 'no website link in GBP' },

    rule_tier('review_volume_vs_peers', 25,
      reviewCount >= 100 ? 25 : reviewCount >= 50 ? 17 : reviewCount >= 20 ? 12 : reviewCount >= 10 ? 8 : reviewCount >= 1 ? 4 : 0,
      `${reviewCount} reviews`),

    rule_tier('average_rating', 10,
      rating >= 4.5 ? 10 : rating >= 4.0 ? 7 : rating >= 3.5 ? 4 : 0,
      rating ? `★${rating}` : 'no rating'),

    { id: 'has_hours', earned: hasHours ? 5 : 0, max: 5, hit: hasHours, rationale: hasHours ? 'hours present' : 'no hours' },

    rule_tier('image_count', 10,
      imageCount >= 10 ? 10 : imageCount >= 5 ? 6 : imageCount >= 1 ? 3 : 0,
      `${imageCount} images`),

    { id: 'has_business_description', earned: hasDescription ? 10 : 0, max: 10, hit: hasDescription,
      rationale: hasDescription ? 'description present' : 'no description' },
    { id: 'has_service_area', earned: hasServiceArea ? 15 : 0, max: 15, hit: hasServiceArea,
      rationale: hasServiceArea ? 'service area declared' : 'no service area' },

    replyRate == null
      ? { id: 'owner_replies_to_reviews', earned: 0, max: 15, hit: false, data_missing: true, rationale: 'reply rate not enriched' }
      : rule_tier('owner_replies_to_reviews', 15,
          replyRate >= 50 ? 15 : replyRate >= 25 ? 10 : replyRate >= 10 ? 5 : 0,
          `reply rate ${replyRate}%`),
  ];
  return rollup('gbp', rules);
}

function technicalRules({ fetchPayload }) {
  const url = fetchPayload?.url || '';
  const lighthouse = fetchPayload?.lighthouse || {};
  const perf = fetchPayload?.performance || {};
  const rawHtml = fetchPayload?.rawHtml || '';
  const lcp = perf.lcp ?? lighthouse.lcp ?? null;
  const lhMobile = lighthouse.mobile ?? null;

  const rules = [
    { id: 'https_enabled', earned: /^https:/i.test(url) ? 20 : 0, max: 20, hit: /^https:/i.test(url),
      rationale: /^https:/i.test(url) ? 'https' : 'http only' },

    lcp == null
      ? { id: 'first_paint_under_3s', earned: 0, max: 25, hit: false, data_missing: true, rationale: 'LCP not measured (need Playwright/Lighthouse)' }
      : rule_tier('first_paint_under_3s', 25,
          lcp <= 2 ? 25 : lcp <= 3 ? 18 : lcp <= 5 ? 10 : 0,
          `LCP ${lcp}s`),

    lhMobile == null
      ? { id: 'mobile_responsive', earned: rawHtml ? (/<meta[^>]+name=["']viewport["']/i.test(rawHtml) ? 18 : 0) : 0,
          max: 30, hit: /<meta[^>]+name=["']viewport["']/i.test(rawHtml),
          data_missing: !rawHtml,
          rationale: rawHtml ? (/<meta[^>]+name=["']viewport["']/i.test(rawHtml) ? 'viewport meta present (proxy for responsive)' : 'no viewport meta') : 'no rawHtml available' }
      : rule_tier('mobile_responsive', 30,
          lhMobile >= 80 ? 30 : lhMobile >= 50 ? 18 : lhMobile >= 20 ? 8 : 0,
          `lighthouse mobile ${lhMobile}`),

    perf.cwv == null
      ? { id: 'core_web_vitals_pass', earned: 0, max: 10, hit: false, data_missing: true, rationale: 'CWV not measured' }
      : { id: 'core_web_vitals_pass', earned: perf.cwv ? 10 : 0, max: 10, hit: perf.cwv, rationale: perf.cwv ? 'CWV pass' : 'CWV fail' },

    perf.formSubmittable == null
      ? { id: 'form_submittable', earned: 0, max: 5, hit: false, data_missing: true, rationale: 'form submit not tested' }
      : { id: 'form_submittable', earned: perf.formSubmittable ? 5 : 0, max: 5, hit: perf.formSubmittable,
          rationale: perf.formSubmittable ? 'form submits' : 'form broken' },

    perf.consoleErrors == null
      ? { id: 'no_console_errors', earned: 0, max: 5, hit: false, data_missing: true, rationale: 'console not captured' }
      : { id: 'no_console_errors', earned: perf.consoleErrors === 0 ? 5 : 0, max: 5, hit: perf.consoleErrors === 0,
          rationale: `${perf.consoleErrors} console errors` },

    !rawHtml
      ? { id: 'favicon_and_meta', earned: 0, max: 5, hit: false, data_missing: true, rationale: 'no rawHtml' }
      : (() => {
          const favicon = /<link[^>]+rel=["'](?:shortcut\s+)?icon["']/i.test(rawHtml);
          const metaDesc = /<meta[^>]+name=["']description["']/i.test(rawHtml);
          const both = favicon && metaDesc;
          return { id: 'favicon_and_meta', earned: both ? 5 : favicon || metaDesc ? 3 : 0, max: 5, hit: both,
            rationale: `favicon: ${favicon ? 'yes' : 'no'}, meta: ${metaDesc ? 'yes' : 'no'}` };
        })(),
  ];
  return rollup('technical', rules);
}

const CTA_KEYWORDS = ['quote', 'contact', 'book', 'call', 'free quote', 'get a quote', 'request', 'enquir', 'schedule'];

function uxConversionRules({ fetchPayload, entity }) {
  const md = fetchPayload?.markdown || '';
  const rawHtml = fetchPayload?.rawHtml || '';
  const aboveFold = md.slice(0, 1500);
  const aboveFoldLower = aboveFold.toLowerCase();
  const phoneDigits = entity?.identifiers?.phoneDigits || (entity?.latest?.phone || '').replace(/\D+/g, '');
  const aboveFoldDigits = aboveFold.replace(/\D+/g, '');

  const hasCta = CTA_KEYWORDS.some((kw) => aboveFoldLower.includes(kw));
  const phoneAbove = phoneDigits && phoneDigits.length >= 6 && aboveFoldDigits.includes(phoneDigits.slice(-6));
  const telLink = /href=["']tel:/i.test(rawHtml);
  const hasForm = /<form\b/i.test(rawHtml);
  const hasGallery = /(gallery|portfolio|projects|案例|画廊)/i.test(md);
  const hasTestimonials = /(testimonial|review|customer|client[s']?\s*say|评价|客户)/i.test(md);

  const rules = [
    { id: 'above_fold_cta_within_5s', earned: hasCta ? 30 : 0, max: 30, hit: hasCta,
      rationale: hasCta ? 'CTA keyword found above fold' : 'no CTA keyword in first 1500 chars' },
    { id: 'phone_visible_above_fold', earned: phoneAbove ? 20 : 0, max: 20, hit: phoneAbove,
      rationale: phoneAbove ? 'phone digits above fold' : 'phone hidden below fold or missing' },
    !rawHtml
      ? { id: 'click_to_call_link', earned: 0, max: 10, hit: false, data_missing: true, rationale: 'no rawHtml' }
      : { id: 'click_to_call_link', earned: telLink ? 10 : 0, max: 10, hit: telLink,
          rationale: telLink ? 'tel: link present' : 'no tel: link' },
    !rawHtml
      ? { id: 'quote_or_booking_form', earned: 0, max: 20, hit: false, data_missing: true, rationale: 'no rawHtml' }
      : { id: 'quote_or_booking_form', earned: hasForm ? 20 : 0, max: 20, hit: hasForm,
          rationale: hasForm ? '<form> element present' : 'no form' },
    { id: 'contact_path_short', earned: 0, max: 10, hit: false, data_missing: true, rationale: 'click-depth not measured' },
    { id: 'has_gallery', earned: hasGallery ? 5 : 0, max: 5, hit: hasGallery, rationale: hasGallery ? 'gallery mentioned' : 'no gallery' },
    { id: 'has_testimonials', earned: hasTestimonials ? 5 : 0, max: 5, hit: hasTestimonials,
      rationale: hasTestimonials ? 'testimonials section present' : 'no testimonials' },
  ];
  return rollup('ux_conversion', rules);
}

const AI_FILLER_PATTERNS = [
  /innovative\s+solutions/i, /comprehensive\s+services/i, /unparalleled/i,
  /cutting[-\s]edge/i, /state[-\s]of[-\s]the[-\s]art/i, /seamless\s+experience/i,
  /unleash\s+the\s+power/i, /elevate\s+your/i,
];

function contentRules({ fetchPayload, entity }) {
  const md = fetchPayload?.markdown || '';
  const mdLower = md.toLowerCase();
  const businessName = (entity?.latest?.name || '').toLowerCase();
  const niche = (entity?.latest?.niche || entity?.latest?.category || '').toLowerCase();
  const city = (entity?.latest?.city || '').toLowerCase();
  const suburb = ((entity?.latest?.address || '').match(/,\s*([A-Z][A-Za-z\s]+?)\s+[A-Z]{2,3}\s+\d{4}/) || [])[1]?.trim().toLowerCase() || '';

  const titleLine = md.split(/\n+/).find((l) => l.startsWith('#')) || '';
  const titleHasNiche = niche && titleLine.toLowerCase().includes(niche.split(/\s+/)[0]);
  const titleHasName = businessName && titleLine.toLowerCase().includes(businessName.split(/\s+/)[0]);

  const serviceMentions = (md.match(/(repair|restoration|installation|replacement|service|inspection|cleaning|maintenance|emergency|assessment)/gi) || []).length;
  const trustMentions = (md.match(/(license|insured|years\s*in|experience|guarantee|warranty|certified|accredited|award)/gi) || []).length;
  const localMention = (city && mdLower.includes(city)) || (suburb && mdLower.includes(suburb));
  const yearMatches = [...md.matchAll(/(20\d{2})/g)].map((m) => Number(m[1]));
  const recentYear = yearMatches.length ? Math.max(...yearMatches) >= new Date().getFullYear() - 1 : false;
  const aiFiller = AI_FILLER_PATTERNS.some((p) => p.test(md));

  const rules = [
    { id: 'homepage_title_clear', earned: titleHasName && titleHasNiche ? 20 : titleHasName || titleHasNiche ? 12 : 0, max: 20,
      hit: titleHasName && titleHasNiche,
      rationale: `title='${titleLine.slice(0, 60)}' contains-name=${titleHasName} contains-niche=${titleHasNiche}` },
    { id: 'service_copy_specific', earned: serviceMentions >= 5 ? 20 : serviceMentions >= 3 ? 14 : serviceMentions >= 1 ? 8 : 0,
      max: 20, hit: serviceMentions >= 3, rationale: `${serviceMentions} service-related verbs detected` },
    { id: 'trust_signals_present', earned: trustMentions >= 3 ? 20 : trustMentions >= 1 ? 12 : 0, max: 20, hit: trustMentions >= 1,
      rationale: `${trustMentions} trust-keyword mentions` },
    { id: 'localized_content', earned: localMention ? 15 : 0, max: 15, hit: localMention,
      rationale: localMention ? `mentions ${city || suburb}` : 'no local mention' },
    { id: 'evidence_of_recent_update', earned: recentYear ? 15 : 0, max: 15, hit: recentYear,
      rationale: recentYear ? 'fresh year mentioned' : 'no recent year (≤ 1 year ago)' },
    { id: 'non_ai_filler_copy', earned: aiFiller ? 0 : 10, max: 10, hit: !aiFiller,
      rationale: aiFiller ? 'AI-filler phrasing detected' : 'no obvious AI-filler' },
  ];
  return rollup('content', rules);
}

function seoRules({ fetchPayload }) {
  const html = fetchPayload?.rawHtml || '';
  if (!html) {
    const stub = (id, max) => ({ id, earned: 0, max, hit: false, data_missing: true, rationale: 'no rawHtml' });
    return rollup('seo', [
      stub('title_meta_present', 25), stub('h1_unique', 20), stub('local_schema_markup', 20),
      stub('image_alt_present', 20), stub('sitemap_robots', 15),
    ]);
  }
  const hasTitle = /<title>[^<]+<\/title>/i.test(html);
  const hasMeta = /<meta[^>]+name=["']description["']/i.test(html);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const hasLDLocal = /"@type"\s*:\s*"LocalBusiness"|"@type"\s*:\s*\["[^"]*","LocalBusiness"/.test(html);
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const altPct = imgs.length === 0 ? 1 : imgs.filter((t) => /\salt=["'][^"']/.test(t)).length / imgs.length;

  const rules = [
    { id: 'title_meta_present', earned: hasTitle && hasMeta ? 25 : hasTitle ? 14 : 0, max: 25, hit: hasTitle && hasMeta,
      rationale: `title=${hasTitle ? 'yes' : 'no'} meta=${hasMeta ? 'yes' : 'no'}` },
    { id: 'h1_unique', earned: h1Count === 1 ? 20 : 0, max: 20, hit: h1Count === 1, rationale: `${h1Count} <h1> tags` },
    { id: 'local_schema_markup', earned: hasLDLocal ? 20 : 0, max: 20, hit: hasLDLocal,
      rationale: hasLDLocal ? 'LocalBusiness schema present' : 'no LocalBusiness JSON-LD' },
    { id: 'image_alt_present', earned: altPct >= 0.8 ? 20 : altPct >= 0.5 ? 12 : altPct >= 0.2 ? 6 : 0, max: 20,
      hit: altPct >= 0.8, rationale: `${imgs.length} images, ${(altPct * 100).toFixed(0)}% with alt` },
    { id: 'sitemap_robots', earned: 0, max: 15, hit: false, data_missing: true,
      rationale: '/sitemap.xml + /robots.txt probe not run (need Playwright)' },
  ];
  return rollup('seo', rules);
}

function visualStub({ visualScore }) {
  const score = Number.isFinite(visualScore) ? visualScore : 50;
  return {
    score,
    rules: [{ id: 'visual_dimension_stub', earned: score, max: 100, hit: false, data_missing: true,
      rationale: 'visual dimension is filled by Block E (vision LLM autoresearch)' }],
  };
}

// ─── Aggregation ─────────────────────────────────────────────────────────

function rollup(dimension, rules) {
  const earned = rules.reduce((a, r) => a + (r.earned || 0), 0);
  const max = rules.reduce((a, r) => a + (r.max || 0), 0);
  const dimScore = max === 0 ? 0 : Math.round((earned / max) * 100);
  return { dimension, score: dimScore, earned, max, rules };
}

function rule_tier(id, max, earned, rationale) {
  return { id, earned, max, hit: earned > 0, rationale };
}

function classifyIssues(allRules, severityConfig, narrationCtx = {}) {
  const issues = { critical: [], major: [], minor: [] };
  const criticalIds = new Set(severityConfig.critical || []);
  const majorIds = new Set(severityConfig.major || []);
  for (const rule of allRules) {
    if (rule.hit || rule.data_missing) continue;
    const tier = criticalIds.has(rule.id) ? 'critical' : majorIds.has(rule.id) ? 'major' : 'minor';
    const ctxForRule = { ...narrationCtx };
    // Pull rule-specific data from rationale where useful
    if (rule.id === 'first_paint_under_3s') {
      const lcpMatch = String(rule.rationale || '').match(/[\d.]+/);
      if (lcpMatch) ctxForRule.lcp_seconds_rounded = Number(lcpMatch[0]).toFixed(1);
    }
    const { plain, impact } = narrate(rule.id, ctxForRule);
    issues[tier].push({
      id: rule.id,
      rationale: rule.rationale,
      max: rule.max,
      plain_language: plain || null,
      customer_impact: impact || null,
    });
  }
  return issues;
}

function applyHardTriggers(triggers, ctx) {
  const { entity, fetchPayload, dimensions } = ctx;
  const fired = [];
  let forced = null;
  let forcedMin = null;

  const websiteStatus = entity?.latest?.websiteStatus;
  const url = fetchPayload?.url || entity?.latest?.website || '';
  const reviewCount = Number(entity?.latest?.review_count || 0);

  for (const t of triggers) {
    const id = t.id;
    let hit = false;
    if (id === 'no_website') hit = websiteStatus === 'no_website';
    else if (id === 'mobile_broken') {
      const lh = fetchPayload?.lighthouse?.mobile;
      const noViewport = fetchPayload?.rawHtml ? !/<meta[^>]+name=["']viewport["']/i.test(fetchPayload.rawHtml) : false;
      hit = (lh != null && lh < 30) || noViewport;
    }
    else if (id === 'no_https') hit = /^http:\/\//i.test(url);
    else if (id === 'no_visible_cta_or_phone') {
      const ux = dimensions.ux_conversion?.rules || [];
      const cta = ux.find((r) => r.id === 'above_fold_cta_within_5s');
      const phone = ux.find((r) => r.id === 'phone_visible_above_fold');
      hit = cta && phone && !cta.hit && !phone.hit;
    }
    else if (id === 'high_traction_old_site') {
      hit = reviewCount >= 100; // audit_score check happens after this fn returns
    }

    if (hit) {
      fired.push(id);
      if (t.force) forced = t.force;
      if (t.force_min) forcedMin = t.force_min;
    }
  }
  return { fired, forced, forcedMin };
}

function decideAction({ score, fired, forced, forcedMin, thresholds }) {
  if (forced) return forced;
  let base;
  for (const t of thresholds) {
    if (score >= t.min && score <= t.max) { base = t.decision; break; }
  }
  if (!base) base = 'not_qualified';
  // forcedMin lifts a low-priority decision up, never down
  if (forcedMin === 'moderate_candidate' && (base === 'low_priority' || base === 'not_qualified')) {
    return 'moderate_candidate';
  }
  return base;
}

// ─── Main entry ──────────────────────────────────────────────────────────

export function detailedAudit({ entity, businessProfile, fetchPayload, visualScore } = {}) {
  if (!entity) throw new Error('entity is required');
  const config = loadDetailedAuditConfig();

  const dimensions = {
    gbp:           gbpRules({ entity, businessProfile }),
    technical:     technicalRules({ fetchPayload }),
    ux_conversion: uxConversionRules({ fetchPayload, entity }),
    content:       contentRules({ fetchPayload, entity }),
    seo:           seoRules({ fetchPayload }),
  };
  const visual = visualStub({ visualScore });
  dimensions.visual = { dimension: 'visual', score: visual.score, earned: visual.score, max: 100, rules: visual.rules };

  const dimension_scores = Object.fromEntries(
    Object.entries(dimensions).map(([k, v]) => [k, v.score])
  );

  const audit_score = Math.round(
    Object.entries(config.dimension_weights).reduce(
      (sum, [dim, weight]) => sum + (dimension_scores[dim] || 0) * weight,
      0
    )
  );

  const allRules = Object.values(dimensions).flatMap((d) => d.rules);
  const narrationCtx = {
    business_name: entity?.latest?.name || '',
    niche: entity?.latest?.niche || '',
    city: entity?.latest?.city || '',
    rating: entity?.latest?.rating ?? '-',
    review_count: entity?.latest?.review_count ?? '-',
    final_url: fetchPayload?.finalUrl || fetchPayload?.url || entity?.latest?.website || '',
  };
  const issues = classifyIssues(allRules, config.issue_severity, narrationCtx);

  const triggerOut = applyHardTriggers(config.hard_triggers, { entity, fetchPayload, dimensions });
  // high_traction_old_site needs audit_score; finalize trigger
  if (triggerOut.fired.includes('high_traction_old_site')) {
    const fullyHit = audit_score >= 50; // mid-or-low-quality but high traction
    if (!fullyHit) {
      // not actually triggering — remove from fired
      triggerOut.fired = triggerOut.fired.filter((id) => id !== 'high_traction_old_site');
    } else {
      triggerOut.forcedMin = 'moderate_candidate';
    }
  }

  const decision = decideAction({
    score: audit_score,
    fired: triggerOut.fired,
    forced: triggerOut.forced,
    forcedMin: triggerOut.forcedMin,
    thresholds: config.decision_thresholds,
  });

  const qualification_reason = buildQualificationReason({ dimensions, issues, fired: triggerOut.fired, audit_score, decision });

  return {
    business_id: entity.entityKey,
    audit_version: config.version,
    audited_at: new Date().toISOString(),
    audit_score,
    dimension_scores,
    decision,
    qualification_reason,
    hard_triggers: triggerOut.fired,
    issues,
    dimensions,
    inputs_present: {
      entity: true,
      business_profile: Boolean(businessProfile),
      fetch_payload: Boolean(fetchPayload),
      raw_html: Boolean(fetchPayload?.rawHtml),
      lighthouse: Boolean(fetchPayload?.lighthouse),
      visual_score_provided: Number.isFinite(visualScore),
    },
  };
}

function buildQualificationReason({ dimensions, issues, fired, audit_score, decision }) {
  const parts = [];
  parts.push(`audit_score=${audit_score} → ${decision}`);
  const weakDims = Object.entries(dimensions)
    .sort(([, a], [, b]) => a.score - b.score)
    .slice(0, 2)
    .map(([k, v]) => `${k} ${v.score}`);
  parts.push(`weakest: ${weakDims.join(', ')}`);
  if (fired.length) parts.push(`fired: ${fired.join(', ')}`);
  if (issues.critical.length) parts.push(`${issues.critical.length} critical issues`);
  return parts.join(' · ');
}
