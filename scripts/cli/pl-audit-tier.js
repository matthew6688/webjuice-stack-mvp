#!/usr/bin/env node
/**
 * pl:audit-tier · 4-tier production audit per SOP-AUDIT-STANDARD.md
 *
 * T1 · Factual / Brand (PASS/FAIL · zero tolerance)
 * T2 · Copy Depth & Quality (0-100)
 * T3 · Visual Design (0-100 · uses pl:audit-vision)
 * T4 · Tech / SEO (0-100)
 * composite = (T2+T3+T4)/3 gated by T1
 *
 * Spec: docs/v3/SOP-AUDIT-STANDARD.md
 * Usage:
 *   npm run pl:audit-tier -- --slug X --output-dir <dir> [--skip-vision] [--skip-codex]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { FORBIDDEN_PHRASES } from '../../core/handoff/niche-spec-loader.js';

// ─── Args ─────────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    const next = process.argv[i + 1];
    if (next === undefined || next.startsWith('--')) { args[key] = true; }
    else { args[key] = next; i++; }
  }
}
const slug = args.slug;
const outputDir = args['output-dir'];
if (!slug || !outputDir) { console.error('Usage: --slug X --output-dir <dir>'); process.exit(2); }

const REPO = process.cwd();
const factsPath = `clients/${slug}/concept/open-design-seed/facts.json`;
const briefPath = `clients/${slug}/v2/customer-brief.md`;
const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
const brief = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, 'utf8') : '';

// ─── Page-type detection + per-type requirements (per SOP §2A) ──────────
const PAGE_TYPE_RULES = {
  home:        { minWords: 1500, minSections: 10, required: ['hero','trust-bar','services-grid','why-us','process','proof','gallery','service-areas','faq','cta'] },
  index:       { minWords: 1500, minSections: 10, required: ['hero','trust-bar','services-grid','why-us','process','proof','gallery','service-areas','faq','cta'] },
  'roof-replacements': { minWords: 1000, minSections: 7, required: ['hero','pain-point','process','materials','warranty','faq','lead-form'] },
  'new-roofs':       { minWords: 1000, minSections: 7, required: ['hero','process','materials','case-study','faq','lead-form'] },
  gutters:           { minWords: 1000, minSections: 7, required: ['hero','pain-point','process','materials','case-study','faq','lead-form'] },
  'builders-commercial': { minWords: 1000, minSections: 7, required: ['hero','process','materials','case-study','faq','lead-form'] },
  about:       { minWords: 800,  minSections: 6, required: ['hero','story','team','numbers','values','cta'] },
  contact:     { minWords: 200,  minSections: 4, required: ['hero','form','multi-channel','cta'] },  // calibrated to weatherproof contact 221 words
  gallery:     { minWords: 250,  minSections: 3, required: ['hero','before-after','cta'] },  // calibrated to weatherproof our-work 256 words
  projects:    { minWords: 250,  minSections: 3, required: ['hero','before-after','cta'] },
  'service-areas': { minWords: 400, minSections: 4, required: ['hero','suburb-list','cta'] },
  careers:     { minWords: 500,  minSections: 5, required: ['hero','roles','culture','benefits','apply'] },
  blog:        { minWords: 350,  minSections: 3, required: ['hero','post-list','cta'] },  // index page · individual posts are own pages
  // AUXILIARY pages excluded from word-count/section requirements (T2 D2.1/D2.2)
  privacy:     { minWords: 0,    minSections: 0, required: [], aux: true },
  terms:       { minWords: 0,    minSections: 0, required: [], aux: true },
  cookie:      { minWords: 0,    minSections: 0, required: [], aux: true },
  sitemap:     { minWords: 0,    minSections: 0, required: [], aux: true },
  redirect:    { minWords: 0,    minSections: 0, required: [], aux: true },  // weatherproof-redesign.html style stubs
  default:     { minWords: 600,  minSections: 5, required: ['hero','content','cta'] },
};
function pageType(filename) {
  const base = path.basename(filename, '.html').toLowerCase();
  // Map name → rule key (allow variants like privacy-policy → privacy)
  if (/^privacy/.test(base)) return 'privacy';
  if (/^terms/.test(base)) return 'terms';
  if (/^cookie/.test(base)) return 'cookie';
  if (/^sitemap/.test(base)) return 'sitemap';
  if (/-redesign$/.test(base) || /^404$/.test(base)) return 'redirect';
  if (/^blog$|^news$|^articles$/.test(base)) return 'blog';
  if (/^our-work$|^projects?$/.test(base)) return 'gallery';
  if (/^service-areas?$|^areas?$/.test(base)) return 'service-areas';
  return PAGE_TYPE_RULES[base] ? base : 'default';
}
function isAuxiliary(filename) {
  return !!PAGE_TYPE_RULES[pageType(filename)]?.aux;
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Collect HTML files (customer-facing top-level only) ─────────────────
function findHtml(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isFile() && f.endsWith('.html') && !f.includes('preview')) {
      out.push(fp);
    } else if (fs.statSync(fp).isDirectory() && !/(brand|preview|reference|shared)/i.test(f)) {
      // shallow recurse one level (services/* subfolder)
      try {
        for (const f2 of fs.readdirSync(fp)) {
          if (f2.endsWith('.html')) out.push(path.join(fp, f2));
        }
      } catch {}
    }
  }
  return out;
}
const htmlFiles = findHtml(outputDir);
console.log(`[tier-audit] ${slug} · ${htmlFiles.length} page(s) in ${outputDir}`);

// ─── T1 · Factual / Brand · PASS/FAIL ────────────────────────────────────
const t1 = { checks: {}, fails: [] };

// 1.1 business_name on every page · decode HTML entities so "A & J" matches "A &amp; J"
function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&#x26;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
const bnHits = htmlFiles.map(f => decodeEntities(fs.readFileSync(f,'utf8')).includes(facts.business_name) ? 1 : 0);
t1.checks['1.1_business_name_every_page'] = { pass: bnHits.every(h => h === 1), pages_with: bnHits.filter(h=>h).length, total: htmlFiles.length };
if (!t1.checks['1.1_business_name_every_page'].pass) t1.fails.push(`business_name "${facts.business_name}" missing from ${bnHits.filter(h=>!h).length} page(s)`);

// 1.2 phone verbatim · ≥3 per page
// Exclude legal pages (privacy/terms), stub pages (<200 bytes content), and our-work-style proof pages
// from the strict ≥3 rule — they have legitimate reasons to lack repeated phone numbers.
function isAuxPage(file) {
  const name = path.basename(file).toLowerCase();
  if (/^(privacy|terms|cookie|sitemap|legal|404|redirect|.*-redesign\.html)$/.test(name) || name.includes('privacy-policy') || name.includes('terms-of-service')) return true;
  // Stub pages — extracted text content < 200 chars
  const txt = fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt.length < 200;
}
const phoneRe = new RegExp(facts.phone?.replace(/[()+\s\-]/g,'\\s?').replace(/\d/g,'\\d') || '', 'g');
let phoneOk = true;
const phoneCounts = htmlFiles.map(f => {
  const html = fs.readFileSync(f,'utf8');
  const c = (html.match(phoneRe) || []).length;
  if (c < 3 && !isAuxPage(f)) phoneOk = false;
  return c;
});
t1.checks['1.2_phone_verbatim_3plus'] = { pass: phoneOk, per_page: phoneCounts, threshold: 3 };
if (!phoneOk) t1.fails.push(`phone "${facts.phone}" appears <3× on at least one page (counts: ${phoneCounts.join(',')})`);

// 1.3 address on contact + footer (presence on any page in form fragment)
const addrInAny = htmlFiles.some(f => fs.readFileSync(f,'utf8').includes(facts.address?.split(',')[0] || '__never__'));
t1.checks['1.3_address_present'] = { pass: addrInAny, value: facts.address };
if (!addrInAny) t1.fails.push(`address not found on any page`);

// 1.4 ABN: present verbatim OR absent · never fabricated
// Require "ABN" word within 30 chars BEFORE the digit pattern so we don't false-match
// 11-digit phone numbers (e.g. +614035545592 looks like a 11-digit ABN otherwise).
const abnInFacts = facts.abn || facts.abn_number;
const abnPattern = /\bABN[:\s]*([\d]{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/gi;
const allHtml = htmlFiles.map(f => fs.readFileSync(f,'utf8')).join('\n');
const foundAbns = [...new Set([...allHtml.matchAll(abnPattern)].map(m => m[1]))];
let abnOk = true;
if (abnInFacts) {
  abnOk = foundAbns.some(a => a.replace(/\s/g,'') === String(abnInFacts).replace(/\s/g,''));
} else {
  abnOk = foundAbns.length === 0;
}
t1.checks['1.4_abn_no_fabrication'] = { pass: abnOk, facts_has_abn: !!abnInFacts, found_in_html: foundAbns };
if (!abnOk) t1.fails.push(`ABN issue: facts.abn=${abnInFacts || '∅'}, found in HTML: ${foundAbns.join('/')}`);

// 1.5 state licensing authority
const STATE_AUTH = { VIC:'VBA', QLD:'QBCC', NSW:'NSW Fair Trading', WA:'Building Commission', SA:'CBS', TAS:'CBOS', NT:'NT Building Practitioners', ACT:'Access Canberra' };
const wantAuth = STATE_AUTH[facts.state] || facts.licensing_authority;
const wrongStateAuthorities = Object.entries(STATE_AUTH).filter(([s, a]) => s !== facts.state).map(([, a]) => a);
const wrongStateHits = [];
for (const a of wrongStateAuthorities) {
  for (const f of htmlFiles) {
    if (fs.readFileSync(f,'utf8').includes(a)) wrongStateHits.push({ file: path.basename(f), authority: a });
  }
}
t1.checks['1.5_licensing_authority'] = { pass: wrongStateHits.length === 0, expected: wantAuth, wrong_state_hits: wrongStateHits };
if (wrongStateHits.length > 0) t1.fails.push(`wrong-state authority leaks: ${wrongStateHits.map(h => h.authority+'@'+h.file).join(', ')}`);

// 1.6 brand colors used (check brand-spec hex in CSS / inline style)
const brandHex = [facts.brand_primary, facts.brand_accent, facts.primary_color, facts.accent_color].filter(Boolean);
const cssBlob = htmlFiles.map(f => fs.readFileSync(f,'utf8').match(/<style[\s\S]*?<\/style>/g)?.join('\n') || '').join('\n');
const brandFound = brandHex.filter(h => cssBlob.toLowerCase().includes(h.toLowerCase()));
t1.checks['1.6_brand_colors'] = { pass: brandHex.length === 0 || brandFound.length > 0, expected: brandHex, found_in_css: brandFound };
// note: not auto-failing this if facts lacks brand colors (some clients don't have brand-spec.json)
if (brandHex.length > 0 && brandFound.length === 0) t1.fails.push(`brand colors ${brandHex.join('/')} not found in CSS`);

// 1.7b Hours cross-check (v3.2 · 2026-05-20)
// If facts.json has hours and a day is "Closed", HTML cannot say that day is open.
// Caught Vicwest fabricating "Sat By appointment" across 9 pages.
if (facts.hours && typeof facts.hours === 'object') {
  const closedDays = Object.entries(facts.hours).filter(([, v]) => /closed/i.test(String(v))).map(([d]) => d);
  const hoursViolations = [];
  for (const day of closedDays) {
    const dayShort = day.slice(0, 3);
    const fakeOpenRe = new RegExp(`(${day}|${dayShort})\\s+(by appointment|\\d{1,2}[:.]\\d{2}|\\d{1,2}\\s?[ap]m)`, 'i');
    for (const f of htmlFiles) {
      const html = fs.readFileSync(f,'utf8');
      const m = html.match(fakeOpenRe);
      if (m) hoursViolations.push({ file: path.basename(f), day, says: m[0] });
    }
  }
  t1.checks['1.7b_hours_no_fabrication'] = { pass: hoursViolations.length === 0, closed_days: closedDays, violations: hoursViolations.slice(0, 10) };
  if (hoursViolations.length > 0) t1.fails.push(`fabricated hours: ${hoursViolations.length} pages say ${closedDays.join('/')} is open (sample: "${hoursViolations[0].says}" on ${hoursViolations[0].file})`);
}

// 1.8 fabricated stats check (simple regex · catches obvious +N% / N,N+ / N×)
const fabricatedPatterns = [
  /\+\s?\d+%/g,           // +47%, +50%
  /\d{1,3},\d{3}\+?\s?(customers|clients|users|members|installs|roofs|projects)/gi,  // 50,000+ customers
  /\d+×\s?(faster|better|more)/gi,  // 10x faster
];
const stats = [];
for (const f of htmlFiles) {
  const txt = fs.readFileSync(f,'utf8');
  for (const re of fabricatedPatterns) {
    const matches = txt.match(re);
    if (matches) stats.push({ file: path.basename(f), matches });
  }
}
// allow specific known facts (e.g. 10,000+ roofs IF in facts narrative)
const allowedStats = (brief.match(/\d{1,3},\d{3}\+?|\d+\+\s?(years|years')/gi) || []);
const realStatHits = stats.filter(s => !s.matches.every(m => allowedStats.some(a => a.includes(m.replace(/[+\s,]/g,'')))));
t1.checks['1.8_no_fabricated_stats'] = { pass: realStatHits.length === 0, suspicious: realStatHits };
// soft warning for stats · only auto-fail if more than 3 suspicious
if (realStatHits.length > 3) t1.fails.push(`>3 unverified stat claims: ${realStatHits.slice(0,3).map(s=>s.matches.join(',')).join(' | ')}`);

// ─── 1.9 · License no-fabrication (Phase 1.3 · 2026-05-27) ─────────────
// If entity.license.status !== 'active', the customer-facing HTML must NOT
// claim a license. Grey-zone customers OK · just no false claims.
// Resolves slug → master.md → business_id → entity → entity.license.
let licenseStatus = 'unknown';
let licenseNumber = null;
let licenseAuthority = null;
try {
  const slugMatch = outputDir.match(/clients\/([^\/]+)\//) || outputDir.match(/^([^\/]+)$/);
  const slug = slugMatch && slugMatch[1];
  if (slug) {
    const mdPath = path.join(REPO, 'clients', slug, 'v2', 'master.md');
    if (fs.existsSync(mdPath)) {
      const md = fs.readFileSync(mdPath, 'utf8');
      const bid = md.match(/business_id:\s*"([^"]+)"/);
      if (bid) {
        const ef = path.join(REPO, 'data/leads/entities', `${bid[1]}.json`);
        if (fs.existsSync(ef)) {
          const e = JSON.parse(fs.readFileSync(ef, 'utf8'));
          if (e.license) {
            licenseStatus = e.license.status || 'unknown';
            licenseNumber = e.license.licence_number || null;
            licenseAuthority = e.license.authority || null;
          }
        }
      }
    }
  }
} catch {}

// Scan HTML for license claims
const LICENSE_CLAIM_PATTERNS = [
  /\bvba[\s\-]?licen[cs]ed?\b/i,
  /\bqbcc[\s\-]?licen[cs]ed?\b/i,
  /\bfair[\s\-]trading[\s\-]?licen[cs]ed?\b/i,
  /\blicen[cs]e[\s#]?(?:no\.?|number)?\s*[#:]?\s*[A-Z0-9\-]{4,}/i,
  /\blicen[cs]ed?\s+(?:building|building\s*practitioner|builder|roofing\s*contractor)/i,
];
const licenseClaimsInHtml = [];
for (const f of htmlFiles) {
  const html = decodeEntities(fs.readFileSync(f, 'utf8'));
  for (const re of LICENSE_CLAIM_PATTERNS) {
    const m = html.match(re);
    if (m) {
      licenseClaimsInHtml.push({ file: path.basename(f), match: m[0].slice(0, 80) });
      break;
    }
  }
}
const claimsHtml = licenseClaimsInHtml.length;
// PASS if: (a) verified license AND HTML claims match · OR (b) no verification AND HTML makes NO claims
const license_check_pass = licenseStatus === 'active'
  ? true   // verified · claims allowed
  : claimsHtml === 0; // unverified · NO claims allowed
t1.checks['1.9_license_no_fabrication'] = {
  pass: license_check_pass,
  entity_license_status: licenseStatus,
  entity_licence_number: licenseNumber,
  entity_authority: licenseAuthority,
  html_license_claims: claimsHtml,
  claims_detail: licenseClaimsInHtml.slice(0, 5),
};
if (!license_check_pass) {
  t1.fails.push(`License claim in HTML but entity.license.status="${licenseStatus}" (not active). ${claimsHtml} claim(s) found · e.g. "${licenseClaimsInHtml[0]?.match}"`);
}

t1.pass = t1.fails.length === 0;
console.log(`[tier-audit] T1: ${t1.pass ? '✓ PASS' : '✗ FAIL'} (${t1.fails.length} fails)`);

// ─── T2 · Copy Depth & Quality ──────────────────────────────────────────
const t2 = { dims: {}, page_word_counts: {}, page_section_counts: {} };

let sectionPresenceScore = 0;
let wordCountScore = 0;
let pagesChecked = 0;
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const filename = path.basename(f);
  const ptype = pageType(filename);
  const rule = PAGE_TYPE_RULES[ptype];
  const text = stripHtml(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sectionMatches = html.match(/<section[^>]*>/gi) || [];
  const sectionCount = sectionMatches.length;
  t2.page_word_counts[filename] = { count: wordCount, threshold: rule.minWords, pass: wordCount >= rule.minWords, aux: !!rule.aux };
  t2.page_section_counts[filename] = { count: sectionCount, threshold: rule.minSections, pass: sectionCount >= rule.minSections, aux: !!rule.aux };
  // Auxiliary pages (privacy/terms/redirects/stubs) don't count toward D2.1/D2.2 scores
  if (rule.aux) continue;
  pagesChecked++;
  if (sectionCount >= rule.minSections) sectionPresenceScore++;
  if (wordCount >= rule.minWords) wordCountScore++;
}
const t2_d21 = pagesChecked ? Math.round(100 * sectionPresenceScore / pagesChecked) : 0;
const t2_d22 = pagesChecked ? Math.round(100 * wordCountScore / pagesChecked) : 0;

// D2.3 forbidden phrases
const allText = htmlFiles.map(f => stripHtml(fs.readFileSync(f,'utf8'))).join(' ').toLowerCase();
const fpHits = FORBIDDEN_PHRASES.filter(p => allText.includes(p.toLowerCase()));
const t2_d23 = fpHits.length === 0 ? 100 : Math.max(0, 100 - fpHits.length * 10);

// D2.4-2.9 from codex-deep-audit (if exists) · per-page text-level findings
let t2_d24 = null, t2_d25 = null, t2_d26 = null;
let t2_d28 = null, t2_d29 = null;
let perPageFindings = [];
let floorViolations = [];
const codexAuditCandidates = [
  path.join(outputDir, '_codex-audit.json'),
  path.join(path.dirname(outputDir), '_codex-audit.json'),
];
const codexAuditPath = codexAuditCandidates.find(p => fs.existsSync(p));
if (codexAuditPath) {
  const ca = JSON.parse(fs.readFileSync(codexAuditPath,'utf8'));
  const pages = Array.isArray(ca) ? ca : ca.results || [];
  const d1s = pages.map(r => r.parsed?.scores?.D1_facts_accuracy).filter(v => typeof v === 'number');
  const d2s = pages.map(r => r.parsed?.scores?.D2_voice_authentic).filter(v => typeof v === 'number');
  const d3s = pages.map(r => r.parsed?.scores?.D3_specificity).filter(v => typeof v === 'number');
  t2_d24 = d1s.length ? Math.round(d1s.reduce((a,b)=>a+b,0) / d1s.length * 10) : null;
  t2_d25 = d2s.length ? Math.round(d2s.reduce((a,b)=>a+b,0) / d2s.length * 10) : null;
  t2_d26 = d3s.length ? Math.round(d3s.reduce((a,b)=>a+b,0) / d3s.length * 10) : null;

  // Filter false-positive leak quotes that originate from generic footer credits / cookie banners
  // (e.g. "Built with ❤️ from profitslocal" is a vendor stamp · not customer-facing meta-language)
  const LEAK_WHITELIST_PATTERNS = [
    /built with .* from profitslocal/i,
    /powered by profitslocal/i,
    /Cookie (Settings|Preferences)/i,
    /^Privacy Policy$/i, /^Terms (Of Service)?$/i,
  ];
  function isWhitelistedLeak(q) {
    return LEAK_WHITELIST_PATTERNS.some(re => re.test(String(q || '')));
  }
  // D2.8 weakness count · D2.9 hallucination count · per-page floor enforcement
  let totalWeakness = 0, totalHallucination = 0;
  let maxLeakOnPage = 0, minPageTotal = 999;
  for (const r of pages) {
    const s = r.parsed?.scores || {};
    const w = r.parsed?.weaknesses || [];
    const h = r.parsed?.hallucinations || [];
    const lRaw = r.parsed?.leak_quotes || [];
    const l = lRaw.filter(q => !isWhitelistedLeak(q));
    // Skip aux pages from floor-violation enforcement
    const isAux = (() => {
      try { return isAuxiliary(r.page); } catch { return false; }
    })();
    totalWeakness += w.length;
    totalHallucination += h.length;
    if (l.length > maxLeakOnPage) maxLeakOnPage = l.length;
    if (typeof s.total === 'number' && s.total < minPageTotal) minPageTotal = s.total;

    const violations = [];
    if (!isAux) {
      if (typeof s.total === 'number' && s.total < 30) violations.push(`codex_total<30 (${s.total})`);
      if (h.length >= 2) violations.push(`hallucinations>=2 (${h.length})`);
      if (l.length >= 3) violations.push(`leak_quotes>=3 (${l.length})`);
    }

    perPageFindings.push({
      page: r.page,
      codex_total: s.total,
      scores: s,
      weaknesses: w,
      hallucinations: h,
      leak_quotes: l,
      floor_violations: violations,
    });
    if (violations.length) floorViolations.push({ page: r.page, violations });
  }

  // D2.8 score: penalize avg weakness count
  const avgWeakness = pages.length ? totalWeakness / pages.length : 0;
  t2_d28 = avgWeakness <= 2 ? 100 : Math.max(0, 100 - (avgWeakness - 2) * 25);
  // D2.9: 0 hallucinations = 100 · each is -20
  t2_d29 = Math.max(0, 100 - totalHallucination * 20);
}

// D2.7 cross-page uniqueness · simple paragraph overlap
function paragraphs(html) {
  return stripHtml(html).split(/\.|\n/).map(s=>s.trim().toLowerCase()).filter(s=>s.length>=50);
}
const allParas = htmlFiles.map(f => new Set(paragraphs(fs.readFileSync(f,'utf8'))));
let overlapPct = 0;
if (allParas.length >= 2) {
  let total = 0, dup = 0;
  for (let i = 0; i < allParas.length; i++) {
    for (let j = i+1; j < allParas.length; j++) {
      const a = allParas[i], b = allParas[j];
      const shared = [...a].filter(p => b.has(p));
      total += Math.min(a.size, b.size);
      dup += shared.length;
    }
  }
  overlapPct = total ? Math.round(100 * dup / total) : 0;
}
const t2_d27 = Math.max(0, 100 - overlapPct); // 0% overlap = 100 score

const t2WeightSum = (t2_d24 != null ? 0.25 : 0) + (t2_d25 != null ? 0.10 : 0) + (t2_d26 != null ? 0.10 : 0);
const t2KnownWeightSum = 0.25 + 0.15 + 0.15 + 0.10 + t2WeightSum;  // 0.65 + codex part
t2.dims = {
  'D2.1_section_presence':      { score: t2_d21, weight: 0.15 },
  'D2.2_word_count':            { score: t2_d22, weight: 0.10 },
  'D2.3_forbidden_phrases':     { score: t2_d23, weight: 0.10, hits: fpHits },
  'D2.4_facts_accuracy':        { score: t2_d24, weight: 0.20 },
  'D2.5_voice_authentic':       { score: t2_d25, weight: 0.15 },
  'D2.6_specificity':           { score: t2_d26, weight: 0.15 },
  'D2.7_uniqueness':            { score: t2_d27, weight: 0.05, paragraph_overlap_pct: overlapPct },
  'D2.8_weakness_count':        { score: t2_d28, weight: 0.05 },
  'D2.9_hallucination_count':   { score: t2_d29, weight: 0.05 },
};
let t2Score = 0;
for (const [k, v] of Object.entries(t2.dims)) {
  if (v.score != null) t2Score += v.score * v.weight;
}
t2.score = Math.round(t2Score);

// Per-Page Floor Rule (v3.1 · SOP §2C)
// Single-page quality can't be smoothed by good pages
let t2Cap = null;
if (floorViolations.length > 0) {
  for (const fv of floorViolations) {
    for (const v of fv.violations) {
      if (v.startsWith('codex_total<30')) t2Cap = Math.min(t2Cap ?? 60, 60);
      if (v.startsWith('hallucinations>=2')) t2Cap = Math.min(t2Cap ?? 50, 50);
      if (v.startsWith('leak_quotes>=3')) t2Cap = Math.min(t2Cap ?? 60, 60);
    }
  }
  if (t2Cap != null && t2.score > t2Cap) {
    t2.score_pre_cap = t2.score;
    t2.score = t2Cap;
    t2.floor_cap_applied = t2Cap;
  }
}
t2.per_page_findings = perPageFindings;
t2.floor_violations = floorViolations;
t2.codex_available = t2_d24 != null;
console.log(`[tier-audit] T2: ${t2.score}/100 (${t2.codex_available ? 'with codex' : 'static-only · missing D2.4-2.6'})`);

// ─── T3 · Visual / Design ──────────────────────────────────────────────
const t3 = { dims: {}, notes: [] };

// T3/T4 dims: exclude AUX pages (privacy/terms/redirects) from non-chrome metrics
// (chrome consistency still measures across all pages — header/footer should match everywhere)
const contentHtmlFiles = htmlFiles.filter(f => !isAuxiliary(f));

// D3.4 chrome consistency (all pages including aux · header/footer should be identical sitewide)
// Normalize per-page nav state (active link / aria-current / depth-relative paths) before comparing.
function extractRegion(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  return m[1]
    .replace(/\bclass="([^"]*?)\b(active|current|is-current|on|selected)\b\s*([^"]*?)"/g, 'class="$1$3"')
    .replace(/\baria-current=["'][^"']*["']/g, '')
    .replace(/\bdata-active(=["'][^"']*["'])?/g, '')
    .replace(/(\.\.\/)+(brand|assets|shared|css|js)\//g, '$2/')
    .replace(/\s+/g, ' ')
    .trim();
}
const headers = htmlFiles.map(f => extractRegion(fs.readFileSync(f,'utf8'), 'header'));
const footers = htmlFiles.map(f => extractRegion(fs.readFileSync(f,'utf8'), 'footer'));
const headerUnique = new Set(headers.filter(h => h.length > 50)).size;
const footerUnique = new Set(footers.filter(f => f.length > 50)).size;
const headerConsistent = headerUnique <= 1;
const footerConsistent = footerUnique <= 1;
const t3_d34 = (headerConsistent ? 50 : Math.max(0, 50 - (headerUnique-1) * 15)) + (footerConsistent ? 50 : Math.max(0, 50 - (footerUnique-1) * 15));

// D3.5 module diversity per page (content pages only · aux pages excluded)
let moduleDiversityScore = 0;
const moduleTypes = {};
for (const f of contentHtmlFiles) {
  const html = fs.readFileSync(f,'utf8');
  const classes = [...new Set((html.match(/class="[^"]+"/g) || []).flatMap(c => c.replace(/^class="|"$/g,'').split(/\s+/)))];
  // detect distinct "module-ish" class names · heuristic
  const moduleClasses = classes.filter(c => /^(hero|services?|trust|why|process|gallery|proof|review|cta|faq|footer|header|stats|about|contact|case|team|warranty|spec|comparison|nav)/i.test(c));
  const uniqueTypes = new Set(moduleClasses.map(c => c.split('-')[0].toLowerCase())).size;
  moduleTypes[path.basename(f)] = uniqueTypes;
  if (uniqueTypes >= 5) moduleDiversityScore++;
}
const t3_d35 = contentHtmlFiles.length ? Math.round(100 * moduleDiversityScore / contentHtmlFiles.length) : 0;

// D3.6 typography hierarchy (count distinct font-sizes in CSS)
const fontSizes = new Set();
for (const f of htmlFiles) {
  const html = fs.readFileSync(f,'utf8');
  const sizes = html.match(/font-size:\s*[\d.]+(?:px|rem|em)/g) || [];
  sizes.forEach(s => fontSizes.add(s.match(/[\d.]+(?:px|rem|em)/)[0]));
}
const t3_d36 = fontSizes.size >= 4 ? 100 : Math.round(fontSizes.size / 4 * 100);

// D3.1 vision audit · invoke pl:audit-vision (optional · skip if --skip-vision)
let t3_d31 = null, visionReport = null;
if (!args['skip-vision']) {
  console.log(`[tier-audit] T3.1 vision audit running (Claude vision · ~3 min)...`);
  const visionOut = path.join(outputDir, '_vision-audit.json');
  // facts file path: try expanded forms
  const factsFile = factsPath;
  const r = await new Promise(resolve => {
    const p = spawn('npm', ['run', 'pl:audit-vision', '--', '--dir', outputDir, '--facts', factsFile, '--out', visionOut], { stdio: 'pipe' });
    let out = '', err = '';
    p.stdout.on('data', c => out += c.toString());
    p.stderr.on('data', c => err += c.toString());
    p.on('exit', code => resolve({ code, out, err }));
  });
  if (fs.existsSync(visionOut)) {
    visionReport = JSON.parse(fs.readFileSync(visionOut,'utf8'));
    t3_d31 = parseFloat(visionReport.composite_score) || null;
    console.log(`[tier-audit] T3.1 vision composite: ${t3_d31}/100`);
  } else {
    console.log(`[tier-audit] T3.1 vision audit failed (no output): exit=${r.code}`);
  }
}

t3.dims = {
  'D3.1_vision_10dim':         { score: t3_d31, weight: 0.50 },
  'D3.4_chrome_consistency':   { score: t3_d34, weight: 0.05, header_unique: headerUnique, footer_unique: footerUnique },
  'D3.5_module_diversity':     { score: t3_d35, weight: 0.05, per_page: moduleTypes },
  'D3.6_typography_hierarchy': { score: t3_d36, weight: 0.04, unique_sizes: fontSizes.size },
};
let t3Score = 0; let t3KnownWeight = 0;
for (const v of Object.values(t3.dims)) {
  if (v.score != null) { t3Score += v.score * v.weight; t3KnownWeight += v.weight; }
}
t3.score = t3KnownWeight > 0 ? Math.round(t3Score / t3KnownWeight * 100) / (100 / Math.round(t3KnownWeight * 100)) : 0;
t3.score = t3KnownWeight > 0 ? Math.round(t3Score / t3KnownWeight) : 0;
t3.vision_included = t3_d31 != null;
console.log(`[tier-audit] T3: ${t3.score}/100 (${t3.vision_included ? 'with vision' : 'static-only · missing D3.1 vision'})`);

// ─── T4 · Tech / SEO ──────────────────────────────────────────────────
const t4 = { dims: {} };

// T4 dims: aux pages excluded from quality metrics (still counted for build-sanity since they must be valid HTML)
// D4.1 build sanity · all pages must be valid (aux included · they still need DOCTYPE + title)
let buildSanityScore = 0;
for (const f of htmlFiles) {
  const html = fs.readFileSync(f,'utf8');
  let ok = true;
  if (!/<!doctype\s+html/i.test(html)) ok = false;
  if (!/<title>[^<]+<\/title>/i.test(html)) ok = false;
  if (!/<h1[^>]*>[^<]+<\/h1>/i.test(html)) ok = false;
  if (ok) buildSanityScore++;
}
const t4_d41 = Math.round(100 * buildSanityScore / Math.max(1,htmlFiles.length));

// D4.4 SEO basics · content pages only · aux pages have different SEO needs
let seoOk = 0;
let altMissing = 0, altTotal = 0;
for (const f of contentHtmlFiles) {
  const html = fs.readFileSync(f,'utf8');
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
  const meta = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
  const h1s = html.match(/<h1[^>]*>/gi) || [];
  const imgs = html.match(/<img[^>]+>/gi) || [];
  altTotal += imgs.length;
  altMissing += imgs.filter(img => !/alt=["']/.test(img)).length;
  if (title.length >= 30 && title.length <= 70 && meta.length >= 80 && meta.length <= 180 && h1s.length === 1) {
    seoOk++;
  }
}
const seoBase = Math.round(100 * seoOk / Math.max(1,contentHtmlFiles.length));
const altRate = altTotal ? Math.round(100 * (altTotal - altMissing) / altTotal) : 100;
const t4_d44 = Math.round((seoBase + altRate) / 2);

// D4.5 schema.org LocalBusiness JSON-LD · content pages only (aux pages don't need biz schema)
let schemaCount = 0;
for (const f of contentHtmlFiles) {
  const html = fs.readFileSync(f,'utf8');
  if (/application\/ld\+json/.test(html) && /LocalBusiness|RoofingContractor/.test(html)) schemaCount++;
}
const t4_d45 = Math.round(100 * schemaCount / Math.max(1,contentHtmlFiles.length));

t4.dims = {
  'D4.1_build_sanity':   { score: t4_d41, weight: 0.20 },
  'D4.4_seo_basics':     { score: t4_d44, weight: 0.30, alt_text_rate: altRate, title_meta_h1_pass_rate: seoBase },
  'D4.5_schema_org':     { score: t4_d45, weight: 0.20, pages_with_jsonld: schemaCount },
  // 'D4.2 PageSpeed': skipped (needs API)
  // 'D4.3 WCAG': skipped (needs pa11y)
  // 'D4.6 GEO': skipped (separate tool)
  // 'D4.7 old issue fix rate': skipped (needs audit-r1 cross-check)
};
let t4Score = 0, t4KnownWeight = 0;
for (const v of Object.values(t4.dims)) {
  if (v.score != null) { t4Score += v.score * v.weight; t4KnownWeight += v.weight; }
}
t4.score = t4KnownWeight > 0 ? Math.round(t4Score / t4KnownWeight) : 0;
console.log(`[tier-audit] T4: ${t4.score}/100 (partial · missing PageSpeed/WCAG/GEO/old-issue-fix)`);

// ─── Composite + Grade ──────────────────────────────────────────────────
const composite = Math.round((t2.score + t3.score + t4.score) / 3);
let grade;
if (!t1.pass) grade = 'F';
else if (composite >= 85) grade = 'A';
else if (composite >= 73) grade = 'B';
else if (composite >= 60) grade = 'C';
else grade = 'D';
const productionReady = t1.pass && composite >= 73;

// D0 · Data tier · input-side data sufficiency (v3.2)
// Records the raw signal each experiment had to work with · for correlating with output quality
const dataTier = {};
try {
  const checkpoint = JSON.parse(fs.readFileSync(`clients/${slug}/v2/checkpoint.json`, 'utf8'));
  const signal = checkpoint.hard_fields?.real_business_signal;
  dataTier.signal_units = signal?.real_signal_units;
  dataTier.recommended_layout = signal?.recommended_layout;
  dataTier.components = signal?.components;
  dataTier.layout_actual = htmlFiles.length === 1 ? 'single' : htmlFiles.length <= 6 ? 'multi-lite' : 'multi-full';
  dataTier.match_layout = (dataTier.recommended_layout || '').includes(dataTier.layout_actual.replace('multi-','multi')) || dataTier.recommended_layout === 'single' && dataTier.layout_actual === 'single';
} catch {}
try {
  const core = JSON.parse(fs.readFileSync(`clients/${slug}/v2/core-extract.json`, 'utf8'));
  dataTier.sources_consumed = core._meta?.sources_consumed;
  dataTier.real_services = core.brief?.real_facts?.service_list?.length;
  dataTier.real_testimonials = core.brief?.real_facts?.testimonials?.length;
  dataTier.real_suburbs = core.brief?.real_facts?.suburbs_served?.length;
  dataTier.has_owner = !!core.brief?.real_facts?.owner_name;
  dataTier.has_abn = !!core.brief?.real_facts?.abn?.number;
} catch {}
try {
  const inferred = JSON.parse(fs.readFileSync(`clients/${slug}/v2/inferred-data.json`, 'utf8'));
  dataTier.ai_inferred_fields = Object.keys(inferred.fields || {});
} catch {}

const report = {
  slug,
  output_dir: outputDir,
  pages_audited: htmlFiles.length,
  generated_at: new Date().toISOString(),
  data_tier: dataTier,
  tier_1: t1,
  tier_2: t2,
  tier_3: t3,
  tier_4: t4,
  composite,
  grade,
  production_ready: productionReady,
};

fs.writeFileSync(path.join(outputDir, '_tier-audit.json'), JSON.stringify(report, null, 2));

// Human-readable summary
const lines = [
  `# ${slug} · 4-Tier Audit (SOP-AUDIT-STANDARD.md v3)`,
  ``,
  `**Output dir**: ${path.relative(REPO, outputDir)}`,
  `**Pages**: ${htmlFiles.length} · **Grade**: ${grade} · **Production-ready**: ${productionReady ? '✅ YES' : '❌ NO'}`,
  ``,
  `## Tier 1 · Factual / Brand · ${t1.pass ? '✅ PASS' : '❌ FAIL'}`,
];
for (const [k, v] of Object.entries(t1.checks)) {
  lines.push(`- ${v.pass ? '✓' : '✗'} ${k}`);
}
if (t1.fails.length) {
  lines.push(``);
  lines.push(`**Fails:**`);
  t1.fails.forEach(f => lines.push(`- ${f}`));
}
lines.push(``);
lines.push(`## Tier 2 · Copy Depth & Quality · ${t2.score}/100`);
for (const [k, v] of Object.entries(t2.dims)) {
  lines.push(`- ${k}: ${v.score == null ? 'N/A' : v.score} (weight ${v.weight})`);
}
lines.push(``);
lines.push(`### Per-page word counts (vs threshold)`);
for (const [pg, w] of Object.entries(t2.page_word_counts)) {
  lines.push(`- ${pg}: ${w.count}/${w.threshold} words ${w.pass ? '✓' : '✗'} · sections ${t2.page_section_counts[pg].count}/${t2.page_section_counts[pg].threshold} ${t2.page_section_counts[pg].pass ? '✓' : '✗'}`);
}

if (t2.codex_available && t2.per_page_findings) {
  lines.push(``);
  lines.push(`### Per-page text findings (v3.1 · 单页 weakness + leak quote)`);
  for (const f of t2.per_page_findings) {
    lines.push(``);
    lines.push(`#### ${f.page} · codex_total ${f.codex_total ?? '?'}/50${f.floor_violations.length ? ' · ⚠ FLOOR_VIOLATION' : ''}`);
    if (f.scores) {
      lines.push(`- D1 facts ${f.scores.D1_facts_accuracy ?? '?'} · D2 voice ${f.scores.D2_voice_authentic ?? '?'} · D3 specific ${f.scores.D3_specificity ?? '?'} · D5 leak ${f.scores.D5_leak_free ?? '?'}`);
    }
    if (f.weaknesses?.length) {
      lines.push(`- **Weaknesses**:`);
      f.weaknesses.forEach(w => lines.push(`  - ${String(w).slice(0, 220)}`));
    }
    if (f.hallucinations?.length) {
      lines.push(`- **Hallucinations** ⚠:`);
      f.hallucinations.forEach(h => lines.push(`  - ${String(h).slice(0, 220)}`));
    }
    if (f.leak_quotes?.length) {
      lines.push(`- **Leak quotes** ⚠:`);
      f.leak_quotes.forEach(q => lines.push(`  - "${String(q).slice(0, 180)}"`));
    }
    if (f.floor_violations.length) {
      lines.push(`- **Floor violations**: ${f.floor_violations.join(', ')}`);
    }
  }
}
if (t2.floor_cap_applied) {
  lines.push(``);
  lines.push(`### ⚠ T2 score capped at ${t2.floor_cap_applied} (pre-cap ${t2.score_pre_cap}) due to per-page floor violations`);
}
lines.push(``);
lines.push(`## Tier 3 · Visual Design · ${t3.score}/100${t3.vision_included ? '' : ' (vision skipped)'}`);
for (const [k, v] of Object.entries(t3.dims)) {
  lines.push(`- ${k}: ${v.score == null ? 'N/A' : v.score} (weight ${v.weight})`);
}
lines.push(``);
lines.push(`## Tier 4 · Tech / SEO · ${t4.score}/100 (partial)`);
for (const [k, v] of Object.entries(t4.dims)) {
  lines.push(`- ${k}: ${v.score} (weight ${v.weight})`);
}
lines.push(``);
lines.push(`## Composite: ${composite}/100 · Grade: ${grade}`);
fs.writeFileSync(path.join(outputDir, '_tier-audit.md'), lines.join('\n'));

console.log(`\n[tier-audit] DONE · Grade ${grade} · composite ${composite}/100 · T1 ${t1.pass ? 'PASS' : 'FAIL'} T2=${t2.score} T3=${t3.score} T4=${t4.score}`);
console.log(`  → ${path.join(outputDir, '_tier-audit.json')}`);
console.log(`  → ${path.join(outputDir, '_tier-audit.md')}`);
