#!/usr/bin/env node
/**
 * pl:fixture-check · run an E2E contract fixture and verify assertions
 *
 * Reads `fixtures/e2e/<name>/contract.json`, runs the declared pipeline_steps
 * (or skips if --skip-pipeline), then validates assertions against the audit
 * JSON + rendered HTML.
 *
 * Phase A.1 Step 6 · codex R20 Q-CC-2 (a): smoke-level only · locks composite
 * + T1 + JSON-LD + R-BA-6 DOM signature. NOT full audit shape (over-specifies
 * before T3/T4/T5 wired). NOT byte-for-byte HTML (timestamp brittle).
 *
 * Exit codes:
 *   0 · all assertions pass
 *   1 · one or more assertions failed
 *   2 · pipeline step failed (cannot reach assertion phase)
 *   3 · fixture / file missing
 *
 * Usage:
 *   node scripts/cli/pl-fixture-check.js --fixture vicwest
 *   node scripts/cli/pl-fixture-check.js --fixture vicwest --skip-pipeline   # just re-check assertions
 *   node scripts/cli/pl-fixture-check.js --fixture vicwest --json            # machine-readable
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const n = argv[i + 1];
      if (!n || n.startsWith('--')) out[k] = true;
      else { out[k] = n; i++; }
    }
  }
  return out;
}

function die(msg, code = 3) {
  console.error(`[pl:fixture-check] ERROR: ${msg}`);
  process.exit(code);
}

function readJsonAbs(rel) {
  const abs = path.resolve(REPO, rel);
  if (!fs.existsSync(abs)) die(`file not found: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function readTextAbs(rel) {
  const abs = path.resolve(REPO, rel);
  if (!fs.existsSync(abs)) die(`file not found: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// Access nested field via dot path · supports D2.1_var_brand_coverage etc.
// Strategy: split on '.' but rejoin tokens that look like "D<digit>.<digit>_..."
function getField(obj, dotPath) {
  // Greedy match: try whole path first as a key, then strip rightmost segment
  const tokens = [];
  let remaining = dotPath;
  while (remaining.length) {
    // Match D-style keys: D2.1_var_brand_coverage (D + digit + dot + digit + word chars)
    const dMatch = remaining.match(/^(D\d+\.\d+_[a-zA-Z0-9_]+)(?:\.(.*))?$/);
    if (dMatch) {
      tokens.push(dMatch[1]);
      remaining = dMatch[2] || '';
      continue;
    }
    const dotIdx = remaining.indexOf('.');
    if (dotIdx === -1) { tokens.push(remaining); break; }
    tokens.push(remaining.slice(0, dotIdx));
    remaining = remaining.slice(dotIdx + 1);
  }
  let cur = obj;
  for (const tok of tokens) {
    if (cur == null) return undefined;
    cur = cur[tok];
  }
  return cur;
}

function extractJsonLd(html) {
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function runStep(step) {
  const npmCmd = step.cli.replace(/^pl:/, 'pl:');
  const args = ['run', npmCmd, '--silent', '--'].concat(step.args.split(/\s+/).filter(Boolean));
  const result = spawnSync('npm', args, { cwd: REPO, encoding: 'utf8', stdio: 'pipe' });
  return {
    cli: step.cli,
    args: step.args,
    exit_code: result.status,
    expected_exit: step.expect_exit,
    pass: result.status === step.expect_exit,
    stdout_tail: (result.stdout || '').split('\n').slice(-5).join('\n'),
    stderr_tail: (result.stderr || '').split('\n').slice(-3).join('\n'),
  };
}

function checkAssertion(a, auditJson, html, jsonLd) {
  const out = { id: a.id, kind: a.kind, rationale: a.rationale, pass: false, detail: '' };
  switch (a.kind) {
    case 'audit_field_gte': {
      const v = getField(auditJson, a.path);
      out.actual = v;
      out.pass = typeof v === 'number' && v >= a.min;
      out.detail = `${a.path} = ${v} (min ${a.min})`;
      break;
    }
    case 'audit_field_lte': {
      const v = getField(auditJson, a.path);
      out.actual = v;
      out.pass = typeof v === 'number' && v <= a.max;
      out.detail = `${a.path} = ${v} (max ${a.max})`;
      break;
    }
    case 'audit_field_equals': {
      const v = getField(auditJson, a.path);
      out.actual = v;
      out.pass = v === a.value;
      out.detail = `${a.path} = ${JSON.stringify(v)} (expect ${JSON.stringify(a.value)})`;
      break;
    }
    case 'html_contains': {
      out.pass = html.includes(a.needle);
      out.detail = `html contains "${a.needle}"`;
      break;
    }
    case 'html_contains_all': {
      const missing = (a.needles || []).filter(n => !html.includes(n));
      out.pass = missing.length === 0;
      out.detail = missing.length ? `missing: ${missing.join(', ')}` : `all ${a.needles.length} needles present`;
      break;
    }
    case 'html_jsonld_field_equals': {
      if (!jsonLd) { out.detail = 'no JSON-LD'; break; }
      const v = getField(jsonLd, a.ld_path);
      out.actual = v;
      out.pass = v === a.value;
      out.detail = `JSON-LD ${a.ld_path} = ${JSON.stringify(v)} (expect ${JSON.stringify(a.value)})`;
      break;
    }
    case 'html_jsonld_field_exists': {
      if (!jsonLd) { out.detail = 'no JSON-LD'; break; }
      const v = getField(jsonLd, a.ld_path);
      out.pass = v !== undefined && v !== null;
      out.detail = `JSON-LD ${a.ld_path} ${out.pass ? 'exists' : 'missing'}`;
      break;
    }
    default:
      out.detail = `unknown assertion kind: ${a.kind}`;
  }
  return out;
}

function main() {
  const args = parseArgs();
  if (args.help || !args.fixture) {
    console.log('Usage: pl:fixture-check --fixture <name> [--skip-pipeline] [--json]');
    process.exit(args.help ? 0 : 3);
  }
  const fixtureDir = path.join(REPO, 'fixtures/e2e', args.fixture);
  const contractPath = path.join(fixtureDir, 'contract.json');
  if (!fs.existsSync(contractPath)) die(`contract not found: fixtures/e2e/${args.fixture}/contract.json`);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

  const result = {
    fixture: args.fixture,
    contract_schema: contract.schema_version,
    pipeline_steps: [],
    assertions: [],
    passed: 0,
    failed: 0,
    started_at: new Date().toISOString(),
  };

  if (!args['skip-pipeline']) {
    for (const step of contract.pipeline_steps || []) {
      const r = runStep(step);
      result.pipeline_steps.push(r);
      if (!r.pass) {
        result.fatal = `pipeline step "${step.cli}" failed (exit ${r.exit_code} · expected ${step.expect_exit})`;
        result.finished_at = new Date().toISOString();
        if (args.json) console.log(JSON.stringify(result, null, 2));
        else {
          console.error(`[pl:fixture-check] ${result.fatal}`);
          console.error(r.stderr_tail);
        }
        process.exit(2);
      }
    }
  }

  const auditJson = readJsonAbs(contract.assertions.audit_json_path);
  const html = readTextAbs(contract.assertions.rendered_html_path);
  const jsonLd = extractJsonLd(html);

  for (const a of contract.assertions.checks || []) {
    const r = checkAssertion(a, auditJson, html, jsonLd);
    result.assertions.push(r);
    if (r.pass) result.passed++; else result.failed++;
  }

  result.finished_at = new Date().toISOString();
  result.overall_pass = result.failed === 0;

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n[pl:fixture-check] ${args.fixture} · ${result.passed}/${result.passed + result.failed} assertions passed`);
    for (const r of result.assertions) {
      const icon = r.pass ? '✓' : '✗';
      console.log(`  ${icon} ${r.id} · ${r.detail}`);
    }
    console.log(result.overall_pass ? '\n  RESULT: PASS\n' : '\n  RESULT: FAIL\n');
  }
  process.exit(result.overall_pass ? 0 : 1);
}

main();
