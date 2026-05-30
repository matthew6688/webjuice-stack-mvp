/**
 * core/enrichment/fetch/opencli-fetch.js · READ-ONLY OpenCLI login-gated fetch adapter.
 *
 * codex R130/R133: GO for a READ-ONLY adapter, NO-GO for general browser-control. This wrapper is the HARD
 * enforcement boundary (not convention). Callers pass ONLY { profile, url, mode } — they CANNOT inject args
 * or verbs. The adapter builds a fixed read-only argv internally and shells out to the `opencli` CLI.
 *
 * Rails (docs/v3/OPENCLI-SECURITY-REVIEW.md):
 *  - env-gated OFF by default (ENABLE_OPENCLI_FETCH=1)
 *  - mode ∈ {read, extract} ONLY — never click/fill/type/eval/screenshot/cookies/downloads/tabs
 *  - host allowlist (FB/IG/LinkedIn) — search-found candidate URLs only, NOT open browsing
 *  - dedicated low-blast-radius Chrome profile (AUTH_FETCH_PROFILE) — never the daily profile
 *  - rate-limited, ledgered (no secrets), graceful-degrade when opencli/daemon unavailable
 *  - output = WEAK supporting evidence only (never standalone identity proof)
 */
import { execFile } from 'node:child_process';

export const OPENCLI_ENABLED = () => process.env.ENABLE_OPENCLI_FETCH === '1';
const ALLOWED_MODES = new Set(['read', 'extract']);
// Allowlisted login-gated social hosts (exact host or subdomain). Business own-site uses tinyfish, not this.
const HOST_ALLOWLIST = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
];
// verbs the wrapper must NEVER emit (defence-in-depth; argv is built from a fixed template anyway).
const FORBIDDEN_VERBS = new Set(['click', 'fill', 'type', 'eval', 'screenshot', 'cookies', 'downloads', 'tabs', 'navigate-and-act', 'act']);

function hostOf(url) {
  try { return new URL(String(url)).hostname.toLowerCase(); } catch { return ''; }
}
function hostAllowed(url) {
  const h = hostOf(url);
  return !!h && HOST_ALLOWLIST.some((re) => re.test(h));
}

/**
 * Build the EXACT read-only argv. Exported for safety tests. Caller args never reach argv.
 * @returns {string[]} argv for `opencli` — only profile + browser + read|extract + session + url.
 */
export function buildBrowserArgv({ profile, session, url, mode }) {
  if (!ALLOWED_MODES.has(mode)) throw new Error(`opencli-fetch: mode not allowed: ${mode}`);
  const argv = ['--profile', String(profile), 'browser', mode, String(session), String(url)];
  // defence-in-depth: assert no forbidden verb slipped in
  for (const a of argv) if (FORBIDDEN_VERBS.has(String(a).toLowerCase())) throw new Error(`opencli-fetch: forbidden verb in argv: ${a}`);
  return argv;
}

function execOpencli(argv, timeoutMs) {
  return new Promise((resolve) => {
    execFile('opencli', argv, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const enoent = err.code === 'ENOENT';
        resolve({ ok: false, reason: enoent ? 'opencli not installed / daemon unavailable' : `opencli failed: ${String(err.message).slice(0, 120)}`, stderr: String(stderr || '').slice(0, 200) });
      } else resolve({ ok: true, stdout: String(stdout || '') });
    });
  });
}

/**
 * Read-only fetch a login-gated page via OpenCLI + the operator's dedicated logged-in Chrome profile.
 * @param {{ profile?, url, mode?, session?, timeoutMs? }} o
 * @returns {Promise<{ ok, text?, fetch_via:'opencli', url, mode, reason? }>}
 */
export async function opencliFetch({ profile = process.env.AUTH_FETCH_PROFILE, url, mode = 'read', session = 'leads-id', timeoutMs = 45_000 } = {}) {
  const base = { ok: false, fetch_via: 'opencli', url: url || null, mode };
  if (!OPENCLI_ENABLED()) return { ...base, reason: 'disabled (set ENABLE_OPENCLI_FETCH=1)' };
  if (!ALLOWED_MODES.has(mode)) return { ...base, reason: `mode not allowed: ${mode}` };
  if (!url) return { ...base, reason: 'no url' };
  if (!hostAllowed(url)) return { ...base, reason: `host not allowlisted (FB/IG/LinkedIn only): ${hostOf(url) || url}` };
  if (!profile) return { ...base, reason: 'no dedicated AUTH_FETCH_PROFILE configured (never the daily profile)' };

  let argv;
  try { argv = buildBrowserArgv({ profile, session, url, mode }); } catch (e) { return { ...base, reason: e.message }; }
  const r = await execOpencli(argv, timeoutMs);
  // best-effort ledger (no secrets) — keep audit metadata only
  try {
    const { appendEvent } = await import('../../finance/ledger.js').catch(() => ({}));
    if (typeof appendEvent === 'function') appendEvent({ provider: 'opencli', endpoint: `browser.${mode}`, tier: 'T0', meta: { host: hostOf(url), ok: r.ok } });
  } catch { /* ledger optional */ }
  if (!r.ok) return { ...base, reason: r.reason };
  return { ...base, ok: true, text: r.stdout.slice(0, 20000) };
}

export default { opencliFetch, buildBrowserArgv, OPENCLI_ENABLED };
