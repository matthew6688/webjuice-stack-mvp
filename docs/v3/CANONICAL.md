# CANONICAL · ProfitsLocal Production Standard · v1.4 · 2026-05-29

> **PURPOSE**: single master index of "what is the current best · don't deviate without proof". Future agents read this FIRST · stop drifting into deprecated paths.
>
> **TRIGGER**: every new session · every "should I rebuild X?" question · every "what's the canonical Y?" question.
>
> **STATUS**: v1.4 · locked by 15 codex consensus rounds (R26-R42 + R-BA-6) + Matthew approvals. Lead-capture E2E working (vicwest-roofing-test.pages.dev verified).
>
> **RULE**: anything NOT in this doc as "locked" is provisional · explore freely. Anything LOCKED here cannot be replaced without (a) empirical evidence beating it by the re-test trigger threshold AND (b) codex sign-off in a new consensus round.

---

## §0 · Master state · 2026-05-29

| Decision | Locked Value | Source-of-truth doc | Re-test trigger |
|---|---|---|---|
| **Render path** | `pl:compose-editorial` (V1 · template + Mustache · deterministic · $0) | `CANONICAL-DECISION-RECORD-RENDER-PATH.md` | Need ≥5pt audit composite gain AND token-coverage parity (≥80) AND ≤3pt variance across 5 runs |
| **Canonical templates** | 2 inventoried · `editorial-newsletter` (warm editorial · 91/89/93 avg 91) AND `trade-classic` (safe navy/amber AU-trade · 84/82/87 avg 84.3) · single-page only | `template.html` per family + `docs/v3/SOP-TEMPLATE-INVENTORY.md` for adds | New template add = SOP run · ≥80 composite on all 3 calibration clients |
| **Audit standard** | SOP-AUDIT-STANDARD-V2 · 5 P0 capabilities + mobile veto + fast/premium tier | `SOP-AUDIT-STANDARD-V2.md` (618 lines) | Need codex round signoff on new weights/dims · v3 frozen as legacy_baseline |
| **Brief schema** | `clients/<slug>/v2/single-page-brief.yaml` · validated by `pl:validate-single-page-brief` | `core/handoff/single-page-brief-schema.js` (12 cross-field constraints) | Schema change = codex round |
| **Skills layer** | pl-au-trade-voice · pl-local-trade-page-spec · pl-audit-rubric (3 PL skills · build-artifact pattern) | `skills/*/SKILL.md` + `<skill>.json` build outputs | Add new skill = codex round + CLAUDE.md §7 existing-work check first |
| **Persona model** | 4 segments (urgent-repair · planned-upgrade · commercial-maintenance · guided-first-time-buyer) | `core/audit/personas/*.js` · default primary = planned-upgrade | Add 5th persona (insurance-claim deferred to Phase B+) = codex round |
| **Brand kit** | `clients/<slug>/v2/handoff/od-package/brand/` (8-9 logo SVG variants + brand-tokens.css) | `brand-spec.json` per client | Phase 1 brand-kit pipeline canonical |
| **Image library** | `templates/roofing/stock-library/` · 78 files · 7 slots · manifest-tracked | `_manifest.json` + IMAGE-PROMPTS-V1/V2/V3 | Add by IMAGE-PROMPTS-VN workflow only |
| **Niche scope** | **Roofing only** (Phase B) | Matthew 2026-05-28 lock | Phase C expansion = electrician/plumber after 5+ roofer clients live |
| **Mobile gate** | Hybrid veto (M1.1-1.3 mechanical = VETO · M1.4-5 vision = scored into design P0) | SOP-AUDIT-STANDARD-V2 §4 | Hard rule for AU local-trade |
| **Render multi-page** | NOT supported in Phase B · single-page editorial-newsletter only | Matthew 2026-05-28 lock | Phase C+ when single-page market validated |
| **YELLOW back-fill merge** | `core/handoff/merge-inferred.js` (shared helper · provenance-tagged) consumed by `pl-compose-editorial` AND `pl-build-od-seed` | Codex R37 Q-RR-3 (b) · 2026-05-29 | Add new consumer = read this helper · don't fork |
| **Deep core extract** | `buildCoreExtract` in `core/audit/redesign-brief-builder.js` (fuses GBP + crawl + reviews + tinyfish mentions + images + master.md into 1 core-extract.json) | Recovered from stash 2026-05-29 (R37) · was lost in phaseA-step0 stash | Schema change = codex round |
| **Empty contact-field rendering** | Template MUST guard `{{#client.email}}…{{/client.email}}` etc · empty hrefs cause M1.3 tap-target vetos | Template lesson 2026-05-29 (R37 side-effect) | Add any new contact-row → wrap in conditional |
| **Template inventory SOP** | New template family entry = follow `docs/v3/SOP-TEMPLATE-INVENTORY.md` 7-stage process · ≥80 composite on all 3 calibration clients (vicwest/a-j/mark-squire) before inventory | Codex R38 Q-SS-1..7 · SOP doc + trade-classic reference run | New stage / new gate = update SOP via codex round |
| **Composer template dispatch** | `pl:compose-editorial --template <name>` flag · default `editorial-newsletter` · template path `templates/roofing/<name>/template.html` | Codex R38 Q-SS-2 (a) · 2026-05-29 | Promote to template-registry pattern only when ≥1 template needs pre-render hooks (R38 Q-SS-2 c) |
| **Brand-tokens injection placement** | `{{{brand_tokens_css_inline}}}` MUST be inside `<style>...</style>` block · D2.5 brand palette audit reads hex via `<style>...</style>` regex | Trade-classic 2026-05-29 calibration · D2.5 found=[] when placed outside style | Move outside = audit immediately drops 11+pt |
| **a-j brand-tokens canonical path** | Every client must have `clients/<slug>/v2/handoff/od-package/brand/brand-tokens.css` · NOT only at `v2/brand/` | a-j fix 2026-05-29 · editorial-newsletter score 83→89 (+6pt) | Composer fallback path = future enhancement |
| **Copy-builders dispatch** | `core/handoff/copy-builders.js` · `buildCopy(profile, normalizedFacts, extras)` returns section copy per profile (editorial / direct) · pure functions · sentence-grouped paragraphs · NO invented per-client facts | Codex R40 Q-VV-1 B + Q-VV-5 b · 2026-05-29 | Add new profile = add to `buildCopy` dispatch + audit-test fixtures |
| **Anti-hallucination guards** | `yearFounded` → null when unverified (no '2003' default) · `warranty_years_verified` → null = generic clause (no '10-year' default) · `suburbs_verified` ONLY (not merged inferred) for coverage claims · NO hardcoded client-specific phrasing in copy builders | Codex R40 3rd-pass Q-XX-1+Q-XX-2 SHIP-blocker fixes · 2026-05-29 | Any new claim in copy = MUST derive from normalized facts · violation = release blocker |
| **Gallery DOM contract (R-BA-6)** | `.gallery-pair__slider` with `[data-ba-slider]` · clip-path on `.gallery-pair__img--after` via `--pos` CSS var · `.gallery-pair__handle` with `↔` icon · 4 pairs in 2×2 grid · pointer + keyboard drag · NOT static 2-column compare | Matthew req 2026-05-29 (R-BA-6 commitment cde3043d finally implemented) | Static compare = ship blocker per §11 anti-pattern 12 |
| **Client form → email** | Every client website MUST have a contact form posting to `/api/client-contact` · `functions/api/client-contact.ts` Resend handler · per-project env `RECIPIENT_EMAIL`+`RESEND_API_KEY`+`FROM_EMAIL` set via `pl:cf-env-bootstrap` · 5 fields (name/email/phone required · service/message optional) · NO Cloudinary · NO hidden tracking (free tier) · SMTP override deferred to paid tier | Codex R42 2026-05-29 + verified test send (Resend ID 025bd657-... + curl test OK) | Hidden fields / SMTP = paid-tier upgrade · don't add free |
| **CF Pages publish · functions whitelist** | `pl:publish-dir --with-functions` ONLY copies `functions/api/client-contact.ts` + `wrangler.toml` to stage · NEVER `functions/admin/*` or `functions/api/contact.ts` (those are ProfitsLocal main site only) | Codex R41 Q-YY-1 caution · prevent attack surface exposure | Adding new whitelist entry = codex round |
| **Resend domain status** | `hello@fengtalk.ai` verified (sending OK) · `profitslocal.com` added 2026-05-29 (DKIM/SPF DNS in CF Cloudflare · status pending → verified within 30min) | Resend domain dashboard | When verified · update FROM_EMAIL default to `leads@profitslocal.com` in `pl-cf-env-bootstrap.js` |

