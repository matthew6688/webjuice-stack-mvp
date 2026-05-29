#!/usr/bin/env node
/**
 * pl:build-single-page-brief · codex R78 · DETERMINISTIC render-contract builder.
 *
 * Generates clients/<slug>/v2/single-page-brief.yaml — the composer's canonical render
 * brief (R16: footer reads brief.abn||licNum.ABN) — which until now was HAND-AUTHORED
 * (only vicwest had one). This is the missing writer.
 *
 * codex R78 boundaries — this is a VERIFIED RENDER-CONTRACT BUILDER, **not a copywriter**:
 *   - input priority: core-extract.json brief.real_facts  >  master.md frontmatter  >  null/data_gap
 *   - it maps / formats / defaults schema-required fields. It invents NO new facts.
 *   - it does NOT call an LLM and does NOT modify core-extract.json.
 *   - missing/insufficient required fields → emitted as null + recorded in `_data_gaps`
 *     (the validator is the hard gate; this builder surfaces gaps, it does not paper over them).
 *
 * Usage: node scripts/cli/pl-build-single-page-brief.js --slug <slug> [--json]
 *   then: pl:validate-single-page-brief --slug <slug>
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

const argv = process.argv.slice(2);
const getArg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const slug = getArg('slug');
const JSON_OUT = argv.includes('--json');
if (!slug) { console.error('--slug required'); process.exit(1); }
const V2 = `clients/${slug}/v2`;

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); } catch { return null; } };
const ce = readJson(`${V2}/core-extract.json`);
if (!ce) { console.error(`✗ no core-extract.json for ${slug} — run pl:llm-extract-core first`); process.exit(2); }
const rf = ce.brief?.real_facts || {};

// master.md YAML frontmatter (fallback only)
let fm = {};
try {
  const md = fs.readFileSync(path.resolve(`${V2}/master.md`), 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (m) fm = yaml.load(m[1]) || {};
} catch { /* optional */ }

const gaps = [];
const review = [];

// codex R80: entity.json is the SSOT for the official-registry licence lookup
// (pl-license-lookup writes entity.license). Read it directly — it outranks core-extract's
// second-hand real_facts for the licence number.
// codex R81 read gate: only trust a CONFIRMED, strong-anchor licence. A weak/fuzzy
// match (token_prefix/fts · or ABN-mismatch) must NOT flow into the brief — omit instead.
const HIGH_CONF_TIER = /^(abn_exact|licence_number_exact|name_exact_normalized)/;
let entityLicense = null;
try {
  const bid = String(fm.business_id || '').trim();
  if (bid) {
    const ent = readJson(`data/leads/entities/${bid}.json`);
    const L = ent?.license;
    const confirmed = L && (L.confidence === 'confirmed' || HIGH_CONF_TIER.test(L.lookup_tier || ''));
    if (L && confirmed && (L.licence_number || L.number) && /active|current/i.test(L.status || '')) {
      entityLicense = { authority: L.authority || null, number: L.licence_number || L.number, status: 'active', _provenance: `official_registry:${L.lookup_tier || 'confirmed'}` };
    } else if (L && L.needs_manual_license_confirm) {
      review.push('license: entity has an UNCONFIRMED candidate (low-confidence lookup) — omitted from brief · needs_manual_license_confirm');
    }
  }
} catch { /* optional */ }

const gap = (field, why) => { gaps.push(`${field}: ${why}`); return null; };

// ── phone ──
const rawPhone = (Array.isArray(rf.phone) ? rf.phone[0] : rf.phone) || fm.phone || null;
let phone = null;
if (rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  const nat = digits.replace(/^61/, '').replace(/^0/, ''); // 9 national digits
  // display grouped 4-3-3 from national 0-prefixed (matches schema phone pattern for both
  // mobile 04xx and landline 0x · e.g. 0740356187 → "0740 356 187")
  const full = `0${nat}`;
  phone = nat.length === 9
    ? { display: `${full.slice(0, 4)} ${full.slice(4, 7)} ${full.slice(7)}`, tel_link: `+61${nat}` }
    : gap('phone', `unparseable "${rawPhone}"`);
} else gap('phone', 'absent in real_facts + frontmatter');

// ── address ── "98 Buchan St, Portsmith QLD 4870" / "...VIC 3350, Australia"
let address = null, state = null;
const rawAddr = rf.address || fm.address || null;
if (rawAddr) {
  const a = String(rawAddr).replace(/,\s*Australia\s*$/i, '').trim();
  const m = a.match(/^(.+?),\s*(.+?)\s+(VIC|QLD|NSW|WA|SA|TAS|ACT|NT)\s+(\d{4})$/i);
  if (m) { address = { street: m[1].trim(), suburb: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] }; state = address.state; }
  else gap('address', `unparseable "${rawAddr}"`);
} else gap('address', 'absent');
if (!state) state = (fm.state || '').toUpperCase() || gap('state', 'no parseable state');

// ── abn ──
const abn = rf.abn?.number || rf.license_numbers?.abn || gap('abn', 'absent in real_facts');

// ── license ── state→authority; number from state license fields (often absent for trades)
const AUTHORITY = { VIC: 'VBA', QLD: 'QBCC', NSW: 'NSW-FT', WA: 'BC-WA', SA: 'CBS-SA', TAS: 'CBOS-TAS', ACT: 'AC-ACT', NT: 'NT-WS' };
const ln = rf.license_numbers || {};
const licNumber = ln.VBA || ln.vba || ln.QBCC || ln.qbcc || ln.other_state_license || ln.state_license_number ||
  (Array.isArray(ln.state_license_numbers) && ln.state_license_numbers[0]) || null;
