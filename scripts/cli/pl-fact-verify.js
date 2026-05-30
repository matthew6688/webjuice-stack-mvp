#!/usr/bin/env node
/**
 * pl-fact-verify · DETERMINISTIC TRUTH CHECK (Matthew 2026-05-30).
 *
 * Zero-tolerance gate: the rendered page's IDENTITY facts — licence (authority/number), ABN, phone,
 * business name, address — MUST match `single-page-brief.yaml` exactly. A mismatch (or a claim absent
 * from the locked brief) is a fabricated-identity HARD FAIL. NO LLM. This is the can't-be-wrong layer,
 * separate from copy quality (`pl:copy-audit`) and buyer-fit (`pl:persona-copy-audit`).
 *
 * Usage:
 *   npm run pl:fact-verify -- --slug vicwest-roofing
 *   npm run pl:fact-verify -- --html <file> --brief <single-page-brief.yaml>
 *   [--json <out>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadBriefFacts, identityFindings } from '../../core/audit/fact-verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--slug') args.slug = process.argv[++i];
  else if (a === '--html') args.html = process.argv[++i];
  else if (a === '--brief') args.brief = process.argv[++i];
  else if (a === '--json') args.json = process.argv[++i];
}

let htmlPath, briefPath;
if (args.slug) {
  htmlPath = path.join(REPO, 'clients', args.slug, 'v2/editorial-output/index.html');
  briefPath = path.join(REPO, 'clients', args.slug, 'v2/single-page-brief.yaml');
} else if (args.html) {
  htmlPath = path.resolve(REPO, args.html);
  briefPath = args.brief ? path.resolve(REPO, args.brief) : null;
} else { console.error('Usage: --slug <slug> | --html <file> --brief <brief.yaml>'); process.exit(2); }

if (!fs.existsSync(htmlPath)) { console.error(`not found: ${htmlPath}`); process.exit(2); }

const html = fs.readFileSync(htmlPath, 'utf8');
const briefFacts = loadBriefFacts(briefPath);
const r = identityFindings(html, briefFacts);
const hardFails = [...new Set(r.findings.filter(f => f.hardFail).map(f => f.hardFail))];
const pass = r.status === 'checked' && hardFails.length === 0;

const rel = path.relative(REPO, htmlPath);
if (r.status === 'skipped') {
  console.log(`[fact-verify] ${rel} · SKIPPED · ${r.warning}`);
} else {
  console.log(`[fact-verify] ${rel} · ${pass ? 'PASS ✅' : 'FAIL ❌'} · ${r.findings.length} identity finding(s)${hardFails.length ? ' · HARD FAILS: ' + hardFails.join(',') : ''}`);
  for (const f of r.findings) console.log(`  · [${f.severity}] ${f.reason}${f.hardFail ? ` (${f.hardFail})` : ''}`);
}
if (args.json) {
  fs.writeFileSync(args.json, JSON.stringify({ file: rel, pass, status: r.status, hardFails, findings: r.findings, brief_facts: briefFacts }, null, 2));
  console.log(`  → ${args.json}`);
}
process.exit(pass ? 0 : (r.status === 'skipped' ? 0 : 1));