---

## §1 · Deprecated paths (DO NOT REVIVE without re-test trigger)

| Path | Why deprecated | Re-test trigger | Evidence doc |
|---|---|---|---|
| **OD (Open Design daemon)** | 13 overnight variants · 0/13 hit ≥85 · vicwest best 72 · cross-client collapse 51-56 · Mac daemon · 9× cost · 3× slower | OD goes cloud-portable AND ≥85 baseline AND ≤±5pt cross-client AND ≤$0.15/render | `PATH-A-OD-TESTED-NOT-ADOPTED.md` |
| **Path C · LLM whole-page render** (`pl:render-llm-page`) | Mean 85.5 vs V1 91 · 11pt variance · CSS token depth -71pt · premium leak-free 20 vs V1 100 · 50% mobile veto | New LLM model AND ≥10pt D2.10 gain AND ≥80 D2.BC6 token coverage AND ≤3pt variance across 5 runs | `experiments/3path-experiment-2026-05-28/RESULTS.md` |
| **V2 module library** (`pl:compose-site`) | "OK but not great" baseline · D2.5 brand palette 33 vs V1 100 · uses generic house SVG not real brand logo · supplanted by editorial-newsletter | If a RED client must render without checkpoint passing · V2 = fallback (composer refuses RED) | Audit baselines in calibration doc |
| **OD overnight greedy search** | 2-hour run · $14 · 13 variants · 0 ≥85 | Same as OD above | `experiments/od-master-2026-05-20T01-56-51-270/` |
| **`templates/roofing/families/`** (classic-premium-roftix · editorial-bold-commercial · industrial-trade-credible · lead-capture-restoration · productized-modern-roofing) | 5 OD daemon output dirs · static dead HTML · not parameterized · ~200 files | OD revival OR specific family becomes desired aesthetic AND someone re-slot-fills via SOP-TEMPLATE-INVENTORY | `_deprecated-2026-05-29/families/` |
| **`brand-grid-experiment/`** (Phase 3 MVP) | Intermediate 3-client brand-injection test outputs · superseded by editorial-newsletter canonical | None planned | `_deprecated-2026-05-29/brand-grid-experiment/` |
| **`single-page-library/t1-tradeauthority/`** | 1108-line dead HTML · superseded by V0-V4 _compare set + trade-classic inventoried template | None planned | `_deprecated-2026-05-29/t1-tradeauthority/` |
| **`templates/roofing/modules/`** (V2 composer module library) | Deprecated per CANONICAL §1 V2 module library row · pl-compose-site is deprecated · pl-compose-editorial is canonical | Same as V2 module library | `_deprecated-2026-05-29/modules-v2-composer-library/` |
| **`dissection/`** (early weatherproof template wireframe extraction) | Early Phase A artifact · superseded by editorial-newsletter direct template | None planned | `_deprecated-2026-05-29/dissection/` |
| **V5/V6/V7 OD variants in `_compare/`** | OD daemon outputs (editorial · bento · warm-editorial) · OD already deprecated | OD revival | `_deprecated-2026-05-29/v{5,6,7}-od-*/` |