// License priority (codex R80): entity.license (official registry · SSOT) > core-extract
// real_facts > omit. status='omit' is valid for genuine ABN-only trades (no displayable number).
let license;
if (entityLicense) {
  license = { authority: entityLicense.authority || (state ? AUTHORITY[state] : null), number: entityLicense.number, status: 'active' };
  review.push(`license: from entity.json official_registry lookup (${license.authority} ${license.number})`);
} else if (licNumber) {
  license = { authority: state ? AUTHORITY[state] : null, number: licNumber, status: 'active' };
} else {
  license = { authority: state ? AUTHORITY[state] : null, number: null, status: 'omit' };
  review.push(`license: status='omit' (no licence number in entity.json or core-extract · claim="${ln.licence_claim || ln.license_claim || 'n/a'}") — footer shows ABN only · consider pl:license-lookup backfill`);
}

// ── suburbs (publish gate = verified ≥8 · codex R79: NEVER pad with ai-inferred) ──
const suburbs = (rf.suburbs_served || []).filter((s) => s && String(s).length >= 2);
// ai-inferred service-area candidates kept SEPARATE with provenance — not coverage facts.
const provOf = (src) => Array.isArray(src) ? src.join('|') : (src || 'ai-inferred'); // source may be string OR array
const suburbCandidates = (ce.brief?.ai_extensions?.suggested_suburbs || [])
  .filter(Boolean)
  .map((s) => (typeof s === 'string' ? { name: s, provenance: 'ai-inferred' } : { name: s.name, provenance: provOf(s.source) }))
  .filter((s) => s.name);
if (suburbs.length < 8) gap('suburbs_covered', `only ${suburbs.length} verified (<8) — needs_enrichment · ${suburbCandidates.length} ai-inferred candidates available (NOT counted · provenance-gated · codex R79)`);

// ── services (min 3) ── from verified service_list; short = condensed brief (no new facts)
const services = (rf.service_list || []).slice(0, 8).map((s) => ({
  name: (typeof s === 'string' ? s : s.name),
  short: (typeof s === 'object' && s.brief ? String(s.brief) : `${typeof s === 'string' ? s : s.name} services`).slice(0, 160),
})).filter((s) => s.name && s.name.length >= 3);
if (services.length < 3) gap('services', `only ${services.length} (<3) verified`);

// ── editorial defaults (NOT facts · flagged for human review · codex R78: builder may default) ──
const primary_segment = 'planned-upgrade'; review.push('primary_segment: defaulted to planned-upgrade — confirm vs urgency mix');
// scheduled-heavy avoids the emergency_response_sla_hours cross-requirement (no SLA fact available)
const urgency_mix = 'scheduled-heavy'; review.push('urgency_mix: defaulted to scheduled-heavy (no emergency SLA fact)');
const pricing_disclosure_mode = 'per_quote_only'; review.push('pricing_disclosure_mode: defaulted to per_quote_only');

const brandPath = `clients/${slug}/v2/brand/brand-tokens.css`;
const brand_tokens_path = fs.existsSync(path.resolve(brandPath)) ? brandPath : gap('brand_tokens_path', 'brand-tokens.css not found');

// founded year (number)
const fy = String(rf.founded_year || '').match(/\b(19|20)\d{2}\b/);
const year_founded = fy ? Number(fy[0]) : (fm.founded_year || null);

const brief = {
  business_name: rf.business_name || fm.business_name || gap('business_name', 'absent'),
  phone, address, state, abn, license,
  niche: 'roofing', // Phase A: roofing-only (schema enum) · frontmatter may say "roofer"
  primary_segment, urgency_mix, pricing_disclosure_mode,
  year_founded,
  service_area_primary_suburb: suburbs[0] || null,
  brand_tokens_path,
  suburbs_covered: suburbs,
  suburbs_candidates: suburbCandidates, // codex R79: ai-inferred · provenance-gated · NOT publish coverage
  services,
  _generated_by: 'pl-build-single-page-brief (deterministic · core-extract.real_facts > master.md frontmatter · codex R78)',
  _data_gaps: gaps,
  _needs_review: review,
};

if (JSON_OUT) { console.log(JSON.stringify(brief, null, 2)); process.exit(0); }

const header = `# ${brief.business_name || slug} · Single-Page Brief · GENERATED (codex R78)\n# Source: core-extract.real_facts > master.md frontmatter · NO LLM · NO fabricated facts\n# ${gaps.length ? `⚠️ ${gaps.length} data gap(s) — see _data_gaps · validator is the hard gate` : 'no data gaps'}\n`;
const outPath = path.resolve(`${V2}/single-page-brief.yaml`);
fs.writeFileSync(outPath, header + yaml.dump(brief, { lineWidth: 120, noRefs: true }));
console.log(`✓ wrote ${path.relative(REPO, outPath)}`);
if (gaps.length) { console.log(`⚠️  ${gaps.length} data gap(s):`); gaps.forEach((g) => console.log(`   · ${g}`)); }
console.log(`→ next: node scripts/cli/pl-validate-single-page-brief.js --slug ${slug}`);
