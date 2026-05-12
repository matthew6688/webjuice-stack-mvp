#!/usr/bin/env node
/**
 * pl:run-enrichment-batch — process entities with enrichment_status === 'pending'
 * through enrichLead() in serial, merge contact_identity into entity.latest, flip
 * enrichment_status, and write fixture files.
 *
 * SOP-1 Phase B (C5-Phase-B · 2026-05-12).
 *
 * Usage:
 *   npm run pl:run-enrichment-batch -- [--limit N] [--niche X] [--dry-run] [--skip-approval]
 *
 * Flags:
 *   --limit N          process at most N pending entities (default: 10)
 *   --niche X          only process entities with latest.niche === X
 *   --dry-run          print plan, do not call enrichLead or write
 *   --skip-approval    bypass enrichment-gate approval check (use only for batch testing)
 *
 * Schema decisions:
 *   - latest.contact_identity shape: see SOP_HANDOFF_CONTRACT.md §2.3.1
 *   - enrichment_status decision logic: see SOP_HANDOFF_CONTRACT.md §2.3.2
 */

import fs from 'node:fs';
import path from 'node:path';
import { enrichLead } from '../../core/leads/enrichment.js';
import { getEnrichmentGate } from '../../core/leads/enrichment-gate.js';
import { clearAllBuckets } from '../../core/util/token-bucket.js';
import { pushAlert } from '../../core/ops/alert-pusher.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const LIMIT = parseInt(args.limit, 10) || 10;
const NICHE = args.niche || null;
const DRY_RUN = !!args['dry-run'];
const SKIP_APPROVAL = !!args['skip-approval'];

const REPO_ROOT = path.resolve(process.cwd());
const ENTITIES_DIR = path.join(REPO_ROOT, 'data/leads/entities');
const FIXTURES_DIR = path.join(REPO_ROOT, 'data/v2/fixtures/enrichment');
const LEDGER_PATH = path.join(REPO_ROOT, 'data/finance/ledger.jsonl');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Decide new enrichment_status from enrichLead output.
 * Per SOP_HANDOFF_CONTRACT.md §2.3.2.
 */
function decideEnrichmentStatus(profile) {
  const contact = profile?.contact || {};
  const hasContact = !!(contact.phone || contact.website);
  const hasSocial = Object.values(contact.social || {}).some((v) => !!v);
  const succeeded = profile?.enrichment_trace?.queries_succeeded || 0;
  if (hasContact || hasSocial) return 'complete';
  if (succeeded > 0) return 'partial';
  return 'unenrichable';
}

/**
 * Build the contact_identity sub-object that gets merged into entity.latest.
 * Per SOP_HANDOFF_CONTRACT.md §2.3.1.
 */
function buildContactIdentity(profile) {
  const contact = profile.contact || {};
  return {
    phone: contact.phone || '',
    website: contact.website || '',
    social: {
      facebook: contact.social?.facebook || '',
      instagram: contact.social?.instagram || '',
      linkedin: contact.social?.linkedin || '',
    },
    decision_maker: profile.decision_maker || null,
    third_party_reviews: profile.third_party_reviews || [],
    evidence_sources: profile.evidence_sources || [],
    enriched_at: profile.enriched_at || new Date().toISOString(),
  };
}

