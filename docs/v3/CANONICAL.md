# CANONICAL · ProfitsLocal Production Standard · v1.0 · 2026-05-28

> **PURPOSE**: single master index of "what is the current best · don't deviate without proof". Future agents read this FIRST · stop drifting into deprecated paths.
>
> **TRIGGER**: every new session · every "should I rebuild X?" question · every "what's the canonical Y?" question.
>
> **STATUS**: v1.0 · locked by 9 codex consensus rounds (R26-R34) + Matthew approvals.
>
> **RULE**: anything NOT in this doc as "locked" is provisional · explore freely. Anything LOCKED here cannot be replaced without (a) empirical evidence beating it by the re-test trigger threshold AND (b) codex sign-off in a new consensus round.

---

## §0 · Master state · 2026-05-28

| Decision | Locked Value | Source-of-truth doc | Re-test trigger |
|---|---|---|---|
| **Render path** | `pl:compose-editorial` (V1 · template + Mustache · deterministic · $0) | `CANONICAL-DECISION-RECORD-RENDER-PATH.md` | Need ≥5pt audit composite gain AND token-coverage parity (≥80) AND ≤3pt variance across 5 runs |
| **Canonical template** | `templates/roofing/editorial-newsletter/` (1 family for now · single-page only) | `template.html` + `README.md` | Need 2nd client with brand that doesn't fit (e.g. owner-led slab-serif · commercial bold) AND audit ≥85 with new template family |
| **Audit standard** | SOP-AUDIT-STANDARD-V2 · 5 P0 capabilities + mobile veto + fast/premium tier | `SOP-AUDIT-STANDARD-V2.md` (618 lines) | Need codex round signoff on new weights/dims · v3 frozen as legacy_baseline |
| **Brief schema** | `clients/<slug>/v2/single-page-brief.yaml` · validated by `pl:validate-single-page-brief` | `core/handoff/single-page-brief-schema.js` (12 cross-field constraints) | Schema change = codex round |
| **Skills layer** | pl-au-trade-voice · pl-local-trade-page-spec · pl-audit-rubric (3 PL skills · build-artifact pattern) | `skills/*/SKILL.md` + `<skill>.json` build outputs | Add new skill = codex round + CLAUDE.md §7 existing-work check first |
| **Persona model** | 4 segments (urgent-repair · planned-upgrade · commercial-maintenance · guided-first-time-buyer) | `core/audit/personas/*.js` · default primary = planned-upgrade | Add 5th persona (insurance-claim deferred to Phase B+) = codex round |
| **Brand kit** | `clients/<slug>/v2/handoff/od-package/brand/` (8-9 logo SVG variants + brand-tokens.css) | `brand-spec.json` per client | Phase 1 brand-kit pipeline canonical |
| **Image library** | `templates/roofing/stock-library/` · 78 files · 7 slots · manifest-tracked | `_manifest.json` + IMAGE-PROMPTS-V1/V2/V3 | Add by IMAGE-PROMPTS-VN workflow only |
| **Niche scope** | **Roofing only** (Phase B) | Matthew 2026-05-28 lock | Phase C expansion = electrician/plumber after 5+ roofer clients live |
| **Mobile gate** | Hybrid veto (M1.1-1.3 mechanical = VETO · M1.4-5 vision = scored into design P0) | SOP-AUDIT-STANDARD-V2 §4 | Hard rule for AU local-trade |
| **Render multi-page** | NOT supported in Phase B · single-page editorial-newsletter only | Matthew 2026-05-28 lock | Phase C+ when single-page market validated |

---

## §1 · Deprecated paths (DO NOT REVIVE without re-test trigger)

