#!/usr/bin/env node
/**
 * V2 cheap-audit unit + integration test.
 *
 * 1. Pure unit tests on synthetic entities (Stage 1 only — no fetch needed)
 * 2. Stage 2 site_quick_scan synthetic markdown tests
 * 3. Loads all 31 roofing entities from data/leads/entities, runs V2 Stage 1
 *    (no Stage 2 fetch since that's slow + would re-hit Tinyfish; the rescore
 *    CLI does that with hard evidence)
 * 4. Sanity assertions: V1-known-bad cases (high reviews + https → skip) are
 *    no longer skipped under V2 (high_traction_old_site trigger fires)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { gbpTriage, decideAction, cheapAuditV2, reloadConfig } from '../../core/scoring/cheap-audit-v2.js';
import { siteQuickScan } from '../../core/scoring/site-quick-scan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

reloadConfig();

const assertions = {};

// ─── 1. Stage 1 pure unit tests ────────────────────────────────────────────

// Strong V2 candidate: high rating + many reviews + has https + roofing
const strongCandidate = {
  identifiers: { phoneDigits: '0721417725' },
  latest: {
    name: 'Brisbane Roofing Solutions',
    category: 'Roofing contractor',
    niche: 'roofing',
    sourceQuery: 'roof restoration in Brisbane',
    phone: '(07) 1234 5678',
    rating: 4.8,
    review_count: 118,
    websiteStatus: 'independent_https_site',
    address: '123 Test St, Brisbane City QLD 4000',
    signals: { hasPhone: true, hasWebsite: true, hasPopularTimes: false, hasAboutAttributes: true, imageCount: 6 },
  },
};

const s1 = gbpTriage(strongCandidate, { sourceQuery: 'roof restoration brisbane' });
assert.ok(s1.relevance_pass, 'roofing-contractor + roof query passes relevance');
assert.ok(s1.gbp_quality >= 80, `expected gbp_quality >= 80 for strong candidate, got ${s1.gbp_quality}`);
assertions.stage1_strong_candidate_high_score = true;

// V1-known-bad case: WeatherpRoof — was skip(45) under V1
const v1Bad = {
  identifiers: { phoneDigits: '0721000000' },
  latest: {
    name: 'WeatherpRoof Restorations',
    category: 'Roofing contractor',
    niche: 'roofing',
    sourceQuery: 'roof restoration in Brisbane',
    phone: '0700 000 000',
    rating: 4.9,
    review_count: 134,
    websiteStatus: 'independent_https_site',
    address: '1 Some St, Brisbane QLD 4000',
    signals: { hasPhone: true, hasWebsite: true, hasPopularTimes: false, hasAboutAttributes: true, imageCount: 4 },
  },
};
const v1BadStage1 = gbpTriage(v1Bad, { sourceQuery: 'roof restoration in Brisbane' });
assert.ok(v1BadStage1.gbp_quality >= 70, `V1-bad case should now score >= 70, got ${v1BadStage1.gbp_quality}`);
assertions.v1_known_bad_now_passes = true;

// V1-bad has independent_https_site, so it goes through threshold path.
// Hard trigger high_traction_old_site (review_count >= 100 AND rating >= 4.5) should
// lift it AT LEAST to audit_candidate even when score alone would say otherwise.
const v1BadFullAudit = cheapAuditV2({ entity: v1Bad, sourceQuery: 'roof restoration in Brisbane' });
// No fetchPayload → redesign_need is null → final_score = gbp_quality alone (~75)
// gbp >= 70 → threshold path "audit_candidate" or hard-trigger lifts. Both good.
assert.ok(['audit_candidate', 'manual_review'].includes(v1BadFullAudit.action),
  `expected audit_candidate or manual_review (with hint to fetch), got ${v1BadFullAudit.action}`);
assert.notEqual(v1BadFullAudit.action, 'skip', 'V1 known-bad case must NOT skip in V2');
assertions.v1_known_bad_does_not_skip_in_v2 = true;

// Relevance fail — name AND category AND categories array all non-roofing.
// Note: under the expanded haystack (cat + categories + name), a wrong
// PRIMARY category is forgiven if name still says "roofing"; that's the
// desired behavior (Roof Space Renovators has primary "Home improvement
// store" but is clearly a roofer).
const wrongCategory = {
  ...strongCandidate,
  latest: {
    ...strongCandidate.latest,
    name: 'Pete\'s Pizza Palace',
    category: 'Pizza takeaway',
    categories: ['Pizza takeaway', 'Italian restaurant'],
  },
};
const wrongCatStage1 = gbpTriage(wrongCategory, { sourceQuery: 'roof restoration brisbane' });
assert.equal(wrongCatStage1.relevance_pass, false);
assertions.relevance_fail_detected = true;

// Misclassified roofer — primary category is non-roofing but name reveals
// the business. Should pass relevance under expanded haystack.
const misclassifiedRoofer = {
  ...strongCandidate,
  latest: {
    ...strongCandidate.latest,
    name: 'Roof Space Renovators',
    category: 'Home improvement store',
    categories: ['Home improvement store', 'Skylight contractor'],
  },
};
const misStage1 = gbpTriage(misclassifiedRoofer, { sourceQuery: 'roof restoration brisbane' });
assert.equal(misStage1.relevance_pass, true, 'misclassified-but-named roofer should pass relevance');
assertions.misclassified_roofer_passes = true;

// No-website with phone + reachable → starter_candidate
const noWebsiteReachable = {
  identifiers: { phoneDigits: '0420764197' },
  latest: {
    name: 'Regan Brothers Roof Restoration',
    category: 'Roofing contractor',
    niche: 'roofing',
    sourceQuery: 'roof restoration in Brisbane',
    phone: '0420 764 197',
    rating: 5,
    review_count: 4,
    websiteStatus: 'no_website',
    address: 'Kallangur QLD 4503',
    signals: { hasPhone: true, hasWebsite: false, imageCount: 2 },
  },
};
const noWebDecision = cheapAuditV2({ entity: noWebsiteReachable, sourceQuery: 'roof restoration brisbane' });
assert.equal(noWebDecision.action, 'starter_candidate', `no_website + reachable should be starter_candidate, got ${noWebDecision.action}`);
assertions.no_website_reachable_starter_candidate = true;

// No-website + unreachable → queued_for_enrichment (Stage 0.5)
const noWebsiteUnreachable = {
  identifiers: {},
  latest: {
    name: 'Some Roofing Co',
    category: 'Roofing contractor',
    niche: 'roofing',
    sourceQuery: 'roof restoration brisbane',
    phone: '',
    rating: 0,
    review_count: 0,
    websiteStatus: 'no_website',
    address: '',
    signals: {},
  },
};
const noWebUnreachableDecision = cheapAuditV2({ entity: noWebsiteUnreachable, sourceQuery: 'roof restoration brisbane' });
assert.equal(noWebUnreachableDecision.action, 'queued_for_enrichment', 'unreachable no-website should queue for enrichment');
assertions.no_website_unreachable_queued_for_enrichment = true;

// ─── 2. Stage 2 site quick scan ─────────────────────────────────────────────

// Bad site: HTTP, no local mention, no CTA, thin text, stale year
const badSite = siteQuickScan({
  url: 'http://example-bad-roofing.com.au',
  markdown: 'Welcome to our company. Roofing services. © Copyright 2018',
  businessCity: 'Brisbane',
  phoneDigits: '0712345678',
  currentYear: 2026,
});
assert.ok(badSite.redesign_need >= 50, `bad site should score redesign_need >= 50, got ${badSite.redesign_need}`);
assertions.stage2_bad_site_high_redesign_need = true;

// Good site: HTTPS, local, CTA, fresh, all sections
const goodSite = siteQuickScan({
  url: 'https://example-good-roofing.com.au',
  markdown: `# Brisbane Roofing — Get a free quote today\n\nWe serve Brisbane and surrounding suburbs including New Farm and Kangaroo Point. Our services include roof restoration, repairs, and gutter replacement. Read our reviews from happy customers and check our gallery. Contact us for a free quote at 07 1234 5678. About us — 30 years experience. FAQ section below.\n\n© 2026 Brisbane Roofing`,
  businessCity: 'Brisbane',
  phoneDigits: '0712345678',
  currentYear: 2026,
});
assert.ok(goodSite.redesign_need <= 30, `good site should score redesign_need <= 30, got ${goodSite.redesign_need}`);
assertions.stage2_good_site_low_redesign_need = true;

// ─── 3. Run V2 Stage 1 against all 31 real roofing entities ────────────────

const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const allFiles = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));
const roofingEntities = [];
for (const f of allFiles) {
  const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
  if ((e.latest?.category || '').includes('oof')) roofingEntities.push(e);
}
assert.ok(roofingEntities.length >= 30, `expected >= 30 roofing entities, got ${roofingEntities.length}`);

const v2Audits = roofingEntities.map((e) => ({
  name: e.latest.name,
  v1_score: e.latest.discoveryScore,
  v1_action: e.latest.recommendedAction,
  v2: cheapAuditV2({ entity: e, sourceQuery: e.latest.sourceQuery }),
}));

// V1 → V2 flip diagnostics
const flipped = v2Audits.filter((a) => a.v1_action === 'skip' && a.v2.action !== 'skip');
const stillSkip = v2Audits.filter((a) => a.v2.action === 'skip');
const newCandidates = v2Audits.filter((a) => ['audit_candidate', 'starter_candidate'].includes(a.v2.action));

console.log(`\n[v2 audit diagnostics] ${roofingEntities.length} roofing entities:`);
console.log(`  V1 → V2 flipped (skip → not_skip): ${flipped.length}`);
console.log(`  Still skip in V2: ${stillSkip.length}`);
console.log(`  New candidates (audit_ + starter_): ${newCandidates.length}`);

// Top examples flipped
console.log('\n[top flips]');
for (const a of flipped.slice(0, 5)) {
  console.log(`  ${a.name.padEnd(50)} V1 ${a.v1_action} (${a.v1_score}) → V2 ${a.v2.action} (gbp ${a.v2.gbp_quality})`);
}

// Sanity: V1 over-aggressive skipping was happening, so V2 should flip several
assert.ok(flipped.length >= 3, `V2 should flip at least 3 V1-skip entities; got ${flipped.length}`);
assertions.v2_unflagged_at_least_3_v1_skips = true;

// Sanity: high-review leads (≥50) should never be skip in V2
const highReviewSkipped = v2Audits.filter((a) => Number(a.v2.stage_1.rules.find((r) => r.id === 'review_volume')?.earned) >= 18 && a.v2.action === 'skip');
assert.equal(highReviewSkipped.length, 0, `no lead with ≥50 reviews should skip in V2; ${highReviewSkipped.length} did: ${highReviewSkipped.map((a)=>a.name).join(', ')}`);
assertions.no_high_review_lead_skipped = true;

console.log('\n');
console.log(JSON.stringify({
  ok: true,
  roofing_entities_tested: roofingEntities.length,
  flips: { v1_skip_to_v2_not_skip: flipped.length },
  still_skip: stillSkip.length,
  new_candidates: newCandidates.length,
  assertions,
}, null, 2));
