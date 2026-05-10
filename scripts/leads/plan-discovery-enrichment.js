#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { buildDiscoveryQueues, loadDiscoveryEntities } from '../../core/leads/discovery-store.js';
import { getEnrichmentGate, enrichmentGateLabel } from '../../core/leads/enrichment-gate.js';

const args = parseArgs(process.argv.slice(2));
const storeRoot = path.resolve(args['store-root'] || args.storeRoot || path.join('data', 'leads'));
const limit = Number(args.limit || 5);
const live = Boolean(args.live);
const queues = buildDiscoveryQueues({ storeRoot, limit });
const entitiesByKey = new Map(loadDiscoveryEntities({ storeRoot }).map((entity) => [entity.entityKey, entity]));
const selected = queues.enrichment
  .map((item) => entitiesByKey.get(item.entityKey))
  .filter(Boolean)
  .slice(0, limit);

const plan = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: live ? 'live_allowed' : 'dry_run_plan_only',
  costPolicy: {
    default: 'do_not_call_paid_or_external_enrichment_until_live_flag_is_set',
    tinyfish: live ? 'allowed_for_selected_candidates' : 'planned_only',
    googlePlacesApi: live ? 'allowed_for_selected_candidates' : 'planned_only',
    emailExtraction: 'not_in_this_step',
    gate: 'dry_run_plan -> approved_by_operator -> executed -> ingested',
  },
  selected: selected.map((entity) => buildPlanItem(entity)),
};

const outPath = path.join(storeRoot, 'queues', 'selected-enrichment-plan.json');
writeJson(outPath, plan);

console.log(JSON.stringify({
  ok: true,
  live,
  selected: plan.selected.length,
  outputPath: path.relative(process.cwd(), outPath),
  items: plan.selected.map((item) => ({
    entityKey: item.entityKey,
    name: item.name,
    tinyfishCommand: item.commands.tinyfish,
    googlePlacesCommand: item.commands.googlePlaces,
    costGate: item.costGate.status,
  })),
}, null, 2));

function buildPlanItem(entity) {
  const latest = entity.latest || {};
  const auditPath = path.join(storeRoot, 'audits', entity.entityKey, 'current-site-audit.json');
  const audit = readJsonIfExists(auditPath) || {};
  const baseDir = path.join(storeRoot, 'enrichment', entity.entityKey);
  const costGate = getEnrichmentGate(entity.entityKey, { storeRoot });
  return {
    entityKey: entity.entityKey,
    name: latest.name || '',
    status: entity.status || '',
    website: latest.website || '',
    placeId: entity.identifiers?.place_id || '',
    phone: latest.phone || '',
    audit: {
      path: fs.existsSync(auditPath) ? auditPath : '',
      score: audit.score ?? null,
      salesDecision: audit.salesDecision || '',
      verdict: audit.verdict || '',
    },
    costGate: {
      ...costGate,
      label: enrichmentGateLabel(costGate.status),
      canExecutePaidTools: live && ['approved', 'executed', 'ingested'].includes(costGate.status),
      nextRequiredAction: {
        planned: 'operator_approval_required_before_paid_enrichment',
        approved: 'run_selected_enrichment_tools_and_record_executed',
        executed: 'ingest_enrichment_outputs_into_discovery_store',
        ingested: 'ready_for_promote_or_outreach_brief',
      }[costGate.status] || 'operator_approval_required_before_paid_enrichment',
    },
    requiredBeforeSpend: [
      'cheap site audit has build_mockup or human_review salesDecision',
      'operator accepts this candidate or live flag is intentionally set',
      'no email extraction yet',
    ],
    commands: {
      tinyfish: latest.website
        ? `npm run extract:tinyfish -- --url ${shellToken(latest.website)} --raw ${shellToken(path.join(baseDir, 'tinyfish.raw.json'))} --text ${shellToken(path.join(baseDir, 'tinyfish.text.txt'))} --dry-run`
        : '',
      googlePlaces: entity.identifiers?.place_id
        ? `npm run extract:google-places -- --placeId ${shellToken(entity.identifiers.place_id)} --niche ${shellToken(latest.niche || 'local_business')} --city ${shellToken(latest.city || '')} --dry-run`
        : '',
    },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function shellToken(value) {
  const raw = String(value || '');
  if (/^[a-zA-Z0-9._:/@=-]+$/.test(raw)) return raw;
  return JSON.stringify(raw);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