| Path | Why deprecated | Re-test trigger | Evidence doc |
|---|---|---|---|
| **OD (Open Design daemon)** | 13 overnight variants · 0/13 hit ≥85 · vicwest best 72 · cross-client collapse 51-56 · Mac daemon · 9× cost · 3× slower | OD goes cloud-portable AND ≥85 baseline AND ≤±5pt cross-client AND ≤$0.15/render | `PATH-A-OD-TESTED-NOT-ADOPTED.md` |
| **Path C · LLM whole-page render** (`pl:render-llm-page`) | Mean 85.5 vs V1 91 · 11pt variance · CSS token depth -71pt · premium leak-free 20 vs V1 100 · 50% mobile veto | New LLM model AND ≥10pt D2.10 gain AND ≥80 D2.BC6 token coverage AND ≤3pt variance across 5 runs | `experiments/3path-experiment-2026-05-28/RESULTS.md` |
| **V2 module library** (`pl:compose-site`) | "OK but not great" baseline · D2.5 brand palette 33 vs V1 100 · uses generic house SVG not real brand logo · supplanted by editorial-newsletter | If a RED client must render without checkpoint passing · V2 = fallback (composer refuses RED) | Audit baselines in calibration doc |
| **OD overnight greedy search** | 2-hour run · $14 · 13 variants · 0 ≥85 | Same as OD above | `experiments/od-master-2026-05-20T01-56-51-270/` |

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

## §3 · Quality gates (production ship · per client)

A client website ships if and only if:

```
1. checkpoint.json verdict = GREEN (or YELLOW with PREVIEW banner)
2. brief.yaml validates (12 cross-field constraints pass)
3. pl:compose-editorial output exists
4. pl:audit-v4 --tier fast results:
   T1 mechanical PASS
   T2 brand contract ≥ 80
   T4d voice ≥ 90
   D2.14 proof variety ≥ 60 (≥3 of 6 types)
   D2.11 facts cross-check ≥ 90 (when brief.yaml present)
   M1 mobile gate PASS (0 mechanical vetos)
   composite ≥ 80
5. pl:audit-v4 --tier premium results (ship gate · ~$0.40 per audit):
   D2.10 engagement ≥ 70
   leak_quotes count = 0
   hallucinations count = 0
6. pl:fixture-check PASS (regression contract · per-slug fixture under fixtures/e2e/<slug>/)
```

Currently locked thresholds (codex R28 Q-II-5 weights):
- accuracy 0.25 · copy 0.25 · brand 0.20 · richness 0.15 · design 0.15
- Mobile veto = separate ship blocker (NOT averaged into composite)

---

## §4 · Current client roster · audit baselines

| Client | Status | Composite | Last audit | Notes |
|---|---|---|---|---|
| vicwest-roofing | ✓ CANONICAL CLEAN | 91 / A / SHIP | 2026-05-28 | T4d 100 · 0 hallucinations · 0 banned · ABN-clean · M1 PASS |
| a-j-roofing-solutions | ✓ Cross-client validated | 83 / B / SHIP | 2026-05-28 | YELLOW data · placeholder reviews · M1 PASS · proves V1 transfers |
| mark-squire-roof-restorations | RED · needs upstream | — | pending Phase B Step 5 | 0/6 rich · needs enrich-entity + llm-extract-core |
| abc-roof-restoration-brisbane | RED · needs upstream | — | pending Phase B Step 5 | 2/7 hard (no phone/address) · cross-state QLD/QBCC |

---

## §5 · Versioning rules

### When to bump CANONICAL version

- **Major (vN.0)**: replacing a locked decision (e.g. new render path · new audit standard · new pipeline stage)
- **Minor (v1.N)**: tightening thresholds · adding dims · refining stage outputs
- **Patch (v1.0.N)**: typo fixes · clarifications · cross-reference updates

### Current: v1.0 · 2026-05-28

History:
- v1.0 (2026-05-28): initial canonical. Locks Path B composer · 5 P0 audit · editorial-newsletter template · 4 personas · single-page roofing scope.

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

## §10 · Onboarding for future agents

If you are a new Claude / codex / Cursor agent reading this:

1. **Read this doc first.** Don't propose anything until you understand §0-§4.
2. **For any "should I build X?" question**: check §1 (deprecated paths) and §6 (provisional areas) first.
3. **For any "what's the canonical Y?" question**: §0 master state has the answer.
4. **For any "should we re-test Z?" question**: §8 re-test triggers tell you the bar.
5. **CLAUDE.md §7 existing-work-discovery is MANDATORY** before proposing new artifacts.
6. **Don't drift back to OD or Path C.** They were tested. They lost. Move forward.

Last review: 2026-05-28 · 9 codex rounds · Matthew approvals throughout.

---

**Sign-off**: this doc is the institutional memory. Update it when locked decisions change (codex round + Matthew approval). Don't fork it. Don't ignore it.
