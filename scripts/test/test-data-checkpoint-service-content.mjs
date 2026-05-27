/**
 * Regression · data-checkpoint service_content HARD gate (Codex Move C · 2026-05-27)
 *
 * Context (Matthew + Codex consult chain CODEX-CONSULT-2 → RESPONSE-2):
 *   VIP-roofing-brisbane checkpoint was returning verdict=GREEN/multi even
 *   though `handoff/content/services.json` was empty with a notes field
 *   that explicitly said the scrape hit a parked / ad landing page. That
 *   gap would let pl:compose-site reach its dangerous "invent services
 *   from page slugs" fallback (pl-compose-site.js:293-316), violating the
 *   never-AI-generate-core-facts contract.
 *
 *   Move C added a `service_content` HARD field to pl-data-checkpoint.js
 *   that cross-checks the downstream services file and refuses to pass
 *   GREEN/YELLOW when:
 *     - services array is empty (< 2 entries), OR
 *     - notes contain any of 5 parked-domain regex patterns:
 *       /parked\s+domain/i
 *       /ad\s+landing/i
 *       /not\s+the\s+actual\s+business\s+website/i
 *       /unrelated\s+links/i
 *       /book\s+your\s+own\s+appointment\s+online/i
 *
 *   Fix hint must point upstream (re-intake / pl:enrich-handoff),
 *   NEVER suggest AI-generating the service list.
 *
 * Contract:
 *   - pl-data-checkpoint.js evaluates handoff/content/services.json AND
 *     handoff/od-package/content/services.json
 *   - At least one of the 5 parked-domain regexes triggers RED
 *   - Empty services array (< 2 entries) on a present file triggers RED
 *   - The fix hint references re-intake or pl:enrich-handoff, NOT
 *     AI-generation
 *   - Live smoke against the VIP fixture exits 1 with verdict=RED
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('regression · data-checkpoint service_content gate (Move C · 2026-05-27)\n');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'scripts/cli/pl-data-checkpoint.js'), 'utf8');

// ─── Static / contract checks ─────────────────────────────────────────────

t('reads handoff/content/services.json', () => {
  assert.ok(/handoff\/content\/services\.json/.test(src),
    'service_content gate must read handoff/content/services.json');
});

t('reads handoff/od-package/content/services.json', () => {
  assert.ok(/handoff\/od-package\/content\/services\.json/.test(src),
    'service_content gate must also read od-package services.json');
});

t('has all 5 parked-domain regex patterns', () => {
  const expected = [
    'parked\\s+domain',
    'ad\\s+landing',
    'not\\s+the\\s+actual\\s+business\\s+website',
    'unrelated\\s+links',
    'book\\s+your\\s+own\\s+appointment\\s+online',
  ];
  for (const lit of expected) {
    assert.ok(src.includes(lit),
      `parked-domain regex missing: ${lit}`);
  }
});

t('service_content is in the hard field set', () => {
  assert.ok(/service_content\s*:\s*\{/.test(src),
    'service_content must be defined as a hard-field entry');
});

t('fix hint points upstream (NOT AI-generation)', () => {
  // Find the service_content fixMap entry (inside missing-fields loop)
  const idx = src.indexOf("service_content: v.parked_domain_detected");
  assert.ok(idx > 0, 'service_content fix-hint mapping must exist in fixMap');
  const slice = src.slice(idx, idx + 1500);
  assert.ok(/pl:enrich-handoff|pl:scrape-docker|re-intake/i.test(slice),
    'fix hint must reference re-intake / pl:enrich-handoff / pl:scrape-docker');
  assert.ok(/NEVER AI-generate/.test(slice),
    'fix hint must explicitly forbid AI-generating the service list');
});

// ─── Live smoke against vip fixture (RED expected) ───────────────────────

const VIP_HANDOFF = path.join(ROOT, 'clients/vip-roofing-brisbane/v2/handoff/content/services.json');
const VIP_CHECKPOINT = path.join(ROOT, 'clients/vip-roofing-brisbane/v2/checkpoint.json');

if (fs.existsSync(VIP_HANDOFF)) {
  t('vip-roofing-brisbane fixture has parked-domain notes (expected fixture state)', () => {
    const handoff = JSON.parse(fs.readFileSync(VIP_HANDOFF, 'utf8'));
    const notes = String(handoff.notes || '');
    assert.ok(
      /parked\s+domain|ad\s+landing|not\s+the\s+actual\s+business\s+website|unrelated\s+links/i.test(notes),
      'vip fixture should contain at least one parked-domain signal in notes'
    );
  });

  t('pl:data-checkpoint exits 1 RED on vip-roofing-brisbane', () => {
    let exitCode = 0;
    try {
      execSync('npm run --silent pl:data-checkpoint -- --slug vip-roofing-brisbane', {
        cwd: ROOT,
        stdio: 'pipe',
      });
    } catch (e) {
      exitCode = e.status;
    }
    assert.equal(exitCode, 1, 'vip checkpoint must exit 1 (RED)');

    const ck = JSON.parse(fs.readFileSync(VIP_CHECKPOINT, 'utf8'));
    assert.equal(ck.verdict, 'RED', `vip verdict must be RED · got ${ck.verdict}`);
    assert.ok(
      ck.missing.some(m => m.field === 'service_content'),
      'vip RED must cite service_content as the missing hard field'
    );
    const svcMissing = ck.missing.find(m => m.field === 'service_content');
    assert.ok(
      /pl:enrich-handoff|pl:scrape-docker|re-intake/i.test(svcMissing.fix || ''),
      'service_content fix hint must point upstream'
    );
    assert.ok(
      /NEVER AI-generate/i.test(svcMissing.fix || ''),
      'service_content fix hint must forbid AI-generation'
    );
  });
} else {
  console.log('  ⚠ vip fixture not found · skipping live smoke (static checks still ran)');
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
