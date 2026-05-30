/**
 * test-opencli-fetch.mjs · safety guards for the read-only OpenCLI adapter (codex R133).
 * Deterministic · no OpenCLI install needed. Proves the wrapper is a HARD boundary:
 * disabled-by-default · mode allowlist (read/extract only) · host allowlist · dedicated-profile required ·
 * fixed read-only argv (no mutation verbs) · graceful degrade when opencli absent.
 */
import assert from 'node:assert';
import { opencliFetch, buildBrowserArgv } from '../../core/enrichment/fetch/opencli-fetch.js';

let p = 0; const ok = (c, m) => { assert.ok(c, m); p++; };
const FORBIDDEN = ['click', 'fill', 'type', 'eval', 'screenshot', 'cookies', 'downloads', 'tabs'];

// 1 · disabled by default (env not set)
delete process.env.ENABLE_OPENCLI_FETCH;
let r = await opencliFetch({ url: 'https://facebook.com/acme', profile: 'leads' });
ok(r.ok === false && /disabled/.test(r.reason), 'disabled by default (no ENABLE_OPENCLI_FETCH)');

// 2 · enabled but mode not allowed → reject (never shells out)
process.env.ENABLE_OPENCLI_FETCH = '1';
r = await opencliFetch({ url: 'https://facebook.com/acme', profile: 'leads', mode: 'click' });
ok(r.ok === false && /mode not allowed/.test(r.reason), 'mutation mode (click) rejected');

// 3 · host not allowlisted → reject (no open browsing)
r = await opencliFetch({ url: 'https://example.com/anything', profile: 'leads', mode: 'read' });
ok(r.ok === false && /allowlist/.test(r.reason), 'non-allowlisted host rejected');

// 4 · no dedicated profile → reject (never the daily profile by accident)
delete process.env.AUTH_FETCH_PROFILE;
r = await opencliFetch({ url: 'https://linkedin.com/company/acme', mode: 'read' });
ok(r.ok === false && /profile/.test(r.reason), 'missing dedicated profile rejected');

// 5 · all guards pass but opencli absent → graceful degrade (no crash, ok:false)
r = await opencliFetch({ url: 'https://instagram.com/acme', profile: 'leads', mode: 'read' });
ok(r.ok === false && /opencli not installed|unavailable|failed/.test(r.reason), 'opencli absent → graceful degrade (ok:false), no crash');
ok(r.fetch_via === 'opencli', 'provenance fetch_via=opencli even on failure');

// 6 · buildBrowserArgv: read/extract emit ONLY safe argv, never a forbidden verb
for (const mode of ['read', 'extract']) {
  const argv = buildBrowserArgv({ profile: 'leads', session: 's', url: 'https://facebook.com/acme', mode });
  ok(argv[0] === '--profile' && argv[2] === 'browser' && argv[3] === mode, `argv shape for ${mode}`);
  ok(!argv.some((a) => FORBIDDEN.includes(String(a).toLowerCase())), `argv has no forbidden verb (${mode})`);
}

// 7 · buildBrowserArgv throws on a mutation mode (defence-in-depth)
let threw = false; try { buildBrowserArgv({ profile: 'leads', session: 's', url: 'x', mode: 'eval' }); } catch { threw = true; }
ok(threw, 'buildBrowserArgv throws on mutation mode (eval)');

// 8 · caller cannot inject extra args — only {profile,url,mode,session} are read; argv length fixed at 6
const argv = buildBrowserArgv({ profile: 'leads', session: 's', url: 'https://facebook.com/x', mode: 'read', click: 'evil', extraArgs: ['--danger'] });
ok(argv.length === 6 && !argv.includes('--danger') && !argv.includes('evil'), 'caller cannot inject extra args/verbs');

delete process.env.ENABLE_OPENCLI_FETCH;
console.log(`opencli-fetch: ${p} passed, 0 failed`);
