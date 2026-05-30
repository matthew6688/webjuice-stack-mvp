#!/usr/bin/env node
/**
 * pl-skill-contract-audit · the "D" skill-contract currency gate (codex R123/R124/R135).
 *
 * For each skills/<name>/SKILL.md, verify it has NOT drifted from the code it points to:
 *   - npm-script refs (`npm run X` / bare `pl:x` `leads:x` `ops:x` `scoring:x`) EXIST in package.json
 *   - file/module refs (core/… scripts/… data/…) EXIST on disk
 *   - FORBIDDEN STALE tokens (superseded contracts) are flagged for review — e.g. `predict_grade` as a
 *     contract (exclusion-filter is the real engine · cycle-23), `manual_review`/`needs_human` (R117 went
 *     fully-automated), `PERSONA_CONTEXT` as a default (R114 retired the persona apparatus).
 * Purpose (codex): prevent future drift so a skill isn't trusted Hermes-callable while describing dead logic.
 * It SURFACES drift (does not auto-edit). Exit 1 if any hard drift (missing script/file); stale tokens = warn.
 *
 * Usage: npm run ops:skill-contract-audit [-- --json] [--skill <name>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const onlySkill = (() => { const i = args.indexOf('--skill'); return i >= 0 ? args[i + 1] : null; })();

const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const SCRIPTS = new Set(Object.keys(pkg.scripts || {}));

// Stale tokens → reason. Presence is a WARNING (a skill may legitimately mention them, but foregrounding a
// superseded contract is drift the operator should review).
const STALE_TOKENS = [
  { re: /\bpredict_grade\b/, why: 'predict_grade is compat-only; exclusion-filter is the real decision engine (cycle-23)' },
  { re: /\bmanual_review\b/i, why: 'R117 went fully-automated (no human-hold) — auto-drop, not manual_review' },
  { re: /\bneeds_human\b/i, why: 'R117 fully-automated — no human-in-the-loop screening state' },
  { re: /PERSONA_CONTEXT|persona-aware (default|generation is the default)/i, why: 'R114 retired the persona apparatus; buyer-lens is folded into the contract, not a default module' },
];

const skillsDir = path.join(REPO, 'skills');
const skills = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')))
  : [];
const targets = onlySkill ? skills.filter((s) => s === onlySkill) : skills;

const report = [];
for (const skill of targets) {
  const md = fs.readFileSync(path.join(skillsDir, skill, 'SKILL.md'), 'utf8');
  // npm script refs
  const scriptRefs = new Set();
  for (const m of md.matchAll(/\bnpm run\s+([a-z0-9:_-]+)/gi)) scriptRefs.add(m[1]);
  for (const m of md.matchAll(/\b((?:pl|leads|ops|scoring|v3|audit|scrape|extract):[a-z0-9-]+)\b/gi)) scriptRefs.add(m[1]);
  const missing_scripts = [...scriptRefs].filter((s) => !SCRIPTS.has(s));
  // file/module refs (code/data paths)
  const fileRefs = new Set();
  for (const m of md.matchAll(/\b((?:core|scripts|data|templates|docs)\/[A-Za-z0-9._/-]+\.[a-z]{1,5})\b/g)) fileRefs.add(m[1]);
  const missing_files = [...fileRefs].filter((f) => !fs.existsSync(path.join(REPO, f)));
  // stale tokens
  const stale = STALE_TOKENS.filter((t) => t.re.test(md)).map((t) => t.why);

  const drift = missing_scripts.length || missing_files.length;
  report.push({ skill, missing_scripts, missing_files, stale_tokens: stale, drift: !!drift, warn: stale.length > 0 });
}

const hardDrift = report.filter((r) => r.drift);
const warned = report.filter((r) => r.warn);

if (jsonOut) { console.log(JSON.stringify({ total: report.length, hard_drift: hardDrift.length, warned: warned.length, report }, null, 2)); }
else {
  console.log(`\n=== skill-contract audit · ${report.length} skills ===`);
  console.log(`  hard drift (missing script/file): ${hardDrift.length} · stale-token warnings: ${warned.length}\n`);
  for (const r of report) {
    if (!r.drift && !r.warn) continue;
    console.log(`  ${r.skill}:`);
    if (r.missing_scripts.length) console.log(`    ❌ missing npm scripts: ${r.missing_scripts.join(', ')}`);
    if (r.missing_files.length) console.log(`    ❌ missing files: ${r.missing_files.join(', ')}`);
    if (r.stale_tokens.length) r.stale_tokens.forEach((w) => console.log(`    ⚠️  stale: ${w}`));
  }
  if (!hardDrift.length && !warned.length) console.log('  ✅ all skills current — no drift.');
  console.log(`\n  (hard drift fails the gate; stale-token warnings are review-only · codex R124)`);
}
process.exit(hardDrift.length ? 1 : 0);
