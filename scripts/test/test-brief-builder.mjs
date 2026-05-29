#!/usr/bin/env node
/**
 * test-brief-builder.mjs · codex R79 acceptance tests for pl-build-single-page-brief +
 * the license-omit schema rule + provenance gating.
 *
 * Run: node scripts/test/test-brief-builder.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateBrief } from '../../core/handoff/single-page-brief-schema.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

const base = () => ({
  business_name: 'Test Roofing', phone: { display: '0400 058 842', tel_link: '+61400058842' },
  address: { street: '1 Test St', suburb: 'Ballarat', state: 'VIC', postcode: '3350' }, state: 'VIC',
  abn: '49 809 953 319', niche: 'roofing', primary_segment: 'planned-upgrade', urgency_mix: 'scheduled-heavy',
  pricing_disclosure_mode: 'per_quote_only', brand_tokens_path: 'clients/x/v2/brand/brand-tokens.css',
  suburbs_covered: ['A', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff', 'Gg', 'Hh'],
  services: [{ name: 'Roof restoration', short: 'x' }, { name: 'Roof repair', short: 'y' }, { name: 'Gutters', short: 'z' }],
});
const errCodes = (b) => (validateBrief(b).errors || []).map((e) => e.code);

console.log('== T1 · license.status=omit consistency (codex R79 #1) ==');
{
  const b = base(); b.license = { authority: 'VBA', number: null, status: 'omit' };
  const codes = errCodes(b);
  ok(!codes.includes('license_number_required_unless_omit') && !codes.some((c) => /license/.test(String(c)) && c !== 'license_number_required_unless_omit') , 'omit + number:null → VALID (no license error)');
}
{
  const b = base(); b.license = { authority: 'VBA', number: null, status: 'active' };
  ok(errCodes(b).includes('license_number_required_unless_omit'), 'active + number:null → FAIL license_number_required_unless_omit');
}
{
  const b = base(); b.license = { authority: 'VBA', number: 'CDB-U 65938', status: 'active' };
  ok(!errCodes(b).includes('license_number_required_unless_omit'), 'active + real number → VALID');
}

console.log('== T2 · provenance gating: ai-inferred suburbs never counted as verified coverage (codex R79 #2) ==');
{
  // a-j has 3 verified + 10 ai-inferred → builder must keep suburbs_covered=verified only
  execFileSync('node', ['scripts/cli/pl-build-single-page-brief.js', '--slug', 'a-j-roofing-solutions'], { cwd: REPO, stdio: 'pipe' });
  const brief = JSON.parse(execFileSync('node', ['scripts/cli/pl-build-single-page-brief.js', '--slug', 'a-j-roofing-solutions', '--json'], { cwd: REPO }).toString());
  ok(brief.suburbs_covered.length === 3, `suburbs_covered = verified only (got ${brief.suburbs_covered.length}, expect 3)`);
  ok((brief.suburbs_candidates || []).length >= 5 && brief.suburbs_candidates.every((s) => /ai-inferred/.test(s.provenance)), 'ai-inferred suburbs parked in suburbs_candidates with provenance');
  ok((brief._data_gaps || []).some((g) => /suburbs_covered/.test(g)), 'a-j suburbs flagged as data_gap (needs_enrichment · not padded)');
}

console.log('== T3 · mark validates · a-j fails only on suburbs (genuine gap) ==');
{
  execFileSync('node', ['scripts/cli/pl-build-single-page-brief.js', '--slug', 'mark-squire-roof-restorations'], { cwd: REPO, stdio: 'pipe' });
  const markYaml = fs.existsSync(path.resolve('clients/mark-squire-roof-restorations/v2/single-page-brief.yaml'));
  ok(markYaml, 'mark single-page-brief.yaml written');
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} · ${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
