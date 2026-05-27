#!/usr/bin/env node
/**
 * pl:validate-single-page-brief — hard-fail pre-render gate for single-page brief
 *
 * Per Codex Round 9 D4 + Round 16 Q-Y-3:
 *   Validates INPUT shape + deterministic cross-field constraints only.
 *   NOT a content-quality auditor (that's pl-audit-rubric).
 *   NOT a rendered-output checker (that's pl-audit-tier).
 *
 *   Slot in pl:e2e chain: AFTER pl-validate-handoff · BEFORE pl-compose-site.
 *
 * Codex Round 16 Q-Y-1 (c) hybrid source resolution:
 *   1. Prefer explicit YAML: clients/<slug>/v2/single-page-brief.yaml
 *   2. Fall back to derived: clients/<slug>/v2/handoff/od-package/facts.json
 *      + content/*.json (Phase B work · stub for now)
 *
 * Usage:
 *   pl:validate-single-page-brief --slug <slug>             # default · slug-resolved path
 *   pl:validate-single-page-brief --brief <yaml-or-json>    # direct file
 *   pl:validate-single-page-brief --json                    # stdout JSON output
 *   pl:validate-single-page-brief --help
 *
 * Exit codes:
 *   0  PASS
 *   1  FAIL · validation errors
 *   2  FAIL · brief file missing / unreadable
 *
 * Spec: docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §6
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validateBrief, BRIEF_SCHEMA } from '../../core/handoff/single-page-brief-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

// ─── Arg parsing ───────────────────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--json') out.json = true;
    else if (a === '--slug') out.slug = argv[++i];
    else if (a === '--brief') out.brief = argv[++i];
  }
  return out;
}

function printHelp() {
  console.log(`pl:validate-single-page-brief · hard-fail pre-render gate

Usage:
  pl:validate-single-page-brief --slug <slug>     resolve clients/<slug>/v2/single-page-brief.yaml
  pl:validate-single-page-brief --brief <path>    validate explicit file
  pl:validate-single-page-brief --json            JSON output to stdout

Exit codes:
  0  PASS
  1  FAIL · schema or cross-field violations
  2  FAIL · brief file missing or unreadable

Spec: docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §6
`);
}

// ─── Brief loader (Codex R16 Q-Y-1 c hybrid) ──────────────────────────────────
function resolveBriefPath(args) {
  if (args.brief) return args.brief;
  if (args.slug) {
    const yamlPath = path.join(REPO, 'clients', args.slug, 'v2', 'single-page-brief.yaml');
    if (fs.existsSync(yamlPath)) return yamlPath;
    // Fallback derived path · Phase B work
    return { derived: true, slug: args.slug, fallback_source: `clients/${args.slug}/v2/handoff/od-package/` };
  }
  return null;
}

// Brief parser · uses js-yaml (already a dep in this repo)
function parseBrief(text) {
  if (/^\s*\{/.test(text)) return JSON.parse(text);
  return yaml.load(text);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (args.help) { printHelp(); process.exit(0); }

  const resolved = resolveBriefPath(args);
  if (!resolved) {
    console.error('FAIL · must provide --slug or --brief');
    process.exit(2);
  }
  if (typeof resolved !== 'string') {
    // derived fallback · Phase B
    const out = {
      valid: false,
      mode: 'derived_fallback_unimplemented',
      slug: resolved.slug,
      message: `Derived-from-handoff fallback not implemented (Phase B work · Codex R16 Q-Y-1). Create clients/${resolved.slug}/v2/single-page-brief.yaml.`,
      fallback_source: resolved.fallback_source,
    };
    if (args.json) console.log(JSON.stringify(out, null, 2));
    else {
      console.error(`FAIL · ${out.message}`);
    }
    process.exit(2);
  }

  if (!fs.existsSync(resolved)) {
    console.error(`FAIL · brief file not found: ${resolved}`);
    process.exit(2);
  }

  let brief;
  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    brief = parseBrief(raw);
  } catch (e) {
    console.error(`FAIL · could not parse brief: ${e.message}`);
    process.exit(2);
  }

  const result = validateBrief(brief);
  result.brief_path = resolved;
  result.brief_loaded_at = new Date().toISOString();

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`pl:validate-single-page-brief · ${resolved}`);
    console.log(`  schema_errors: ${result.summary.schema_errors}`);
    console.log(`  cross_field_errors: ${result.summary.cross_field_errors}`);
    console.log(`  warnings: ${result.summary.warnings}`);
    console.log(`  verdict: ${result.valid ? 'PASS ✓' : 'FAIL ✗'}`);
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const e of result.errors) {
        console.log(`  · [${e.code || 'cross'}] ${e.path || '(cross)'}: ${e.message}`);
      }
    }
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const w of result.warnings) {
        console.log(`  · [${w.code}] ${w.message}`);
      }
    }
  }
  process.exit(result.valid ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
