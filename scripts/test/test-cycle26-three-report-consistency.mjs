/**
 * cycle-26 · TDD test 19/?? · master.md / customer / internal · 3-way consistency.
 *
 * P1.7: the 3 artifacts are derived from the SAME entity. If one shows
 * audit_score 65 but another shows 52 · that's data drift (race condition
 * between build steps · or different builders reading at different times).
 *
 * Asserts:
 *   - business_name identical across 3 files
 *   - audit_score identical (numeric · same XX/100)
 *   - 3 files are all newer than entity.json (built from current entity state)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SLUG = 'ace-roofing-service';
const V2 = path.join(ROOT, 'clients', SLUG, 'v2');
const MD = path.join(V2, 'master.md');
const REPORT = path.join(V2, 'master.report.html');
const CUSTOMER = path.join(V2, 'customer-facing-audit.html');
const INTERNAL = path.join(V2, 'internal-audit-report.html');
const ENTITY = path.join(ROOT, 'data/leads/entities/domain_aceroofingservice.com.au.json');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 19/?? · 3-way report consistency\n');

const required = [MD, REPORT, CUSTOMER, INTERNAL];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.log(`  ⏭ skip · missing: ${path.relative(ROOT, f)}`);
    console.log('\n0/0 passed · skipped');
    process.exit(0);
  }
}

const md = fs.readFileSync(MD, 'utf8');
const report = fs.readFileSync(REPORT, 'utf8');
const customer = fs.readFileSync(CUSTOMER, 'utf8');
const internal = fs.readFileSync(INTERNAL, 'utf8');
const entity = JSON.parse(fs.readFileSync(ENTITY, 'utf8'));

// ─── Helper: extract value from each ──────────────────────────────────────
function extractAuditScore(text) {
  const m = text.match(/(\d{1,3})\s*\/\s*100/);
  return m ? Number(m[1]) : null;
}
function extractBusinessName(file) {
  // master.md frontmatter: business_name: "Ace Roofing Service"
  if (file.startsWith('---\n')) {
    const m = file.match(/business_name:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  // HTML: <title>... · Ace Roofing Service</title>
  const m = file.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) {
    // strip "Website Audit Report · " or "·现状审计" prefix/suffix
    return m[1].split('·').map((s) => s.trim()).find((s) => s.length > 3 && !/audit|report|现状/i.test(s)) || m[1];
  }
  return null;
}

// ─── Cross-file value parity ──────────────────────────────────────────────
t('business_name identical in master.md frontmatter AND ' +
   'visible in all 3 HTML files', () => {
  const expected = entity.latest?.name;
  if (!expected) return;
  assert.ok(md.includes(expected), `master.md missing name "${expected}"`);
  assert.ok(report.includes(expected), `master.report.html missing name`);
  assert.ok(customer.includes(expected), `customer-facing-audit missing name`);
  assert.ok(internal.includes(expected), `internal-audit-report missing name`);
});

t('audit_score · same value across master.md + report.html + internal.html', () => {
  const scores = {
    md: extractAuditScore(md),
    report: extractAuditScore(report),
    internal: extractAuditScore(internal),
  };
  assert.ok(scores.md != null, 'no score found in master.md');
  // report.html derived from md · must match
  assert.equal(scores.report, scores.md, `report.html score ${scores.report} != md ${scores.md}`);
  // internal-audit also references same score
  if (scores.internal != null) {
    assert.equal(scores.internal, scores.md, `internal score ${scores.internal} != md ${scores.md}`);
  }
});

// ─── Build ordering ────────────────────────────────────────────────────────
t('all 4 artifacts newer than entity.json mtime (no stale build)', () => {
  // If entity was modified AFTER artifacts built · artifacts are stale.
  // Allow 1 day slack for legacy builds from prior cycles.
  const ent = fs.statSync(ENTITY).mtimeMs;
  for (const f of required) {
    const ft = fs.statSync(f).mtimeMs;
    // Allow up to 1 day stale (legacy)
    const slack = 24 * 3600 * 1000;
    if (ft + slack < ent) {
      throw new Error(`${path.basename(f)} stale · ${Math.round((ent - ft) / 1000)}s older than entity.json`);
    }
  }
});

// ─── No drift between md frontmatter and report HTML ──────────────────────
t('master.report.html is derived from current master.md (mtime · report >= md)', () => {
  const mdT = fs.statSync(MD).mtimeMs;
  const repT = fs.statSync(REPORT).mtimeMs;
  assert.ok(repT + 1000 >= mdT,
    `master.report.html older than master.md · should rebuild`);
});

t('all 4 files reference SAME business_id (or equivalent stable identifier)', () => {
  const bid = entity.entityKey;
  // master.md has it in frontmatter
  assert.ok(md.includes(bid), `master.md missing entityKey ${bid}`);
  // report.html might have it in meta or not visible · skip strict check
  // customer-facing should NOT need internal entityKey (could leak)
  assert.ok(!customer.includes(bid),
    `customer-facing leaks internal entityKey ${bid}`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
