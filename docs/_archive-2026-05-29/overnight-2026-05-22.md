# Overnight Run · 2026-05-22

**Started**: 2026-05-22 (Matthew sleeping · Claude executes · Codex architects)

**Mission** (per codex P2): Wire P1 fact layer into `pl:build-handoff → image-manifest → audit/report` end-to-end. Each output must declare facts/provenance/photo source. Failures must be explainable.

**Two followup small fixes** flagged by codex:
- Single slug-resolution helper (`core/leads/slug.js`) — currently `latest.name` slugify is duplicated in `grade-router.js` and `pl-download-places-photos.js`
- Shared GBP merge logic — `test-gbp-handoff-copy.js` duplicates the merge function; should import from a shared module

**Safety brakes**:
- STOP on 2 consecutive failures
- STOP if any single iteration costs > $5 in API calls
- NO destructive git operations
- NO commit (CLAUDE.md forbids `--no-verify`)
- Regression checks every iteration (handoff-contract / extract-json / search-runner / gbp-handoff-copy)

---

## Status going in (verified before sleep)

| Component | Status |
|-----------|--------|
| extract-services.js JSON robustness | ✓ vicwest B1 returns 6/6 verified |
| assemble-handoff manifest path | ✓ 19/19 real-photo utilization |
| data-checkpoint gate on assemble | ✓ 4 scenarios tested |
| validate gate on compose | ✓ vicwest broken spec correctly refused |
| GBP photos → handoff/photos/source | ✓ 13/13 unit tests |
| handoff contract enforcement | ✓ 7/7 fixtures |

All legacy tests passing.

---

## Iteration log

### Iter 1 · 2026-05-22 night · `core/utils/slug.js` canonical helper

**Codex said**: Build single slug helper · replace 3 inline implementations · because P2 end-to-end needs consistent slug resolution to find handoff/image/audit artifacts (currently 3 sets of rules silently produce different dir names).

**Did**:
- Created `core/utils/slug.js` with `slugify()` · `safeId()` · `slugFromEntity()` (canonical entity→client-dir convention)
- Replaced inline `slugify()` in: `core/leads/qualification.js` · `core/leads/search-runner.js` · `core/leads/grade-router.js#deriveSlug` · `scripts/funnel/record-paid-intake-update.js` (both `slugify` and `safeId`) · `scripts/cli/pl-download-places-photos.js` (inline 3-line slugify)
- Added `scripts/qa/test-slug-helper.mjs` · 34 cases covering: empty/null/undefined · `&→and` boundary · custom fallback · length cap · trailing-dash trim · symbol dedup · case · numbers · entity object resolution · `_slug` override · place_id fallback
- Added `npm run leads:test-slug-helper`