---

## §2 · Canonical pipeline · 7 stages (single-page · roofing)

```
DISCOVERY → ENRICHMENT → BRIEF → WIREFRAME → RENDER → AUDIT → OUTREACH
```

**Writer per artifact (CLAUDE.md §6 SSOT writer-check):**

| Stage | Canonical artifact | Writer CLI | Reader CLI(s) |
|---|---|---|---|
| DISCOVERY | `data/leads/entities/<id>.json` | `pl:lead-discovery` + `pl:scrape-docker` | `pl:lead-filter` |
| ENRICHMENT | `clients/<slug>/v2/handoff/od-package/facts.json` + `multi-page-crawl/` + `handoff/photos/source/` + `handoff/photos/selected.json` | `pl:enrich-entity` + `pl:places-enrich` + `core/handoff/classify-images.js` (vision LLM) | composer |
| BRIEF | `clients/<slug>/v2/core-extract.json` + `master.md` + `single-page-brief.yaml` + `checkpoint.json` (RED/YELLOW/GREEN) | `pl:llm-extract-core` + `pl:core-extract-to-md` + `pl:data-checkpoint` | composer · audit |
| WIREFRAME (optional · V5 opt-in) | `clients/<slug>/v2/wireframes/wireframe-home-<llm>.json` | `pl:llm-page-copywriter` (persona-aware) | composer (with `--use-wireframe`) |
| RENDER | `clients/<slug>/v2/editorial-output/index.html` + skills-usage-trace + assets/ | **`pl:compose-editorial` (V1 CANONICAL)** | audit |
| AUDIT | `editorial-output/audit-v4-{full,issues,summary}.json` + site-report (Phase B Step 7) | `pl:audit-v4 --tier fast|premium` | publish gate |
| OUTREACH | Phase C · out of scope for Phase B | — | — |

