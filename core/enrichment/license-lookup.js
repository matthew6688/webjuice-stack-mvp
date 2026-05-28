/**
 * core/enrichment/license-lookup.js
 *
 * Pure function: look up a license for an entity from the local SQLite index.
 * Extracted from scripts/cli/pl-license-lookup.js — no CLI boilerplate.
 *
 * Usage:
 *   import { lookupLicense } from '../../core/enrichment/license-lookup.js';
 *   const result = await lookupLicense(entity, { repoRoot: process.cwd() });
 *
 * Returns:
 *   - match object  → { state, authority, licence_number, …, lookup_tier, candidate_count, _candidates_top5 }
 *   - not found     → { status: 'not_found', looked_up_at: <iso> }
 *   - DB missing    → null (silently, no throw)
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Derive candidate names / ABN / state from entity object ────────────────

function deriveFromEntity(entity) {
  const names = [];
  if (entity.latest?.business_name) names.push(entity.latest.business_name);
  if (entity.latest?.name) names.push(entity.latest.name);
  if (entity.enrichment?.abn?.entity_name) names.push(entity.enrichment.abn.entity_name);
  if (Array.isArray(entity.enrichment?.abn?.trading_names)) names.push(...entity.enrichment.abn.trading_names);

  const candidateNames = [...new Set(names.map(n => String(n).trim()).filter(Boolean))];
  const businessName = candidateNames[0] || null;
  const abn = cleanAbn(entity.enrichment?.abn?.abn || entity.latest?.abn);
  const state = entity.latest?.state
    || (entity.latest?.address?.match(/\b(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/i)?.[0]?.toUpperCase())
    || null;

  return { candidateNames, businessName, abn, state };
}

// ─── Main export ─────────────────────────────────────────────────────────────

const COMMON_SUFFIXES = ['roofing', 'plumbing', 'electrical', 'building', 'services', 'group', 'co', 'company', 'pty', 'ltd', 'limited', 'inc', 'corp'];

export async function lookupLicense(entity, { repoRoot } = {}) {
  const root = repoRoot || process.cwd();
  const dbPath = path.join(root, 'data/licenses/_index.sqlite');

  if (!fs.existsSync(dbPath)) return null;

  const { candidateNames, businessName, abn, state } = deriveFromEntity(entity);

  if (!businessName && !abn) return null;

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const result = { hit_tier: null, candidates: [], best: null };

  try {
    // Tier A · exact ABN
    if (abn) {
      const rows = db.prepare(`SELECT * FROM licenses WHERE abn = ? ORDER BY licence_number`).all(abn);
      if (rows.length) {
        result.hit_tier = 'abn_exact';
        result.candidates = rows;
        result.best = rows[0];
      }
    }

    // Tier B · exact licence number (not applicable from entity — no licenceNum input)

    // Tier C · normalized name exact across all candidate names
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

    // Tier C2 · Token-prefix in same state
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
        const stateRows = rows.filter(r => r.state === state.toUpperCase());
        if (stateRows.length === 1) {
          result.hit_tier = `token_prefix_state(token="${firstToken}" via "${name}")`;
          result.candidates = stateRows;
          result.best = stateRows[0];
          break;
        } else if (stateRows.length > 1) {
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

    // Tier D · FTS5 fuzzy
    if (!result.best && businessName) {
      const q = businessName.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3).map(w => `"${w}"*`).join(' AND ');
      if (q) {
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
            CASE WHEN licence_class IN (${(nicheClass || ['']).map(() => '?').join(',')}) THEN 0 ELSE 1 END AS niche_priority
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
          }
        } catch {
          // FTS syntax error · fall through
        }
      }
    }

  } finally {
    db.close();
  }

  if (!result.best) {
    return { status: 'not_found', looked_up_at: new Date().toISOString() };
  }

  const license = toLicense(result.best);
  license.lookup_tier = result.hit_tier;
  license.candidate_count = result.candidates.length;
  license._candidates_top5 = result.candidates.slice(0, 5).map(toLicense);
  return license;
}