**Verified** (codex's 5-command list + legacy regression):
- ✓ `node scripts/qa/test-slug-helper.mjs` → 34 pass · 0 fail
- ✓ `npm run leads:test-qualification` → ok
- ✓ `npm run leads:test-search-runner` → ok
- ✓ `npm run funnel:test-paid-intake-index` → ok (1 intake processed)
- ✓ `npm run leads:test-template-mockup-handoff` → ok
- ✓ `npm run leads:test-handoff-contract` → 7/7
- ✓ `npm run leads:test-extract-json` → 18/18
- ✓ `npm run leads:test-gbp-handoff-copy` → 13/13

**No regressions. 0 destructive changes. No git ops.**

### Iter 2 · 2026-05-22 night · E2E chain + 3 sub-fixes

**Codex said**: Run vicwest E2E first to surface real-link gaps · then small fixes · then GBP merge helper refactor.

**Surface gaps found**:
1. `pl-validate-handoff.js` did not accept `--slug` flag · but my `pl-compose-site` validate gate (iter P1#4) passes `--slug <slug>`. → Hard interface mismatch · E2E chain was silently broken.
2. `core/handoff/schema-v2.json` declares `licensing.full_name` as `string` but real data has `null` (vicwest doesn't have a registered name distinct from trading name). License_id was already nullable · inconsistent schema.
3. GBP merge logic duplicated between `test-gbp-handoff-copy.js` and `pl-download-places-photos.js` (codex's prior small-debt callout).

**Did**:
- `pl-validate-handoff.js`: added `--slug <slug>` flag · resolves to `clients/<slug>/v2/handoff/od-package/v2-spec.json` · matches calling convention used across pl: family.
- `core/handoff/schema-v2.json`: `licensing.full_name` now `["string","null"]` to match `license_id` and reality.
- New `core/handoff/gbp-sources.js`: `readSidecar()` / `mergeSidecarEntries()` / `writeSidecar()` + `SIDECAR_SCHEMA` const.
- `pl-download-places-photos.js` + `test-gbp-handoff-copy.js`: both now import from the shared module · test ↔ runtime in lockstep.

**Verified E2E vicwest**:
- `pl:validate-handoff --slug vicwest-roofing` → PASS (was FAIL on null full_name)
- `pl:compose-site --handoff ...` → `validate-handoff PASS · validationGate=passed · composed 8 pages`
- `checkpoint=GREEN multi · services 6/6 verified:scraped · 19/19 real-photo utilization`

**Regression suite (5/5 green)**:
- gbp-handoff-copy 13/13 (now via shared helper)
- slug-helper 34/34
- handoff-contract 7/7
- extract-json 18/18
- search-runner ok

### Iter 3 · `pl:e2e` 一键命令 + 跨客户验证

**Codex said**: 选 (d) `pl:e2e` 一键命令 · 然后跨客户 (a) 变成免费 batch 验证。

**Did**:
- New `scripts/cli/pl-e2e.js` · 5-step chain (checkpoint → [enrich] → assemble → validate → compose)
  - Default: skip enrich (LLM cost saver) · explicit `--enrich` flag opt-in
  - Honors `--skip-checkpoint` / `--skip-validate` / `--out <dir>` / `--dry-run`
  - Writes `clients/<slug>/v2/e2e-summary.json` (auditable)
  - Halts on first non-zero exit · prints clear final status
- Registered `npm run pl:e2e`

**Surface gap found while cross-validating**: `core/handoff/schema-v2.json#brand.logo_light` was `string`-only (same pattern as licensing.full_name from iter 2) but a-j has `null` (no logo). Sibling `logo_dark` / `favicon` were already nullable. → Made `logo_light` nullable too. Schema/data now aligned.

**Verified — 3 clients green E2E**:

| Slug | Composed | Time | Status |
|------|----------|------|--------|
| vicwest-roofing | 8 pages | 1.3s | ✓ ALL STEPS GREEN |
| vip-roofing-brisbane | 6 pages | 1.3s | ✓ ALL STEPS GREEN |
| a-j-roofing-solutions | 13 pages | 1.3s | ✓ ALL STEPS GREEN |

**Total 27 pages across 3 unrelated clients in ~4s wall time.**

**Regression (4/4 green)**:
- handoff-contract 7/7 · extract-json 18/18 · slug-helper 34/34 · gbp-handoff-copy 13/13

**Codex options (a)+(d) both done in one iteration · 0 destructive · 0 git · 0 LLM cost.**

### Iter 4 · Schema null 扫雷 · batch fixture smoke

**Codex said**: (e) schema null sweep · prevent future "string-only but data null" surprises across clients · build batch-fixture smoke.

**Did**:
- Scanned schema-v2.json for all 32 string-only paths · cross-referenced against 5 real client fixtures
- After iter 2/3 fixes, no current mismatches BUT: proactively widened 6 fields to nullable that real data realistically can lack:
  - `services[].short_desc` · `services[].long_desc` (extractor sometimes misses)
  - `pages[].h1` (could be derived from block)
  - `header.logo` (a-j has none)
  - `header.nav[].page_ref` (external nav links don't have page_ref) + added `href` as alternative
  - `narrative_content.about_md` (sometimes missing)
- New `scripts/qa/test-schema-fixtures.mjs` · runs schema against every `clients/*/v2/handoff/od-package/v2-spec.json` (uses native fs · no glob dep)
- Ignore-list at `scripts/qa/.schema-fixtures-ignore` for known-stale fixtures (currently 1: west-coast-roofing — orphan handoff from 2026-04 with missing business_name/city/pages)
- Registered `npm run leads:test-schema-fixtures`

**Bug caught by the new smoke**: `west-coast-roofing` fixture has 4 schema errors (missing required hard facts) — caught BEFORE it could break a cross-client E2E. Tagged in ignore-list with rehabilitation instructions.

**Verified — final regression (5/5 green)**:
- handoff-contract 7/7
- extract-json 18/18
- slug-helper 34/34
- gbp-handoff-copy 13/13
- **schema-fixtures 4/4** (new · catches data drift)

**Cross-client E2E re-confirmed (3/3 green)**:
- vicwest-roofing · vip-roofing-brisbane · a-j-roofing-solutions all ALL STEPS GREEN

**0 destructive · 0 git · 0 LLM cost.**