**Hard rule**: every canonical artifact has ONE writer. New artifact type proposal = CLAUDE.md §7 existing-work-discovery 5-look mandatory.

---

## §3 · Quality gates (production ship · per client · ORDERED HIERARCHY)

> **Critical update 2026-05-28 (codex R35 Q-PP-1 + Q-PP-5)**: gates are HIERARCHICAL · failures higher in the list HARD-BLOCK · audit-v4 returns `composite: "N/A_BLOCKED"` when any blocker fails. Do NOT show 93/99 scores for empty/RED content (was a real audit-gaming risk discovered when abc-roof-restoration RED scored 99 with 0 services).

### Hierarchical ship gate · stop at first failure

```
GATE 1 · CHECKPOINT (HARD · cannot bypass for production)
  checkpoint.json verdict = GREEN → continue
  checkpoint.json verdict = YELLOW → continue ONLY if rendered HTML has visible PREVIEW banner
  checkpoint.json verdict = RED → BLOCKED · composite = "N/A_BLOCKED" · DO NOT SHIP
  --skip-checkpoint flag = DEV/DEBUG ONLY · production renders must not bypass

GATE 2 · BRIEF (HARD when GREEN)
  single-page-brief.yaml exists AND passes pl:validate-single-page-brief
  (when checkpoint=GREEN · brief.yaml is required)
  → continue
  Fail → composite = "N/A_BLOCKED" · need brief.yaml

GATE 3 · MINIMUM CONTENT SIGNAL (HARD)
  services_rendered >= 3 (count of services-grid story cards)
  AND suburbs_rendered >= 5 (count in coverage section)
  AND (real_review_count >= 1 OR placeholder banner visible AND real_count_referenced_in_disclaimer)
  Fail → composite = "N/A_BLOCKED" · content too thin · need enrichment

GATE 4 · M1 MOBILE MECHANICAL (HARD · separate from composite)
  M1.1 viewport overflow-x at 390px = 0
  M1.2 sticky CTA visible at mobile
  M1.3 critical tap targets ≥ 44×44px (excludes incidental UI)
  Any failure → composite = "M1_VETO" · NOT shippable

GATE 5 · FAST-TIER AUDIT
  T1 mechanical PASS
  T2 brand contract ≥ 80
  T4d voice ≥ 90
  D2.14 proof variety ≥ 60 (≥3 of 6 types)
  D2.11 facts cross-check ≥ 90 (when brief.yaml present)
  composite ≥ 80
  Fail → FIX_LOOP (max 3 iterations via pl:iterate-site)

GATE 6 · PREMIUM-TIER AUDIT (production ship gate · ~$0.40/audit)
  D2.10 engagement ≥ 70
  leak_quotes count = 0
  hallucinations count = 0
  Fail → FIX_LOOP

GATE 7 · REGRESSION FIXTURE
  pl:fixture-check --fixture <slug> PASS (all assertions green)
  Fail → BLOCKED · regression introduced
```

### Composite reporting rule (codex R35 Q-PP-5)

When any GATE 1-3 fails:
```json
{
  "composite": "N/A_BLOCKED",
  "block_reason": "<gate name + specific failure>",
  "ship_verdict": "BLOCKED",
  "note": "audit dim scores still computed but composite refused · prevents audit-gaming on thin/empty content"
}
```

No more 93/99 composite numbers on thin RED clients. Audit must be honest.

### Weight reference (codex R28 Q-II-5 · when GATE 5+ run)

- accuracy 0.25 · copy 0.25 · brand 0.20 · richness 0.15 · design 0.15
- Mobile = veto layer (GATE 4 · NOT in composite)

