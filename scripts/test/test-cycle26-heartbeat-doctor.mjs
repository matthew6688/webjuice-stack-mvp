/**
 * cycle-26 · TDD test 21/?? · profile-card heartbeat doctor (static-check).
 *
 * P2.3 verifies the doctor CLI exists + has the right shape (entry + Discord
 * fetch + fix path). Full integration is impractical (needs live Discord) ·
 * but we can guard against regression by static greps.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DOCTOR = path.join(ROOT, 'scripts/cli/pl-profile-card-heartbeat.js');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 21/?? · heartbeat doctor static\n');

t('doctor CLI exists at scripts/cli/pl-profile-card-heartbeat.js', () => {
  assert.ok(fs.existsSync(DOCTOR), `missing ${DOCTOR}`);
});

const src = fs.readFileSync(DOCTOR, 'utf8');

t('imports renderProfileCard + upsertProfileCard', () => {
  assert.ok(src.includes('renderProfileCard'), 'must import renderProfileCard');
  assert.ok(src.includes('upsertProfileCard'), 'must import upsertProfileCard');
});

t('scans entities · iterates each · fetches live embed', () => {
  assert.ok(src.includes('readdirSync') || src.includes('fs.readdirSync'));
  assert.ok(src.includes('/channels/') && src.includes('/messages/'));
});

t('supports --dry-run flag (read-only detect)', () => {
  assert.ok(src.includes('dry-run') || src.includes('dryRun'));
});

t('supports --entity-key single check', () => {
  assert.ok(src.includes('entity-key') || src.includes('entityKey'));
});

t('hashEmbed function for drift detection', () => {
  assert.ok(src.includes('hashEmbed') || src.includes('hash'));
});

t('non-zero exit on drift found (1) or error (2)', () => {
  assert.ok(src.includes('process.exit(1)'), 'must exit 1 on drift+fix');
  assert.ok(src.includes('process.exit(2)'), 'must exit 2 on error');
});

t('npm script registered: pl:profile-card-heartbeat', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['pl:profile-card-heartbeat'],
    'npm script missing for heartbeat doctor');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
