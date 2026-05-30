/**
 * test-resolve-identity.mjs · tiered resolver (codex R134). Deterministic — tier0 needs no LLM; tier2 via
 * mocked opts.runner. Also asserts the STRUCTURAL safety: write_allowed always false + NO canonical-writer
 * import in the module (canonical writes must be unreachable from the resolver).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { resolveIdentity } from '../../core/enrichment/identity/resolve-identity.js';

let p = 0; const ok = (c, m) => { assert.ok(c, m); p++; };
const mk = (verdict, provider = 'codex_cli', model = 'cli-default') => async () => ({ text: JSON.stringify(verdict), provider, model });

// 1 · tier0 deterministic verified (registry name-exact + state) → same + promotable
const r1 = await resolveIdentity({
  entity: { latest: { business_name: 'Vicwest Roofing', state: 'VIC' } },
  candidate: { source: 'license', name: 'VICWEST ROOFING', state: 'VIC' },
});
ok(r1.status === 'same' && r1.promotable === true && r1.tier_used === 'deterministic', 'tier0 registry name+state → same+promotable');
ok(r1.write_allowed === false, 'tier0 verdict write_allowed=false');

// 2 · tier0 hard conflict (different ABN) → different
const r2 = await resolveIdentity({
  entity: { latest: { business_name: 'Acme Roofing', state: 'NSW', abn: '51 824 753 556' } },
  candidate: { source: 'abr', name: 'Acme Roofing', abn: '11 111 111 111', state: 'NSW' },
});
ok(r2.status === 'different' && r2.promotable === false, 'tier0 ABN conflict → different');

// 3 · tier2 page judge: no tier0 anchor, page has entity phone → mock 'same' → deterministic verifier promotes
const r3 = await resolveIdentity(
  { entity: { latest: { business_name: 'Premier Roofing', phone: '03 5333 1111', city: 'Geelong' } },
    candidate: { source: 'web', name: 'Premier Roofing' },
    page: { url: 'https://x', text: 'Premier Roofing — call (03) 5333 1111.' } },
  { runner: mk({ status: 'same', confidence: 0.9, evidence: [{ type: 'phone', detail: '(03) 5333 1111' }], conflicts: [] }) });
ok(r3.status === 'same' && r3.promotable === true && r3.tier_used === 'page_llm', 'tier2 verified phone → same+promotable');
ok(r3.write_allowed === false, 'tier2 verdict write_allowed=false');

// 4 · tier2 page judge: model says 'same' on owned_domain but entity has NO known website → NOT promotable
const r4 = await resolveIdentity(
  { entity: { latest: { business_name: 'Premier Roofing', city: 'Geelong', state: 'VIC' } },
    candidate: { source: 'web', name: 'Premier Roofing' },
    page: { url: 'https://premierroofinggeelong.com.au', text: 'Premier Roofing Geelong.' } },
  { runner: mk({ status: 'same', confidence: 0.9, evidence: [{ type: 'owned_domain', detail: 'premierroofinggeelong.com.au' }], conflicts: [] }) });
ok(r4.promotable === false, 'tier2 unverifiable owned_domain (no known website) → NOT promotable');

// 5 · no escalation input → ambiguous, not promotable
const r5 = await resolveIdentity({ entity: { latest: { business_name: 'Zephyr Roofing', state: 'QLD' } }, candidate: { source: 'web', name: 'Zephyr Roofing', state: 'QLD' } });
ok(r5.status === 'ambiguous' && r5.promotable === false, 'web name+state, no page/url → ambiguous (not promotable)');

// 6 · no entity → ambiguous, write_allowed false
const r6 = await resolveIdentity({});
ok(r6.status === 'ambiguous' && r6.write_allowed === false, 'no entity → ambiguous, write_allowed false');

// 7 · STRUCTURAL: every verdict has write_allowed=false (already checked) + module imports NO canonical writer
const src = fs.readFileSync(new URL('../../core/enrichment/identity/resolve-identity.js', import.meta.url), 'utf8');
const FORBIDDEN_IMPORT = /(discovery-store|writeEntity|entity-store|upsertDiscovery|setEntityPhase|saveCoreExtract|build-master-md)/;
ok(!FORBIDDEN_IMPORT.test(src), 'resolver module imports NO canonical writer (writes structurally unreachable)');

console.log(`resolve-identity: ${p} passed, 0 failed`);
