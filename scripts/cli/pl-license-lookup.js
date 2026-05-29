#!/usr/bin/env node
/**
 * pl:license-lookup · Query the local SQLite license index.
 *
 * Lookup priority:
 *   1. Exact ABN match (cheap · highest confidence)
 *   2. Exact licence_number match (if given)
 *   3. Normalized-name exact match (strips Pty Ltd, &, punct)
 *   4. FTS5 fuzzy company-name match (top 5 ranked)
 *   5. Returns null + status: 'not_found'
 *
 * Usage:
 *   npm run pl:license-lookup -- --slug a-j-roofing-solutions
 *   npm run pl:license-lookup -- --name "Vicwest Roofing" --state VIC
 *   npm run pl:license-lookup -- --abn "34134811831"
 *
 * Output: prints best-match JSON · also writes to entity.license if --slug given.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const REPO = process.cwd();
const LIC_DIR = path.join(REPO, 'data/licenses');
const DB_PATH = path.join(LIC_DIR, '_index.sqlite');
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i] ?? true;
}

if (!fs.existsSync(DB_PATH)) {
  console.error('License index not built. Run: npm run pl:license-build-index');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\bpty\s*\.?\s*ltd\.?\b/g, '')
    .replace(/\bptyltd\b/g, '')
    .replace(/\b(limited|inc|corp|company|co)\.?\b/g, '')
    .replace(/[&]/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAbn(s) { return String(s || '').replace(/\D/g, ''); }

// ─── Resolve input ──────────────────────────────────────────────────────
let businessName = args.name;
let abn = cleanAbn(args.abn);
let state = args.state;
let licenceNum = args['licence-number'];
let entity = null;

function loadEntity(entityKey) {
  const f = path.join(ENTITIES_DIR, `${entityKey}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// Collect ALL candidate names for this entity:
// - GBP/trading display name (Vicwest Roofing)
// - ABR registered entity_name (VICWEST GROUP PTY LTD · ABR record)
// - ABR trading_names[] array (entity-registered DBAs)
// VBA / QBCC / Fair Trading may license under ANY of these.
function deriveFromEntity(e) {
  if (!e) return;
  const names = [];
  if (e.latest?.business_name) names.push(e.latest.business_name);
  if (e.latest?.name) names.push(e.latest.name);
  if (e.enrichment?.abn?.entity_name) names.push(e.enrichment.abn.entity_name);
  if (Array.isArray(e.enrichment?.abn?.trading_names)) names.push(...e.enrichment.abn.trading_names);
  // Dedupe · trim
  candidateNames = [...new Set(names.map(n => String(n).trim()).filter(Boolean))];
  businessName = businessName || candidateNames[0];
  abn = abn || cleanAbn(e.enrichment?.abn?.abn || e.latest?.abn);
  state = state || e.latest?.state || (e.latest?.address?.match(/\b(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/i)?.[0]?.toUpperCase());
}

let candidateNames = [];

if (args['entity-key']) {
  entity = loadEntity(args['entity-key']);
  if (!entity) { console.error(`entity not found: ${args['entity-key']}`); process.exit(2); }
  deriveFromEntity(entity);
}

if (args.slug && !entity) {
  // slug → clients/<slug>/v2/master.md frontmatter → business_id → entity
  const mdPath = path.join(REPO, 'clients', args.slug, 'v2', 'master.md');
  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8');
    const m = md.match(/business_id:\s*"([^"]+)"/);
    if (m) {
      entity = loadEntity(m[1]);
      if (entity) deriveFromEntity(entity);
    }
  }
  // Fallback: scan all entities for promotedClientSlug
  if (!entity) {
    for (const f of fs.readdirSync(ENTITIES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
        if (e.promotedClientSlug === args.slug || e.slug === args.slug) {
          entity = e; deriveFromEntity(e); break;
        }
      } catch {}
    }
  }
  if (!entity) { console.error(`entity not found for slug ${args.slug} (checked clients/<slug>/v2/master.md + entity scan)`); process.exit(2); }
}

if (!businessName && !abn && !licenceNum) {
  console.error('Need at least one of: --slug · --name · --abn · --licence-number');
  process.exit(2);
}

// ─── Lookup ladder ──────────────────────────────────────────────────────
const result = { input: { businessName, abn, state, licenceNum }, hit_tier: null, candidates: [], best: null };

// Tier A · exact ABN
if (abn) {
  const rows = db.prepare(`SELECT * FROM licenses WHERE abn = ? ORDER BY licence_number`).all(abn);
  if (rows.length) {
    result.hit_tier = 'abn_exact';
    result.candidates = rows;
    result.best = rows[0];
  }
}

// Tier B · exact licence number
if (!result.best && licenceNum) {
  const rows = db.prepare(`SELECT * FROM licenses WHERE licence_number = ? ORDER BY id`).all(licenceNum);
  if (rows.length) {
    result.hit_tier = 'licence_number_exact';
    result.candidates = rows;
    result.best = rows[0];
  }
}

// Tier C · normalized name exact across ALL candidate names
// (trading display · ABR entity_name · ABR trading_names[])
const namesToTry = candidateNames.length ? candidateNames : (businessName ? [businessName] : []);
if (!result.best && namesToTry.length) {
  for (const name of namesToTry) {
    const norm = normalizeName(name);
    let rows = db.prepare(`SELECT * FROM licenses WHERE licensee_name_norm = ?`).all(norm);
    if (state) rows = rows.filter(r => r.state === state.toUpperCase());
    if (rows.length) {
      result.hit_tier = `name_exact_normalized(via "${name}")`;
      result.candidates = rows;
      result.best = rows[0];
      break;
    }
  }
}

// Tier C2 · Token-prefix in same state (catches sister-entity / parent-co cases).
// Real scenario: Customer trades as "Vicwest Roofing" (ABR entity = "Vicwest Group Pty Ltd"),
// but the LICENSED entity is "Vicwest Builders Pty Ltd" (a sister subsidiary).
// Token-prefix on first meaningful word + state filter catches this.
const COMMON_SUFFIXES = ['roofing', 'plumbing', 'electrical', 'building', 'services', 'group', 'co', 'company', 'pty', 'ltd', 'limited', 'inc', 'corp'];
if (!result.best && namesToTry.length && state) {
  for (const name of namesToTry) {
    const tokens = normalizeName(name).split(/\s+/).filter(t => t.length >= 4 && !COMMON_SUFFIXES.includes(t));
    if (!tokens.length) continue;
    const firstToken = tokens[0];
    const rows = db.prepare(`
      SELECT * FROM licenses
      WHERE state = ? AND licensee_name_norm LIKE ? || ' %' OR licensee_name_norm = ?
      LIMIT 20
    `).all(state.toUpperCase(), firstToken, firstToken);
    // Re-filter by state · since LIKE on state is sometimes ignored if SQLite path matters
    const stateRows = rows.filter(r => r.state === state.toUpperCase());
    if (stateRows.length === 1) {
      result.hit_tier = `token_prefix_state(token="${firstToken}" via "${name}")`;
      result.candidates = stateRows;
      result.best = stateRows[0];
      break;
    } else if (stateRows.length > 1) {
      // Many matches · prefer trade-relevant licence class for the niche
      const lowName = name.toLowerCase();
      const isRoofingLead = lowName.includes('roof');
      const ranked = stateRows.sort((a, b) => {
        const aRoof = /roof|builder|wall.cladding/i.test(a.licence_class || '');
        const bRoof = /roof|builder|wall.cladding/i.test(b.licence_class || '');
        if (isRoofingLead) return (bRoof ? 1 : 0) - (aRoof ? 1 : 0);
        return 0;
      });
      result.hit_tier = `token_prefix_state(token="${firstToken}" via "${name}" · ${stateRows.length} candidates)`;
      result.candidates = ranked.slice(0, 5);
      result.best = ranked[0];
      break;
    }
  }
}

// Tier D · FTS5 fuzzy with niche-class preference
if (!result.best && businessName) {
  const q = businessName.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3).map(w => `"${w}"*`).join(' AND ');
  if (q) {
    // Niche filter: if name contains "roofing" / etc · prefer matching licence_class
    const nicheHints = {
      roofing: ['Roofing', 'Roof and Wall Cladding', 'Roof Tiling', 'Metal Fascias and Gutters', 'Carpentry'],
      plumbing: ['Plumbing', 'Drainage', 'Gasfitting'],
      electrical: ['Electrical'],
      painting: ['Painting'],
      tiling: ['Tiling'],
    };
    const lowName = businessName.toLowerCase();
    let nicheClass = null;
    for (const [niche, classes] of Object.entries(nicheHints)) {
      if (lowName.includes(niche)) { nicheClass = classes; break; }
    }
    const sql = `
      SELECT licenses.*, licenses_fts.rank AS fts_rank,
        CASE WHEN licence_class IN (${(nicheClass||['']).map(() => '?').join(',')}) THEN 0 ELSE 1 END AS niche_priority
      FROM licenses_fts
      JOIN licenses ON licenses.id = licenses_fts.rowid
      WHERE licenses_fts MATCH ?
      ${state ? `AND licenses.state = ?` : ''}
      ORDER BY niche_priority ASC, fts_rank LIMIT 10
    `;
    try {
      const params = [...(nicheClass || ['']), q];
      if (state) params.push(state.toUpperCase());
      const rows = db.prepare(sql).all(...params);
      if (rows.length) {
        result.hit_tier = 'fts_fuzzy';
        result.candidates = rows.slice(0, 10);
        result.best = rows[0];
        if (nicheClass) result.niche_hint = nicheClass;
      }
    } catch (e) {
      // FTS syntax error · fall through
    }
  }
}

if (!result.best) {
  result.hit_tier = 'not_found';
}

// ─── Emit license record (compact) ──────────────────────────────────────
function toLicense(row) {
  if (!row) return { status: 'not_found' };
  return {
    state: row.state,
    authority: row.authority,
    licence_number: row.licence_number,
    licensee_name: row.licensee_name,
    abn: row.abn || null,
    acn: row.acn || null,
    address: row.address,
    licence_class: row.licence_class,
    licence_type: row.licence_type,
    licence_category: row.licence_category,
    status: row.status || 'active',
    source: `csv-${(row.authority || 'unknown').toLowerCase()}`,
    looked_up_at: new Date().toISOString(),
  };
}

const license = toLicense(result.best);
license.lookup_tier = result.hit_tier;
license.candidate_count = result.candidates.length;

// ─── codex R81: confidence gate ──────────────────────────────────────────
// Canonical entity.license may ONLY come from a STRONG identity anchor. Weak/fuzzy
// matches (token_prefix / fts) are discovery, not fact — they would pollute the fact
// chain (e.g. "Mark Squire" token-matched an unrelated "Mark Prain Builders" licence).
const tier = result.hit_tier || '';
const entAbn = cleanAbn(abn);
const matchAbn = cleanAbn(license.abn);
const abnConflict = entAbn && matchAbn && entAbn !== matchAbn;
const abnMatch = entAbn && matchAbn && entAbn === matchAbn;
let confidence;
if (/^(abn_exact|licence_number_exact)/.test(tier)) confidence = 'confirmed';        // self-anchored
else if (/^name_exact_normalized/.test(tier)) confidence = abnConflict ? 'unconfirmed' : 'confirmed';
else confidence = abnMatch ? 'confirmed' : 'unconfirmed';                              // token_prefix / fts_fuzzy → need ABN anchor
license.confidence = confidence;

// ─── If --slug, write back to entity.license (GATED) ─────────────────────
if (args.slug && entity) {
  const entityKey = entity.entityKey;
  const file = path.join(ENTITIES_DIR, `${entityKey}.json`);
  const top5 = result.candidates.slice(0, 5).map(toLicense);
  if (confidence === 'confirmed' && license.status !== 'not_found') {
    entity.license = license;
    entity.license._candidates_top5 = top5;
    fs.writeFileSync(file, JSON.stringify(entity, null, 2));
    console.log(`✓ Updated ${entityKey}.license (CONFIRMED · tier=${tier}) · ${license.authority} ${license.licence_number}`);
  } else {
    // low-confidence → NEVER write canonical number/status; park candidates for human review.
    entity.license = {
      status: 'unconfirmed', needs_manual_license_confirm: true,
      lookup_tier: tier, confidence,
      reason: abnConflict ? `ABN mismatch (entity ${entAbn} ≠ match ${matchAbn})` : (entAbn ? 'weak match · no ABN anchor' : 'weak match · entity has no ABN to anchor'),
      _candidates_top5: top5,
    };
    fs.writeFileSync(file, JSON.stringify(entity, null, 2));
    console.log(`⚠️  ${entityKey}: LOW-CONFIDENCE (tier=${tier}${abnConflict ? ' · ABN mismatch' : ''}) → NOT written as canonical · _candidates parked · needs_manual_license_confirm`);
  }
}

// ─── Console summary ────────────────────────────────────────────────────
console.log('\n┌─ License lookup result ──────────────────────────');
console.log(`│ input:    name="${businessName || ''}" abn="${abn || ''}" state=${state || ''} num=${licenceNum || ''}`);
console.log(`│ tier hit: ${result.hit_tier}`);
console.log(`│ candidates: ${result.candidates.length}`);
if (license.status !== 'not_found') {
  console.log(`├─ Best match`);
  console.log(`│   authority:    ${license.authority}`);
  console.log(`│   licence_num:  ${license.licence_number}`);
  console.log(`│   licensee:     ${license.licensee_name}`);
  console.log(`│   abn:          ${license.abn || '(none)'}`);
  console.log(`│   address:      ${license.address}`);
  console.log(`│   class:        ${license.licence_class}`);
  console.log(`│   category:     ${license.licence_category}`);
  console.log(`│   status:       ${license.status}`);
} else {
  console.log(`├─ no match · ${state || '(all states)'} register`);
}
console.log('└──────────────────────────────────────────────────\n');

// JSON dump (machine-readable)
if (args.json) console.log(JSON.stringify(license, null, 2));

db.close();
