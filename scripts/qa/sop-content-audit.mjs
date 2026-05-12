#!/usr/bin/env node
/**
 * scripts/qa/sop-content-audit.mjs
 *
 * Enforce single-ownership across SOP docs. Grep each "owned" concept
 * key-phrase across all SOP docs; if it appears in more than one with
 * substantive content (not just a link), flag as overlap.
 *
 * Reads ownership from docs/SOP_OWNERSHIP_REGISTRY.md implicit table.
 * For now keep the rules inline (registry is markdown, not parseable).
 *
 * Usage:
 *   npm run ops:sop-audit                 — run audit
 *   npm run ops:sop-audit -- --verbose    — show passing checks too
 *
 * Exit 0 = clean. Exit 1 = at least one overlap.
 *
 * SOP_MAINTENANCE_RULES §6 · 2026-05-12.
 */

import fs from 'node:fs';
import path from 'node:path';

const VERBOSE = process.argv.includes('--verbose');
const ROOT = path.resolve(process.cwd(), 'docs');

// Map of owner-SOP → phrases that should appear with full description ONLY in
// that owner. If found in any other doc, that doc must be using a link, not
// a description.
const OWNERSHIP_RULES = [
  // SOP-1 owned phrases
  { owner: 'SOP_1_INTAKE_DISCOVERY.md', phrases: [
    'POST /api/v1/jobs',                  // gosom API
    'max_time ≥ 180',                     // gosom hard limit
    'pl:pipeline-batch-start',
    'pl:scrape-docker',
    'pl:ingest-image',
  ] },
  // SOP-2 owned phrases
  { owner: 'SOP_2_LEAD_DISCOVERY_PIPELINE.md', phrases: [
    'cheap-audit-v2',
    'detailed-audit',
    'niche_match',
    'starter_candidate',
    'relevance_pass',
    'HARD_SKIP_RULES',
    'openLeadThread',
    'gradeLead',
  ] },
  // Handoff owned phrases
  { owner: 'SOP_HANDOFF_CONTRACT.md', phrases: [
    'schemaVersion',
    'DISCOVERY_ENTITY_STATUS',
    'PHASES enum',
    '`places_enrichment` 子对象',
  ] },
  // Tooling owned phrases
  { owner: 'SOP_X_TOOLING.md', phrases: [
    'PlacesQuotaGuard',
    'SYSTEM_ALERTS_DISCORD_WEBHOOK_URL',
    '$200/月免费额度',
    'ops:health-check',
    '11,000 calls',
  ] },
];

// Docs in scope (we audit overlap across these only)
const SCOPE_DOCS = [
  'SOP_OVERVIEW.md',
  'SOP_1_INTAKE_DISCOVERY.md',
  'SOP_2_LEAD_DISCOVERY_PIPELINE.md',
  'SOP_HANDOFF_CONTRACT.md',
  'SOP_X_TOOLING.md',
  'SOP_OWNERSHIP_REGISTRY.md',
  'SOP_MAINTENANCE_RULES.md',
];

const SUBSTANTIVE_THRESHOLD = 3; // # of substantive (non-link) occurrences before we call it overlap. 2 passing mentions are tolerable; 3+ suggests duplicated content.

// Meta-docs that legitimately list/index concepts from all SOPs — exempt
// from overlap detection (their job IS to mention everything).
const META_DOCS = new Set([
  'SOP_OWNERSHIP_REGISTRY.md',
  'SOP_MAINTENANCE_RULES.md',
  'SOP_OVERVIEW.md',
]);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const docContents = {};
for (const d of SCOPE_DOCS) {
  const p = path.join(ROOT, d);
  if (fs.existsSync(p)) {
    docContents[d] = fs.readFileSync(p, 'utf8');
  } else {
    docContents[d] = null;
  }
}

let failCount = 0;
let passCount = 0;
const failures = [];

console.log(`\n${YELLOW}sop-content-audit${RESET}  ·  single-ownership enforcement\n`);

for (const rule of OWNERSHIP_RULES) {
  if (!docContents[rule.owner]) {
    console.log(`  ${DIM}skip — owner doc missing: ${rule.owner}${RESET}`);
    continue;
  }
  for (const phrase of rule.phrases) {
    const offenders = [];
    for (const [doc, content] of Object.entries(docContents)) {
      if (!content || doc === rule.owner) continue;
      if (META_DOCS.has(doc)) continue; // skip meta/index docs by design
      // Count substantive occurrences (excluding lines that link to owner)
      const lines = content.split('\n');
      let substantive = 0;
      for (const line of lines) {
        if (!line.includes(phrase)) continue;
        // If line is a link to owner, allow
        const lower = line.toLowerCase();
        if (lower.includes(rule.owner.toLowerCase().replace('.md', '')) ||
            lower.includes('see [') ||
            lower.includes('详见') ||
            lower.includes('owner') ||
            lower.includes('引用')) {
          continue;
        }
        substantive += 1;
      }
      if (substantive >= SUBSTANTIVE_THRESHOLD) {
        offenders.push({ doc, count: substantive });
      }
    }

    if (offenders.length > 0) {
      failCount += 1;
      const offText = offenders.map((o) => `${o.doc} (${o.count}×)`).join(', ');
      failures.push({ phrase, owner: rule.owner, offenders: offText });
      console.log(`  ${RED}✗${RESET} "${phrase}" — owner ${rule.owner}, also in: ${offText}`);
    } else {
      passCount += 1;
      if (VERBOSE) {
        console.log(`  ${GREEN}✓${RESET} "${phrase}" — single source in ${rule.owner}`);
      }
    }
  }
}

console.log('');
if (failCount === 0) {
  console.log(`${GREEN}✓ All ${passCount} ownership rules clean.${RESET}\n`);
  process.exit(0);
}

console.log(`${RED}✗ ${failCount} overlap(s) — single-source rule violated${RESET}`);
console.log(`${DIM}Fix: either move phrase content to owner doc + replace with link in other docs, or update ownership registry.${RESET}\n`);
process.exit(1);
