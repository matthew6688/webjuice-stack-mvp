/**
 * Smoke test · enrichment 5 entities · 检 4 路 API
 *
 * 不是 TDD 单测 · 是 live integration probe · 看真实成功率。
 * Gate 标准 (per V3-ENRICHMENT-PLAN):
 *   - ABR ≥ 60% · WHOIS ≥ 90% · Wayback ≥ 70% · Tinyfish ≥ 85%
 */
import fs from 'node:fs';
import { enrichEntity } from '../../core/enrichment/index.js';

const ENTITIES = [
  'place_chij6wsd-kzbkwsryzke1ejotjs',    // VIP Roofing Brisbane · has website (parked)
  'place_chijkrzfmm9p0worrpl40dpbb7c',    // Vicwest Roofing · has website
  'dataid_0x697863f568797107-0x3e88d70ce813a66e', // A & J Roofing · has website
  'place_chijp1qgmucnckorx1asaw7gks4',    // Total Roof & Gutter · NO website (STARTER)
  'domain_aceroofingservice.com.au',       // Ace Roofing · has website
];

const tally = {
  whois: { attempts: 0, success: 0 },
  wayback: { attempts: 0, success: 0 },
  abn: { attempts: 0, success: 0, skipped: 0 },
  tinyfish_search: { attempts: 0, success: 0 },
  tinyfish_homepage: { attempts: 0, success: 0, skipped: 0 },
};

const HAS_ABR_GUID = !!process.env.ABR_GUID;
console.log(`ABR_GUID: ${HAS_ABR_GUID ? 'present' : 'MISSING · ABN lookups will skip'}`);
console.log(`Testing ${ENTITIES.length} entities...\n`);

for (const key of ENTITIES) {
  const path = `/Users/matthew/Developer/google-map-website-v3/data/leads/entities/${key}.json`;
  if (!fs.existsSync(path)) { console.log(`  ✗ ${key} not found`); continue; }
  const entity = JSON.parse(fs.readFileSync(path, 'utf8'));
  const name = entity.latest?.name || key;
  const website = entity.latest?.website || '(none)';

  console.log(`══════════════════════════════════════`);
  console.log(`${name}`);
  console.log(`  website: ${website}`);

  const start = Date.now();
  const enriched = await enrichEntity(entity);
  const dur = Date.now() - start;

  const enr = enriched.enrichment;
  const trace = enr._meta.trace;
  console.log(`  total ${dur}ms · ${enr._meta.sources_succeeded} ok / ${trace.length} attempts`);

  for (const t of trace) {
    const status = t.skipped ? '⊘ skip' : t.ok ? `✓ ok ${t.latency_ms}ms` : `✗ fail ${t.reason || ''}`;
    console.log(`    ${t.source.padEnd(18)} ${status}`);

    if (tally[t.source]) {
      if (t.skipped) tally[t.source].skipped = (tally[t.source].skipped || 0) + 1;
      else {
        tally[t.source].attempts++;
        if (t.ok) tally[t.source].success++;
      }
    }
  }

  // Show sample of returned data
  if (enr.whois) console.log(`    └─ whois: registered ${enr.whois.registered_at} · age ${enr.whois.domain_age_years}y · ${enr.whois.registrar || '?'}`);
  if (enr.wayback) console.log(`    └─ wayback: first ${enr.wayback.first_snapshot_date}`);
  if (enr.abn) console.log(`    └─ abn: ${enr.abn.abn_formatted} · ${enr.abn.abn_status} · ${enr.abn.entity_type_name}`);
  if (enr.tinyfish_search) console.log(`    └─ tinyfish_search: ${enr.tinyfish_search.results_au_filtered}/${enr.tinyfish_search.results_total} AU filtered`);
  if (enr.tinyfish_homepage) console.log(`    └─ tinyfish_homepage: ${enr.tinyfish_homepage.markdown_bytes} bytes · signals: ${JSON.stringify(enr.tinyfish_homepage.extracted_signals?.service_keywords_found?.slice(0,3))}`);
}

console.log('\n══════════════════════════════════════');
console.log('SUMMARY · success rate per source');
console.log('══════════════════════════════════════');
for (const [src, t] of Object.entries(tally)) {
  const rate = t.attempts ? Math.round(100 * t.success / t.attempts) : 0;
  const gate = { whois: 90, wayback: 70, abn: 60, tinyfish_search: 85, tinyfish_homepage: 85 }[src];
  const pass = rate >= gate ? '✓' : '⚠';
  console.log(`  ${src.padEnd(18)} ${t.success}/${t.attempts} = ${rate}% (gate ${gate}%) ${pass} ${t.skipped ? `· skip ${t.skipped}` : ''}`);
}
