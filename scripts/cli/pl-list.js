#!/usr/bin/env node
/**
 * pl:list — List entities filtered by grade / phase. JSON output.
 *
 * Usage:
 *   npm run pl:list -- --grade A
 *   npm run pl:list -- --phase outreach-active
 *   npm run pl:list -- --grade A --phase awaiting
 *   npm run pl:list -- --json-compact            # one entity per line
 */

import { listEntities, parseArgs, emit } from './_pl-shared.js';

const args = parseArgs(process.argv.slice(2));

const entities = listEntities();

const filtered = entities.filter((e) => {
  if (args.grade && e.grade?.investment_level !== args.grade) return false;
  if (args.phase && e.phase !== args.phase) return false;
  return true;
});

const rows = filtered.map((e) => ({
  entityKey: e.entityKey,
  name: e.latest?.name || null,
  niche: e.latest?.niche || null,
  city: e.latest?.city || null,
  grade: e.grade?.investment_level || null,
  tier: e.grade?.product_tier || null,
  phase: e.phase || null,
  sub_status: e.sub_status || null,
  status: e.status || null,
  rating: e.latest?.rating ?? null,
  reviews: e.latest?.review_count ?? null,
  audit_score: null,                 // filled by pl:show; omitted here for speed
  graded_at: e.grade?.graded_at || null,
  discord_thread_id: e.discord_thread_id || null,
}));

rows.sort((a, b) => {
  const ga = a.grade || 'Z';
  const gb = b.grade || 'Z';
  if (ga !== gb) return ga.localeCompare(gb);
  return String(b.graded_at || '').localeCompare(String(a.graded_at || ''));
});

if (args['json-compact']) {
  for (const r of rows) console.log(JSON.stringify(r));
  process.exit(0);
}

emit({
  ok: true,
  count: rows.length,
  filter: { grade: args.grade || null, phase: args.phase || null },
  rows,
});
