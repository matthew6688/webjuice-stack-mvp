// Shared helpers for v3 deliverable tests.
// Each test .mjs:
//   - imports from this file
//   - runs N assertions
//   - writes EVIDENCE json to data/qa/<id>.json
//   - exits 0 on PASS, 1 on FAIL
//   - prints concise PASS/FAIL summary
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const QA_DIR = path.join(REPO_ROOT, 'data', 'qa');

export function makeRunner(deliverableId) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const results = [];
  const t0 = Date.now();
  return {
    async assert(name, fn) {
      const r = { name, passed: false, error: null, took_ms: 0 };
      const start = Date.now();
      try {
        const v = await fn();
        if (v === false) throw new Error('assertion returned false');
        r.passed = true;
      } catch (err) {
        r.error = err?.message || String(err);
      }
      r.took_ms = Date.now() - start;
      results.push(r);
      const tag = r.passed ? 'PASS' : 'FAIL';
      console.log(`  [${tag}] ${name}${r.error ? ' · ' + r.error : ''}`);
      return r.passed;
    },
    skip(name, reason) {
      results.push({ name, passed: true, skipped: true, reason });
      console.log(`  [SKIP] ${name} · ${reason}`);
    },
    summary(extra = {}) {
      const pass = results.filter(r => r.passed && !r.skipped).length;
      const skip = results.filter(r => r.skipped).length;
      const fail = results.filter(r => !r.passed).length;
      const overall = fail === 0 ? 'PASS' : 'FAIL';
      const evidence = {
        deliverableId,
        overall,
        total: results.length,
        passed: pass,
        skipped: skip,
        failed: fail,
        took_ms: Date.now() - t0,
        ran_at: new Date().toISOString(),
        results,
        ...extra,
      };
      const evidencePath = path.join(QA_DIR, `${deliverableId}.json`);
      fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
      console.log(`\n[${deliverableId}] ${overall} · ${pass}/${results.length} passed · evidence: ${evidencePath}`);
      return { overall, exitCode: fail === 0 ? 0 : 1, evidencePath };
    },
  };
}

// Resolve a module path inside the repo. Returns null if missing (test should
// SKIP or FAIL depending on whether the module is required for the deliverable).
export function resolveRepo(rel) {
  const abs = path.resolve(REPO_ROOT, rel);
  return fs.existsSync(abs) ? abs : null;
}

export async function tryImport(rel) {
  const abs = resolveRepo(rel);
  if (!abs) return null;
  try { return await import(abs); } catch (err) { return { __error: err.message }; }
}

export function approxEq(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

export function readJson(rel) {
  const abs = path.resolve(REPO_ROOT, rel);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

export function writeQa(filename, contents) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const out = path.join(QA_DIR, filename);
  fs.writeFileSync(out, typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
  return out;
}
