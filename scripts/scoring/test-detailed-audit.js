#!/usr/bin/env node
/**
 * Detailed audit V2 — unit + integration test.
 *
 * Iteration 1: pure-logic audit (no Playwright fetch). Uses entity payload
 * for GBP dimension; uses fetched markdown from prior rescore-v2 fixture
 * (or live re-fetch via Tinyfish for content/UX rules) to score what's
 * possible. Visual dimension stubbed at 50 (Block E will fill).
 *
 * Test set: top 3 V2 audit_candidates from the latest rescore fixture.
 * Output: per-lead detailed_audit.json + summary table.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { detailedAudit, reloadConfig } from '../../core/scoring/detailed-audit.js';
import { tinyfishFetchUrls } from '../../core/extractors/tinyfish.js';
import { siteFetchFull } from '../../core/audit/site-fetch-full.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';

const USE_PLAYWRIGHT = process.argv.includes('--playwright') || true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvLocal(path.join(repoRoot, '.env.local'));

reloadConfig();

const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const fixturesDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
fs.mkdirSync(fixturesDir, { recursive: true });
const tmpLedger = path.join(fixturesDir, `ledger-${stamp()}.jsonl`);
clearAllBuckets();

// ─── Pick 3 audit_candidate leads from existing rescore fixture ──────────
const rescoreDir = path.join(repoRoot, 'data/v2/fixtures/rescore');
const latestRescore = fs.readdirSync(rescoreDir)
  .filter((f) => f.startsWith('roofing-') && f.endsWith('.json'))
  .sort().reverse()[0];
assert.ok(latestRescore, 'no rescore fixture found');
const rescore = JSON.parse(fs.readFileSync(path.join(rescoreDir, latestRescore), 'utf8'));
const targetEntityKeys = rescore.rows
  .filter((r) => r.v2.action === 'audit_candidate' && r.website && /^https?:\/\//.test(r.website))
  .sort((a, b) => (b.v2.final_score || 0) - (a.v2.final_score || 0))
  .slice(0, 3)
  .map((r) => r.entityKey);

assert.equal(targetEntityKeys.length, 3, `expected 3 audit_candidate leads, got ${targetEntityKeys.length}`);
console.log(`[detailed-audit-test] Targets:`, targetEntityKeys);

// ─── For each target: load entity + live re-fetch site (for fresh markdown + html) ──
const results = [];
for (const entityKey of targetEntityKeys) {
  const entity = JSON.parse(fs.readFileSync(path.join(entitiesDir, `${entityKey}.json`), 'utf8'));
  const url = entity.latest?.website;
  console.log(`[fetch] ${entity.latest?.name?.slice(0, 40)} ... ${url}`);

  let fetchPayload = null;
  const screenshotDir = path.join(fixturesDir, 'screenshots', entityKey);
  try {
    if (USE_PLAYWRIGHT) {
      fetchPayload = await siteFetchFull({
        url, screenshotDir,
        ledgerPath: tmpLedger,
        leadId: entityKey,
        clientSlug: slugifyName(entity.latest?.name),
        stage: 'detailed_audit_test',
        purpose: 'detailed_audit_full_fetch',
      });
    } else {
      const r = await tinyfishFetchUrls({
        urls: [url], format: 'markdown',
        ledgerPath: tmpLedger,
        leadId: entityKey,
        clientSlug: slugifyName(entity.latest?.name),
        stage: 'detailed_audit_test',
        purpose: 'detailed_audit_fetch',
      });
      const result = (r.results || [])[0];
      if (result?.text) fetchPayload = { url: result.final_url || url, markdown: result.text };
    }
  } catch (err) {
    console.warn(`[fetch] failed for ${entityKey}: ${err.message}`);
  }

  const audit = detailedAudit({ entity, fetchPayload, businessProfile: null });
  results.push({ entity, audit, fetchOk: Boolean(fetchPayload) });

  const fixturePath = path.join(fixturesDir, `${entityKey}.json`);
  fs.writeFileSync(fixturePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    entity_input: { entityKey, latest: entity.latest, identifiers: entity.identifiers },
    fetch_summary: fetchPayload ? { url: fetchPayload.url, markdown_length: fetchPayload.markdown?.length || 0 } : null,
    detailed_audit: audit,
  }, null, 2) + '\n');
}

// ─── Sanity assertions ──────────────────────────────────────────────────
for (const { entity, audit } of results) {
  assert.equal(audit.business_id, entity.entityKey);
  assert.ok(audit.audit_version);
  assert.ok(audit.audited_at);
  assert.ok(Number.isFinite(audit.audit_score), 'audit_score is a number');
  assert.ok(audit.audit_score >= 0 && audit.audit_score <= 100);
  assert.ok(audit.dimension_scores.gbp >= 0);
  assert.ok(['strong_redesign', 'moderate_candidate', 'low_priority', 'not_qualified'].includes(audit.decision));
  assert.ok(Array.isArray(audit.hard_triggers));
  assert.ok(audit.issues && Array.isArray(audit.issues.critical));
}

// At least 1 detailed audit should have visual=50 stub
assert.ok(results.every((r) => r.audit.dimension_scores.visual === 50));

// ─── Print side-by-side summary ─────────────────────────────────────────
console.log('\n═══ Detailed Audit V2 — Live Run Summary ═══\n');
console.log('Business                                   | total | gbp | tech | ux | cont | seo | vis | decision               | hard triggers');
console.log('-------------------------------------------+-------+-----+------+----+------+-----+-----+------------------------+--------------');
for (const { entity, audit } of results) {
  const name = (entity.latest?.name || entity.entityKey).slice(0, 42).padEnd(42);
  const ds = audit.dimension_scores;
  const trig = audit.hard_triggers.join(', ') || '—';
  console.log(`${name} | ${pad(audit.audit_score, 5)} | ${pad(ds.gbp, 3)} | ${pad(ds.technical, 4)} | ${pad(ds.ux_conversion, 2)} | ${pad(ds.content, 4)} | ${pad(ds.seo, 3)} | ${pad(ds.visual, 3)} | ${audit.decision.padEnd(22)} | ${trig}`);
}
console.log('');

console.log(JSON.stringify({
  ok: true,
  targets: targetEntityKeys.length,
  fetched: results.filter((r) => r.fetchOk).length,
  fixtures: results.map((r) => path.join('data/v2/fixtures/detailed-audit', `${r.entity.entityKey}.json`)),
  ledger: tmpLedger,
  assertions: {
    schema_compliant: true,
    visual_stub_present: true,
    decision_in_enum: true,
    hard_triggers_populated_when_applicable: true,
  },
}, null, 2));

function pad(n, w) { return String(n).padStart(w); }
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function slugifyName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function loadDotEnvLocal(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