function slugifyName(name) {
  return String(name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Sleep helper (for serial inter-call rate limiting). */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n${YELLOW}pl:run-enrichment-batch${RESET}  ·  ${new Date().toISOString()}${DRY_RUN ? `  ${DIM}(dry-run)${RESET}` : ''}\n`);

  // Step 1-2: Scan + filter
  if (!fs.existsSync(ENTITIES_DIR)) {
    console.error('no entity store found');
    process.exit(1);
  }
  const allFiles = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json'));
  const pending = [];
  for (const f of allFiles) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
      if (e.enrichment_status !== 'pending') continue;
      if (e.status === 'merged') continue;
      if (NICHE && e.latest?.niche !== NICHE) continue;
      pending.push({ file: f, entity: e });
    } catch {}
    if (pending.length >= LIMIT) break;
  }

  console.log(`  ${DIM}Scanned ${allFiles.length} entities · ${pending.length} pending (limit ${LIMIT}${NICHE ? ', niche=' + NICHE : ''})${RESET}\n`);

  if (pending.length === 0) {
    console.log(`${GREEN}✓ No pending entities to enrich.${RESET}\n`);
    process.exit(0);
  }

  // Step 3: enrichment-gate check (per entity)
  const eligible = [];
  for (const item of pending) {
    if (SKIP_APPROVAL) {
      eligible.push(item);
      continue;
    }
    try {
      const gate = getEnrichmentGate(item.entity.entityKey, {});
      if (gate?.status === 'approved' || gate?.status === 'executed') {
        eligible.push(item);
      } else {
        console.log(`  ${YELLOW}⏸${RESET} ${item.entity.entityKey} skipped (gate status: ${gate?.status || 'unset'})`);
      }
    } catch (err) {
      console.log(`  ${YELLOW}⏸${RESET} ${item.entity.entityKey} skipped (gate check failed: ${err.message})`);
    }
  }

  console.log(`\n  ${DIM}${eligible.length}/${pending.length} eligible after gate check${SKIP_APPROVAL ? ' (--skip-approval)' : ''}${RESET}\n`);

  if (eligible.length === 0) {
    console.log(`${YELLOW}⚠ No entities passed gate. Use --skip-approval to bypass.${RESET}\n`);
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log(`${DIM}DRY RUN — would call enrichLead() on:${RESET}`);
    for (const item of eligible) {
      console.log(`  · ${item.entity.entityKey}  "${item.entity.latest?.name || ''}"  ${item.entity.latest?.niche || '-'}/${item.entity.latest?.city || '-'}`);
    }
    process.exit(0);
  }

  // Step 4-6: Serial loop · 500ms inter-call · enrichLead · merge · flip status
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  clearAllBuckets();
  const results = { complete: 0, partial: 0, unenrichable: 0, errored: 0 };
  const startBatch = Date.now();

  for (let i = 0; i < eligible.length; i += 1) {
    const { file, entity } = eligible[i];
    const key = entity.entityKey;
    const startEntity = Date.now();
    process.stdout.write(`  [${i + 1}/${eligible.length}] ${key.slice(0, 36).padEnd(36)} `);

    try {
      const { profile, routes } = await enrichLead({
        entity,
        leadId: entity.entityKey,
        clientSlug: slugifyName(entity.latest?.name),
        stage: 'queued_for_enrichment',
        location: 'AU',
        ledgerPath: LEDGER_PATH,
      });
      const elapsed = Date.now() - startEntity;

      // Build fixture (matching test-enrichment-live shape)
      const fixturePath = path.join(FIXTURES_DIR, `${key}.json`);
      fs.writeFileSync(fixturePath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        entity_input: { entityKey: entity.entityKey, latest: entity.latest, identifiers: entity.identifiers },
        profile,
        routes_summary: routes.map((r) => ({
          purpose: r.purpose, ok: r.ok, provider: r.provider,
          result_count: r.results?.length || 0,
          top_3: (r.results || []).slice(0, 3).map((x) => ({ position: x.position, title: x.title, url: x.url })),
          error: r.error,
        })),
        total_elapsed_ms: elapsed,
        batch_source: 'pl:run-enrichment-batch',
      }, null, 2) + '\n');

      // Step 6: merge contact_identity + flip enrichment_status
      entity.latest = entity.latest || {};
      entity.latest.contact_identity = buildContactIdentity(profile);
      // Promote contact fields to latest.phone/website if entity was missing them
      if (!entity.latest.phone && profile.contact?.phone) entity.latest.phone = profile.contact.phone;
      if (!entity.latest.website && profile.contact?.website) entity.latest.website = profile.contact.website;
      entity.enrichment_status = decideEnrichmentStatus(profile);
      entity.history = [
        ...(entity.history || []),
        { at: new Date().toISOString(), event: 'enrichment_batch_ran', status: entity.enrichment_status, routes: profile.enrichment_trace.queries_succeeded },
      ].slice(-100);
      entity.lastSeenAt = new Date().toISOString();
      fs.writeFileSync(path.join(ENTITIES_DIR, file), JSON.stringify(entity, null, 2));

      results[entity.enrichment_status] += 1;
      const icon = entity.enrichment_status === 'complete' ? `${GREEN}✓${RESET}` :
                   entity.enrichment_status === 'partial' ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
      console.log(`${icon} ${entity.enrichment_status.padEnd(13)} ${DIM}${profile.enrichment_trace.queries_succeeded}/${profile.enrichment_trace.queries_run} routes · ${elapsed}ms${RESET}`);
    } catch (err) {
      results.errored += 1;
      console.log(`${RED}✗${RESET} error           ${DIM}${err.message}${RESET}`);
    }

    if (i < eligible.length - 1) await sleep(500); // rate-limit safety
  }

  const totalMs = Date.now() - startBatch;

  // Step 7: Discord summary
  const summary = `Enrichment batch complete: ${eligible.length} entities processed in ${(totalMs / 1000).toFixed(1)}s.`;
  const detail =
    `**complete**: ${results.complete}\n` +
    `**partial**: ${results.partial}\n` +
    `**unenrichable**: ${results.unenrichable}\n` +
    `**errored**: ${results.errored}\n\n` +
    `Cost: $0 (T0 Tinyfish + DDGS). Fixtures in \`data/v2/fixtures/enrichment/\`.`;
  await pushAlert({
    title: summary,
    detail,
    severity: results.errored > 0 ? 'warn' : 'info',
    source: 'pl:run-enrichment-batch',
    fields: [
      { name: 'limit', value: String(LIMIT), inline: true },
      { name: 'niche', value: NICHE || 'all', inline: true },
      { name: 'duration', value: `${(totalMs / 1000).toFixed(1)}s`, inline: true },
    ],
    url: 'https://profitslocal.com/admin/scoring/sop-1',
  });

  console.log('');
  console.log(`${GREEN}✓ Done.${RESET} complete=${results.complete} · partial=${results.partial} · unenrichable=${results.unenrichable} · errored=${results.errored}`);
  console.log(`${DIM}Discord summary pushed to SYSTEM_ALERTS webhook.${RESET}\n`);
  process.exit(results.errored > 0 ? 1 : 0);
}

await main();
