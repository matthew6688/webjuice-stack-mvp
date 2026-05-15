#!/usr/bin/env node
/**
 * pl:merge-dup-entities · cycle-27 (Matthew 2026-05-15)
 *
 * Bug class: V3 Places API rescrape creates a place_id-keyed entity for a
 * business that already has a V2 domain-keyed entity. Two records · split
 * data: V2 owns project_thread + deploy URL · V3 has fresh grade + audit.
 * Profile card displays V2 (stale grade=null).
 *
 * Fix: scan all entities · find V2/V3 dup pairs (same `latest.name`) ·
 * merge V3's grade/audit/qualification INTO V2 (V2 stays canonical to
 * preserve thread + deploy links). Refresh project profile card.
 *
 * Usage: npm run pl:merge-dup-entities [-- --dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data/leads/entities');

if (!fs.existsSync(DIR)) {
  console.error(`entities dir missing: ${DIR}`);
  process.exit(1);
}

// Load all
const all = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; }
  return { file: f, key: f.replace('.json', ''), data: d };
}).filter(Boolean);

// Group by name
const byName = new Map();
for (const e of all) {
  const name = e.data.latest?.name?.trim();
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(e);
}

const pairs = [];
for (const [name, group] of byName.entries()) {
  if (group.length < 2) continue;
  const domain = group.find((e) => e.key.startsWith('domain_'));
  const place = group.find((e) => e.key.startsWith('place_'));
  if (!domain || !place) continue;
  pairs.push({ name, domain, place });
}

console.log(`Found ${pairs.length} V2/V3 duplicate pair(s)`);
let merged = 0;
for (const { name, domain, place } of pairs) {
  const v3HasAudit = !!(place.data.grade?.investment_level || place.data.qualification);
  const v2MissingGrade = !domain.data.grade?.investment_level;
  const alreadyMerged = !!domain.data.merged_from_v3_key;
  console.log(`  · "${name}"`);
  console.log(`      ${domain.key} · grade ${domain.data.grade?.investment_level || '—'} · thread ${domain.data.project_thread_id || '—'}`);
  console.log(`      ${place.key}  · grade ${place.data.grade?.investment_level || '—'} · qual ${place.data.qualification?.verdict || '—'}`);

  if (!v3HasAudit) { console.log('      skip · V3 has no audit'); continue; }
  if (alreadyMerged) { console.log('      skip · already merged'); continue; }
  // cycle-27 Rule 14: even if V2 has grade · mark dup as resolved (else
  // pl:goals-doctor keeps flagging). Set merged_from_v3_key marker only.
  if (!v2MissingGrade) {
    if (DRY_RUN) { console.log('      [dry-run] would mark V2 as merged (already-in-sync)'); merged++; continue; }
    domain.data.merged_from_v3_key = place.key;
    domain.data.merged_at = new Date().toISOString();
    fs.writeFileSync(path.join(DIR, domain.file), JSON.stringify(domain.data, null, 2) + '\n');
    merged++;
    console.log('      ✓ marked merged · V2 already had grade');
    continue;
  }

  if (DRY_RUN) { console.log('      [dry-run] would merge V3 → V2'); merged++; continue; }

  // Merge V3 → V2
  if (place.data.grade?.investment_level) domain.data.grade = place.data.grade;
  if (place.data.qualification) domain.data.qualification = place.data.qualification;
  if (place.data.cheap_audit) domain.data.cheap_audit = place.data.cheap_audit;
  if (place.data.exclusion_filter) domain.data.exclusion_filter = place.data.exclusion_filter;
  if (place.data.niche_relevance) domain.data.niche_relevance = place.data.niche_relevance;
  if (place.data.predict_grade) domain.data.predict_grade = place.data.predict_grade;
  domain.data.merged_from_v3_key = place.key;
  domain.data.merged_at = new Date().toISOString();
  fs.writeFileSync(path.join(DIR, domain.file), JSON.stringify(domain.data, null, 2) + '\n');
  merged++;
  console.log(`      ✓ merged · grade ${domain.data.grade?.investment_level}`);
}

console.log(`\n${DRY_RUN ? '[dry-run] would merge' : 'merged'} ${merged} pair(s)`);

// Refresh project profile cards for merged ones
if (!DRY_RUN && merged > 0) {
  console.log('\nrefreshing project profile cards...');
  const { upsertProjectProfileCard } = await import('../../core/funnel/lead-thread-sync.js');
  let refreshed = 0;
  for (const { domain } of pairs) {
    if (!domain.data.project_thread_id) continue;
    if (!domain.data.merged_from_v3_key) continue;
    try {
      const r = await upsertProjectProfileCard(domain.key);
      if (r.ok) { refreshed++; console.log(`  ✓ ${domain.key}`); }
      else console.log(`  ✗ ${domain.key} · ${r.reason}`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(`  ✗ ${domain.key} · threw: ${err.message}`);
    }
  }
  console.log(`refreshed ${refreshed} card(s)`);
}