---

## §4 · Current client roster · audit baselines

| Client | Status | Composite | Last audit | Notes |
|---|---|---|---|---|
| vicwest-roofing | ✓ CANONICAL CLEAN | 91 / A / SHIP | 2026-05-29 | T4d 100 · 0 hallucinations · 0 banned · ABN-clean · M1 PASS · trade-classic alt 83B SHIP (v1.3 post-slider) |
| a-j-roofing-solutions | ✓ Cross-client + brand-tokens fix | 89 / A / SHIP | 2026-05-29 | YELLOW + PREVIEW banner · merge-inferred wired · brand-tokens canonical path fixed (83→89 +6pt) · trade-classic alt 82B SHIP (v1.3) |
| mark-squire-roof-restorations | ✓ Recovered from BLOCKED | 93 / A / SHIP | 2026-05-29 | YELLOW + banner · 1 ai-fabricated review (no GBP review text) · 18 suburbs · 6 services · M1 PASS · trade-classic alt 86A SHIP (v1.3) |
| abc-roof-restoration-brisbane | BLOCKED · genuine gap | N/A_BLOCKED | 2026-05-29 | GATE 1 RED · missing phone + address (cannot crawl · cannot enrich) · needs manual data input · do not force |

---

## §5 · Versioning rules

### When to bump CANONICAL version

- **Major (vN.0)**: replacing a locked decision (e.g. new render path · new audit standard · new pipeline stage)
- **Minor (v1.N)**: tightening thresholds · adding dims · refining stage outputs
- **Patch (v1.0.N)**: typo fixes · clarifications · cross-reference updates

### Current: v1.1 · 2026-05-29

History:
- v1.0 (2026-05-28): initial canonical. Locks Path B composer · 5 P0 audit · editorial-newsletter template · 4 personas · single-page roofing scope.
- v1.1 (2026-05-29): R37 · 3 SHIP clients (was 2) · mark-squire recovered from BLOCKED. Locks `core/handoff/merge-inferred.js` shared helper · `buildCoreExtract` deep fusion · template empty-contact-row guard. No deprecation. Pure addition.
- v1.2 (2026-05-29): R38 · 2 templates inventoried (was 1) · trade-classic added at avg 84.3. Old templates fully retired to `_deprecated-2026-05-29/`. Locks: SOP-TEMPLATE-INVENTORY · composer `--template` dispatch · brand-tokens placement rule · a-j brand-tokens path fix (83→89 side-effect). 4 huashu/taste-skill variants V1-V4 deferred to tasks #106-#109.
- v1.3 (2026-05-29 evening): R39 + R40 + R-BA-6 visual polish round. trade-classic post-visual-QA. Locks: `core/handoff/copy-builders.js` profile dispatch · 4 anti-hallucination guards (yearFounded null · warranty_years_verified null · suburbs_verified split · no invented per-client facts) · R-BA-6 draggable before/after slider · SOP-TEMPLATE-INVENTORY §5.5 visual gate (mechanical + human + Matthew sign-off) · §11 anti-patterns expanded 7→13. Trade-classic re-baseline: vicwest 83B · a-j 82B · mark-squire 86A (within audit noise of R38 84/82/87).
- v1.4 (2026-05-29 night): R41 + R42 · Lead-capture E2E wired. `functions/api/client-contact.ts` (minimal · 180 lines · 5 fields · Resend only) · `pl-publish-dir --with-functions` whitelist-copies client-contact.ts + wrangler.toml · `pl-cf-env-bootstrap` sets RECIPIENT_EMAIL+RESEND_API_KEY+FROM_EMAIL+CLIENT_NAME per project · both templates (editorial-newsletter + trade-classic) now POST forms to /api/client-contact · inline JS handles loading/success/error UX. Verified end-to-end: vicwest-roofing-test.pages.dev → curl POST → Resend → matthewkiata@gmail.com lead inbox. Resend `profitslocal.com` domain verification queued (DNS in CF). Audit baselines unchanged: vicwest 91A · a-j 89A · mark-squire 93A (editorial-newsletter). SOP-TEMPLATE-INVENTORY §6.5 (Stage 4.5 form wire-up) MANDATORY for future templates.

### When a new agent reads this

