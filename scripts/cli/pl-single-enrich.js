#!/usr/bin/env node
/**
 * pl:single-enrich · SOP-0 v1.3 (Q5)
 *
 * One-shot business resolver. Takes partial signals (CLI args), resolves to
 * a single Google Places lead, writes/merges entity into store, and
 * auto-chains a follow-up `audit` task so dispatcher continues the flow.
 *
 * Usage:
 *   npm run pl:single-enrich -- \
 *     --business-name "Joe's Plumbing" \
 *     --phone "0412345678" \
 *     --city melbourne \
 *     --niche plumber
 *
 *   npm run pl:single-enrich -- --gbp-url "https://maps.google.com/?cid=..."
 *
 * Optional:
 *   --website / --email / --niche / --city / --gbp-url
 *   --dry-run      print plan, no Places call, no entity write, no chain
 *   --no-chain     write entity but skip auto-audit
 *
 * Cost: ~$0.017 per call (Places textSearch + details). Quota-guarded.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, die, emit } from './_pl-shared.js';
import { resolveBusinessFromSignals } from '../../core/leads/single-enrich-resolver.js';
import { upsertDiscoveryRun, defaultDiscoveryStoreRoot, discoveryEntityKey } from '../../core/leads/discovery-store.js';
import { createTask } from '../../core/tasks/task-store.js';

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = !!args['dry-run'];
const NO_CHAIN = !!args['no-chain'];

const signals = {
  // V3 bug fix #3 (2026-05-13): accept --name as alias for --business-name.
  // Without it, --name landed at args.name unused; signals.businessName=null;
  // resolver fell back to bare city ("Brisbane") which matched Brisbane the
  // city — not the business. Created a junk `place_chijm9k...` entity.
  businessName: args['business-name'] || args.businessName || args.name || null,
  phone:        args.phone || null,
  email:        args.email || null,
  website:      args.website || null,
  niche:        args.niche || null,
  city:         args.city || null,
  gbpUrl:       args['gbp-url'] || args.gbpUrl || null,
};

if (!signals.businessName && !signals.phone && !signals.website && !signals.gbpUrl) {
  die('Need at least one of --business-name (or --name) / --phone / --website / --gbp-url');
}

const t0 = Date.now();
console.log(`[pl:single-enrich] signals: ${JSON.stringify(signals)}`);

if (DRY_RUN) {
  console.log('[dry-run] would resolve + write entity + chain audit (skipped)');
  emit({ ok: true, dry_run: true, signals });
  process.exit(0);
}

const ledgerPath = path.join(process.cwd(), 'data/finance/ledger.jsonl');

const result = await resolveBusinessFromSignals(signals, {
  ledgerPath,
  onProgress: (step, detail) => console.log(`  · ${step}${detail ? ' · ' + detail : ''}`),
});

if (!result.ok) {
  console.error(`[pl:single-enrich] ✗ ${result.reason}`);
  emit({ ok: false, reason: result.reason, signals, duration_ms: Date.now() - t0 });
  process.exit(2);
}

console.log(`[pl:single-enrich] ✓ Places resolved · place_id=${result.place_id} · "${result.lead.name}"`);

// Build a run + upsert (this triggers SOP-0 P5 push enrich-task if entity is thin)
const storeRoot = defaultDiscoveryStoreRoot();
const run = {
  runId:   'single-enrich-' + Date.now(),
  query:   result.lead.sourceQuery,
  niche:   result.lead.niche,
  city:    result.lead.city,
  leads:   [result.lead],
  totals:  { rawRows: 1 },
  costPolicy: { tier: 'T2', estimate_usd: result.cost_estimate },
};

upsertDiscoveryRun(run, { storeRoot });
const entityKey = discoveryEntityKey(result.lead);
console.log(`[pl:single-enrich] entity: ${entityKey}`);

// Auto-chain audit task unless --no-chain
let chainedTask = null;
if (!NO_CHAIN) {
  try {
    chainedTask = createTask({
      kind: 'audit',
      source: {
        platform:  'internal',
        thread_id: null,
        author:    'pl:single-enrich auto-chain',
        message_id: null,
      },
      input: {
        text: `auto: audit ${entityKey} from single-enrich resolve`,
        attachments: [],
      },
      target: {
        cli:               'leads:run-pipeline',
        args:              ['--entity-key', entityKey],
        target_entity_key: entityKey,
        timeout_ms:        600_000,
      },
    });
    console.log(`[pl:single-enrich] ✓ chained audit task: ${chainedTask.task_id}`);
  } catch (err) {
    console.error(`[pl:single-enrich] chain audit failed: ${err.message}`);
  }
}

emit({
  ok: true,
  place_id:        result.place_id,
  entity_key:      entityKey,
  name:            result.lead.name,
  phone:           result.lead.phone,
  website:         result.lead.website,
  address:         result.lead.address,
  niche:           result.lead.niche,
  city:            result.lead.city,
  audit_chained:   chainedTask?.task_id || null,
  duration_ms:     Date.now() - t0,
  cost_estimate:   result.cost_estimate,
});
