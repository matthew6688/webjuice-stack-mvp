#!/usr/bin/env node
// V3 SOP-1 intake pressure test · pre-master.md pipeline
//
// Tests intent-router routing accuracy + args extraction across many edge cases:
//   - vague queries · different phrasings (English / 中文)
//   - quoted vs unquoted
//   - missing fields · partial signals
//   - phone formats · URL formats
//   - LLM (ollama) routes vs regex fallback
//
// Does NOT post to Discord · just exercises core/tasks/intent-router.js#routeIntent.
// Live Discord behaviour validated separately by docs/v3/DISCORD-LIVE-E2E-2026-05-13.md.
import { makeRunner, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('pressure-test-intake-router');
const router = await import(`${REPO_ROOT}/core/tasks/intent-router.js`);

const FORCE_REGEX = process.env.FORCE_REGEX === '1';
if (FORCE_REGEX) process.env.TEXT_PROVIDER = 'unavailable'; // skip ollama

// Test cases · 20+ phrasings · checks: kind + presence of expected args/flags
const CASES = [
  // ─── intake (batch-maps · gosom) ───────────────────────────────
  { text: 'find brisbane plumbers',                                expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'] },
  { text: 'find brisbane plumbers --count 2',                      expectKind: ['intake'],       requireArgFlags: ['--niche', '--city', '--count'] },
  { text: 'Sydney roofing companies',                              expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'] },
  { text: 'search for melbourne dentists',                         expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'] },
  { text: 'find dentists in gold coast',                           expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'], expectArgValues: { '--city': 'gold-coast' } },
  { text: '搜索 brisbane 屋顶公司',                                expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'] },
  { text: 'find perth panel beaters',                              expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'] },
  { text: 'cairns auto detail shops',                              expectKind: ['intake'],       requireArgFlags: ['--niche', '--city'], expectArgValues: { '--city': 'cairns' } },

  // ─── places-intake (Google Places API · multi-query · quoted) ───
  { text: '"cafe brisbane" "cafe sydney"',                         expectKind: ['places-intake'], requireArgFlags: ['--query'] },
  { text: '"roofer perth" "roofer adelaide" "roofer hobart"',      expectKind: ['places-intake'] },
  { text: 'places search "panel beater Brisbane"',                 expectKind: ['places-intake'] },
  { text: 'use places "dentist gold coast"',                       expectKind: ['places-intake'] },

  // ─── single-enrich ────────────────────────────────────────────
  { text: "Joe's Plumbing 0412345678 Sydney",                      expectKind: ['single-enrich'], requireArgFlags: ['--phone'] },
  { text: 'Acme Roofing +61 423 999 888 brisbane',                 expectKind: ['single-enrich'], requireArgFlags: ['--phone'] },
  { text: 'https://maps.app.goo.gl/abc123def',                     expectKind: ['single-enrich'], requireArgFlags: ['--gbp-url'] },
  { text: '"Test Business Name"',                                  expectKind: ['single-enrich'] },

  // ─── audit ────────────────────────────────────────────────────
  { text: 'audit place_chijwdbif2xzkwsrru6lkmu2l0o',               expectKind: ['audit'],         expectEntityKey: /place_/ },
  { text: '审计 place_chija7rmbn38k2srv29x1ubwqmg',                expectKind: ['audit'],         expectEntityKey: /place_/ },

  // ─── ops / unknown ────────────────────────────────────────────
  { text: 'health check',                                          expectKind: ['ops'] },
  { text: 'system status',                                         expectKind: ['ops', 'intake'] }, // ambiguous · LLM may guess intake

  // ─── edge cases ───────────────────────────────────────────────
  { text: '',                                                      expectKind: ['ops'],            note: 'empty input must not crash' },
  { text: 'asdfgh random nonsense',                                expectKind: ['ops', 'intake'],  note: 'gibberish · either ops or intake fallback' },
  { text: 'find roofers',                                          expectKind: ['intake'],         note: 'no city · should still route + flag null city' },
];

const summary = { cases: [], routerProvider: {} };

for (const c of CASES) {
  await r.assert(`route: "${c.text.slice(0, 50)}" → ${c.expectKind.join('|')}`, async () => {
    const out = await router.routeIntent({ text: c.text, attachments: [] });
    if (!out) throw new Error('no route returned');

    // Track which provider answered
    summary.routerProvider[out.provider] = (summary.routerProvider[out.provider] || 0) + 1;
    summary.cases.push({ text: c.text, kind: out.kind, provider: out.provider, args: out.args, conf: out.confidence });

    // Verify kind
    if (!c.expectKind.includes(out.kind)) {
      throw new Error(`kind=${out.kind} expected one of ${c.expectKind.join('|')} · provider=${out.provider}`);
    }

    // Verify required arg flags present
    if (c.requireArgFlags) {
      const present = (out.args || []).filter((a, i) => a.startsWith('--'));
      const missing = c.requireArgFlags.filter((f) => !present.includes(f));
      if (missing.length) {
        throw new Error(`args missing required flags: ${missing.join(',')} · got: ${JSON.stringify(out.args)} · provider=${out.provider}`);
      }
    }

    // Verify specific arg values
    if (c.expectArgValues) {
      for (const [flag, expected] of Object.entries(c.expectArgValues)) {
        const i = (out.args || []).indexOf(flag);
        const got = i >= 0 ? out.args[i + 1] : null;
        if (got !== expected) {
          throw new Error(`${flag}=${got} expected=${expected} · args: ${JSON.stringify(out.args)}`);
        }
      }
    }

    // Verify entity_key extracted
    if (c.expectEntityKey) {
      if (!out.target_entity_key || !c.expectEntityKey.test(out.target_entity_key)) {
        throw new Error(`target_entity_key=${out.target_entity_key} expected match ${c.expectEntityKey} · provider=${out.provider}`);
      }
    }

    return { provider: out.provider, args_count: (out.args || []).length };
  });
}

// Verify NO route has raw positional args (Bug A regression guard)
await r.assert('no route emits raw query as positional args', () => {
  const offenders = summary.cases.filter((c) => {
    const args = c.args || [];
    // detect positional (string that doesn't start with -- and isn't immediately after a --flag)
    let i = 0;
    while (i < args.length) {
      const a = String(args[i]);
      if (a.startsWith('--')) {
        // value position
        i += 2;
      } else {
        // positional · skip if entity-key or path
        if (a.startsWith('place_') || a.startsWith('image_') || a.includes('/')) {
          i += 1;
          continue;
        }
        return true;
      }
    }
    return false;
  });
  if (offenders.length) {
    throw new Error(`${offenders.length} cases emit positional args: ${offenders.slice(0, 2).map((o) => o.text).join(' · ')}`);
  }
  return { checked: summary.cases.length };
});

console.log(`\nRouter provider breakdown: ${JSON.stringify(summary.routerProvider)}`);

const s = r.summary({ summary });
process.exit(s.exitCode);