Read order:
1. `CANONICAL.md` (this doc · master index)
2. `CLAUDE.md` user global (§7 existing-work-discovery rule)
3. `PRD-PROFITSLOCAL-PIPELINE.md` (pipeline detail)
4. Locked sub-docs as needed:
   - `SOP-AUDIT-STANDARD-V2.md` for audit work
   - `CANONICAL-DECISION-RECORD-RENDER-PATH.md` for render work
   - `PATH-A-OD-TESTED-NOT-ADOPTED.md` if anyone questions OD

NEVER start a "should I rebuild X?" investigation without first checking this index.

---

## §6 · Decisions still PROVISIONAL (explore freely · no canonical yet)

These areas are NOT locked · agent can experiment without violating canonical:

| Area | Current state | Why provisional |
|---|---|---|
| **Lead-side pipeline orchestration** (discovery → enrichment → checkpoint sequencing) | Multiple CLIs work in isolation · no single orchestrator | Phase B Step 5 will surface what's needed · then consolidate |
| **Multi-template selection** (editorial-portrait · lead-capture-phone-first · etc.) | template-match.js scoring exists · 0 families approved | Build editorial-portrait when mark-squire RED→GREEN proves demand |
| **Premium-tier LLM dims** D2.13 · D3.10 · M1.4-5 | Deferred per codex R30 Q-KK-5 (decision over completeness) | Add only if 3-path experiment retest produces ambiguous winners |
| **Phase C sales materials** (outreach copy · email · Stripe link) | Not started | Phase B must finish first (4 clients SHIP-ready) |
| **Phase D outreach automation** (email send · SMS · phone · WhatsApp) | Not started | Phase C must finish first |
| **Per-niche thresholds** (electrician vs plumber differs from roofing) | Roofing-only · niche metadata logged | Revisit after 10-15 audited roofer sites · then expand |
| **Upstream `pl:scrub-narrative-banned-phrases` CLI** (generalize today's regex fix) | Manual regex fix on vicwest core-extract | Build when 2+ clients have banned-phrase issue (currently 1) |

---

## §7 · Anti-patterns (codex R26-R34 enforcement)

1. **Don't propose new audit dim** without CLAUDE.md §7 5-look discovery + ≥5pt empirical gain
2. **Don't bypass `pl:compose-editorial`** for production renders (use `--use-wireframe` opt-in if narrative quality bad)
3. **Don't relax audit thresholds** to make a new render pass · move the renderer
4. **Don't mix fast-tier and premium-tier scores** (different questions · per SOP §5)
5. **Don't ship without M1 mobile gate PASS** (mechanical vetos are absolute · not negotiable)
6. **Don't average D2.10 engagement across pages** (single-page focus · 1 score)
7. **Don't add "just one more dim" to audit** without retiring an older orphan first (currently 4 orphan skills deferred per codex R30)
8. **Don't expand niche** beyond roofing without 5+ live paying roofer clients first

---

## §8 · Re-test triggers (when to challenge canonical)

Each locked decision has a re-test trigger. Don't waste cycles re-litigating without meeting these:

### Render path (V1 composer)
Challenger must produce ≥5pt audit composite gain over V1 91 baseline AND token-coverage ≥80 (vs LLM's 11-19) AND ≤3pt variance across 5 runs AND PASS all M1 vetos in 100% of runs.

### Audit standard v2
Challenger framework must explain Matthew's 5 P0 priorities better than current dim-to-P0 mapping. Codex round required.

### Editorial-newsletter template
Challenger template must beat editorial-newsletter on ≥1 client in 3-site calibration AND audit composite ≥89.

### Single-page only
Challenger evidence: client requested multi-page · single-page can't meet need · AND we have render+audit pipeline for multi-page. Currently neither true.

### OD daemon revival
Challenger must produce ≥3 vicwest renders ≥85 AND ≥2 cross-client ≥80 AND cost ≤$0.15/render AND cloud-portable.

---

## §9 · Today's session summary (2026-05-28)

**30 commits · 9 codex consensus rounds (R26-R34) · ≥95% consensus on all decisions.**

### What got locked
- ✅ Path A (OD) deprecated · 13 variants · 0 success · documented
- ✅ Path C (LLM whole-page) tested · loses to V1 on 4 dimensions · archived
- ✅ V1 `pl:compose-editorial` declared CANONICAL render path
- ✅ V5 hybrid (composer + wireframe) as opt-in fallback
- ✅ SOP-AUDIT-STANDARD-V2 (618 lines · 5 P0 framework)
- ✅ 8 new audit dims wired (D2.BC6/BC7/D2.14/D2.11/D2.10 + M1.1-3 mobile vetos)
- ✅ Phase 3 vicwest editorial templatized (editorial-newsletter)
- ✅ Cross-client smoke a-j PASS (composite 83 · 8pt drop · acceptable)
- ✅ Audit feedback loop closed (ABN missing → fixed · tap-target → fixed · banned phrase → fixed)
- ✅ Vicwest editorial CLEAN: composite 91 · 0 hallucinations · 0 banned phrases · 0 leak quotes
- ✅ Image library V2 batch digested (22 new · 78 total) · V3 prompts dispatched (15 prompts)

### What was empirically PROVEN
1. **Template + Mustache > LLM whole-page** for production design quality at scale
2. **CSS architecture is a SYSTEM** that templates encode and LLMs cannot reliably reproduce (-71pt token depth gap)
3. **Fast-tier voice scores are misleading without premium leak-free validation** (V3 fast 100 / premium 20)
4. **LLM rendering has 11pt variance** vs deterministic 0 · production unacceptable
5. **Audit catches real defects pre-publish** (live www.vicwestroofing.com.au has 3 mobile vetos + 0 brand palette honored · proof we add value)

### Insight to remember
**Less LLM freedom = better quality.** Constraining LLM to "fill in this copy field" + template encoding design system beats "render the whole page." This contradicts the AI hype.

---

## §9.5 · 2026-05-29 session highlights (R37)

**1 codex round (R37 Q-RR-1..6) · 1 commit · 3 SHIP clients (up from 2).**

### What got fixed
- ✅ **Blocker B** · `buildCoreExtract` + `saveCoreExtract` + `runAiSingle` + `DEEP_PROMPT_TEMPLATE` recovered from `stash@{0}` (phaseA-step0-temp-stash). The CLI `pl:llm-extract-core` depended on these but they were never committed · sitting in a stash since 2026-05-18.
- ✅ **Blocker A** · `core/handoff/merge-inferred.js` shared helper created. Wired into `pl-compose-editorial` for suburbs / testimonials / owner-name back-fill. Pattern ported from `pl-build-od-seed.js:299-321`. Provenance-tagged. Anti-gaming preserved: inferred values do NOT promote checkpoint to GREEN.
- ✅ **Side-effect** · template `<a href="mailto:{{client.email}}">` now wrapped in `{{#client.email}}…{{/client.email}}` guard · prevents M1.3 tap-target veto when client has no email.
- ✅ **mark-squire** · N/A_BLOCKED → 93 A SHIP (Tier-1 upstream recovery proves the canonical pipeline works on thin clients · GBP + 5 external mentions + LLM fusion is enough).

### Anti-gaming verification
- a-j still YELLOW + PREVIEW banner (correct · per codex Q-RR-4 (a)) · render now has Cairns-local testimonials instead of Sebastopol/Ballarat placeholders · transparency tags still ON.
- abc still N/A_BLOCKED (correct · genuine data gap · no phone/address to crawl).

### Insight to remember (R37)
**Lost work hides in stashes.** Always check `git stash list` when a CLI references a symbol that doesn't exist. The 2026-05-18 phaseA-step0 stash contained 265 lines of working code that was assumed lost. Codex Q-RR-1 forced surgical recovery rather than full overwrite.

---

## §10 · Onboarding for future agents

If you are a new Claude / codex / Cursor agent reading this:

1. **Read this doc first.** Don't propose anything until you understand §0-§4.
2. **For any "should I build X?" question**: check §1 (deprecated paths) and §6 (provisional areas) first.
3. **For any "what's the canonical Y?" question**: §0 master state has the answer.
4. **For any "should we re-test Z?" question**: §8 re-test triggers tell you the bar.
5. **CLAUDE.md §7 existing-work-discovery is MANDATORY** before proposing new artifacts.
6. **Don't drift back to OD or Path C.** They were tested. They lost. Move forward.

Last review: 2026-05-29 · 10 codex rounds (R26-R37) · Matthew approvals throughout.

---

**Sign-off**: this doc is the institutional memory. Update it when locked decisions change (codex round + Matthew approval). Don't fork it. Don't ignore it.
