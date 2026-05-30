# OpenCLI Security Review — login-gated fetch adapter (PROVISIONAL audit record)

> **状态**: PROVISIONAL · codex Round 130/133 GO-with-mitigations · 2026-05-31. Audit record BEFORE enabling.
> **决定 (codex R133)**: **GO for a read-only adapter · NO-GO for any general browser-control integration.**
> **红线**: 这是借 operator 登录态浏览器的"辅助取页"——只读、独立 profile、最后手段、弱证据。绝不写入、不交互。

## Reviewed
- Repo: `github.com/jackwener/OpenCLI` · commit `c3d2fc1f9f4fefa2dfd243c942ae5b764ad81ab2` (2026-05-31) · npm `@jackwener/opencli` · Apache-2.0.
- Read: `extension/manifest.json` · `src/daemon.ts` · `scripts/postinstall.js` · `scripts/fetch-adapters.js` · `src/cli.ts` (browser cmds) · `extension/dist/background.js` (window create) · `PRIVACY.md` · deps.

## Findings
**Lower-risk than feared:**
- **No telemetry / phone-home** — PRIVACY.md states none; code `telemetry` hits only FILTER analytics noise out of captured traffic (not send).
- **Daemon localhost-only** (`localhost:19825`) with origin check (rejects non `chrome-extension://`) + required `X-OpenCLI` header.
- **Isolated automation windows** — extension `chrome.windows.create()` opens windows SEPARATE from normal browsing (matches PRIVACY.md) → does not disrupt the operator's daily browser.
- **No install-time remote fetch** — `fetch-adapters.js` COPIES adapters from the installed package's bundled `clis/` dir (version+hash guarded); no hardcoded URLs. `postinstall.js` installs shell completions only. So install-time code = the pinned npm tarball (reviewable).
- Small deps: undici, ws, commander, js-yaml, @mozilla/readability, turndown.

## Accepted residual risks (documented)
1. **HIGH extension capability**: manifest perms = `debugger, tabs, cookies, activeTab, alarms, storage, tabGroups, downloads` + host `<all_urls>`. `debugger` = full CDP; `cookies` = read all site cookies (domain-scoped). PRIVACY.md says cookies never written/transmitted, but the capability exists → trust depends on code-behaves + no supply-chain compromise. **Contained by mitigation #3 (dedicated profile blast-radius).**
2. **Weak local daemon auth**: localhost + origin + `X-OpenCLI` header, NO token → any LOCAL process on the machine could drive the daemon. **Accepted** for a single-operator Mac (codex R133). Re-evaluate if long-lived daemon or multi-user machine.

## Required mitigations (gate conditions · must hold to enable)
1. **Pin exact version** `@jackwener/opencli@<exact>` + lockfile. Upgrade = re-review diff + re-run smoke + update this doc's commit.
2. **Install `--ignore-scripts`** by default (postinstall benign but pin behavior; review per version if scripts run).
3. **Dedicated low-blast-radius Chrome profile** — ONLY the needed social logins (FB/IG/LinkedIn). NEVER the operator's daily / payment / email profile. Profile dir outside repo, private perms, one-click deletable (revoke).
4. **Read-only wrapper** `core/enrichment/fetch/opencli-fetch.js` — positive allowlist `{profile,url,mode∈read|extract}`; builds the exact safe argv internally; rejects click/fill/type/eval/screenshot/cookies/downloads/tabs/raw-args. **Safety tests must prove mutation/control paths are rejected before any production wiring.**
5. env-gated OFF (`ENABLE_OPENCLI_FETCH=1`), allowlist FB/IG/LinkedIn hosts, search-found URLs only, last-resort after tinyfish blocked/thin, 3-6/min, ledger (domain/url/time/status — no secrets), output = WEAK supporting evidence only (never standalone identity proof).

## NO-GO conditions (do NOT enable if)
- The wrapper safety tests don't pass (mutation/control reachable).
- Running on a shared/multi-user machine without per-session daemon auth.
- Using the operator's daily/full Chrome profile.
- Unattended/CI without explicit `ALLOW_AUTH_FETCH_IN_CI=1` + device check.
- A version upgrade not re-reviewed.

## Operator setup (manual · before enable)
1. `npm i -g @jackwener/opencli@<pinned>` (or `--ignore-scripts`), install the Browser Bridge extension into a **dedicated Chrome profile**.
2. Log into ONLY the needed socials in that profile. `opencli profile rename <id> leads` · `opencli --profile leads browser state` to verify.
3. Set `ENABLE_OPENCLI_FETCH=1` + `AUTH_FETCH_PROFILE=leads` only when running a fetch batch; unset otherwise.

## Build order (codex R133)
gate PASS (this) → build read-only adapter + safety tests → operator install+profile → 1 real-page smoke → expand page gold set → clearance → wire #8. **Do NOT wire into production enrichment until the wrapper safety tests pass.**
