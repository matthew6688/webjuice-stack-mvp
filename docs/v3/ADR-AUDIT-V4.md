# ADR · Audit v4 · Unified scoring for batch website delivery

> ⚠️ **NOT THE STANDARD (codex R74 · 2026-05-29).** The canonical audit standard is
> `docs/v3/SOP-AUDIT-STANDARD-V2.md` (5-P0 weighted + mobile veto). This ADR is kept as
> **implementation history / appendix** — the T1..T5 tier model here is a runtime label
> scheme, and its "T4 = designer review" / "T5 = creative director" naming is reconciled
> in SOP-AUDIT-STANDARD-V2 §0.1. Do not treat tier numbers here as the standard.

> **Owner**: Matthew · **Status**: HISTORY/APPENDIX (was DRAFT 2026-05-27) · **Superseded by**: `docs/v3/SOP-AUDIT-STANDARD-V2.md`
> **Cross-ref**: SOP-AUDIT-STANDARD.md (v3 · still canonical until v4 lands) · SOP-DATA-CHECKPOINT.md (upstream gate) · SOP-LOCKED-BASELINE-V1.md (recipe)
> **Status during transition**: v3 (pl-audit-tier) is the production gate · v4 (pl-audit-v4) is additive · wraps v3 + adds T4 designer review + optional T5 creative-director critique
> **SSOT writer check** (per CLAUDE.md §6): v4 introduces NO new writer for tier scores; it wraps the v3 writer and APPENDS T4/T5 dims. v3 `_tier-audit.json` remains the single source of truth for T1–T3.

---

## 1 · Context

### 1.1 · What audit-tier v3 does well

`scripts/cli/pl-audit-tier.js` (733 lines · just received T1.9 license-check 2026-05-27) implements the 4-tier model from SOP-AUDIT-STANDARD.md:

- **T1** (PASS/FAIL · 9 checks): business name, phone count, address, ABN no-fabrication, state licensing authority, brand color presence, hours no-fabrication, fabricated-stats, license-claim no-fabrication.
- **T2** (0-100 · 9 dims): section presence, word count, forbidden phrases, codex-deep-audit (D1 facts / D2 voice / D3 specificity), cross-page uniqueness, weakness count, hallucination count. Per-page floor rule (single bad page caps T2).
- **T3** (0-100 · 4 dims): vision LLM 10-dim (`pl-audit-vision`), chrome consistency, module diversity, typography hierarchy.
- **T4** (0-100 · 3 dims actually wired): build sanity, SEO basics, schema.org JSON-LD. PageSpeed / WCAG / GEO / old-issue-fix are documented in SOP but not coded.

Composite = `(T2+T3+T4)/3` gated by T1. ≥73 = production-ready.

### 1.2 · Where v3 falls short for batch delivery

1. **No designer-level review.** v3's T3 is "is the layout consistent and visually scored 0-100", but it cannot say "this typography is AI-slop" or "this hero is a Cannes-eligible idea". For batch delivery we need a categorical judgment, not just a layout-rhythm score.
2. **No brand-contract tier.** v3 T1.6 checks "brand hex appears in CSS" (binary on presence). It does NOT check `var(--brand-*)` coverage %, hardcoded-hex count, or logo-variant-per-surface honoring (`logo-mono-light.svg` on dark backgrounds). The 2026-05-27 Phase 3 MVP manual audit revealed mark-squire was at 25% var coverage (compliant on T1 but failing token discipline).
3. **No premium tier.** Some customers pay for "designer-quality"; v3 has no axis that captures originality/craft/cultural relevance separate from layout.
4. **Composite is a flat average.** Three tiers `(T2+T3+T4)/3` weighted equally. A site that aces T3 visuals but tanks T2 copy is treated the same as the inverse; the actionable signal is buried.
5. **Issues output is per-tier human prose**, not a structured `issues[]` list a fix-loop can iterate against. v3's `_tier-audit.md` is great for humans, marginal for machines.
6. **Determinism is not enforced.** v3 calls codex-deep-audit + pl-audit-vision but does not pin temperature/seed/model. Re-running may give ±5 swing; we have no health metric for this.

### 1.3 · What OD audit skills offer

Read the four OD skill catalogue entries at `/tmp/open-design/skills/` (each is ~80 lines · the catalogue advertises them; the upstream bundle has the actual workflow):

| Skill | What it adds we lack |
|---|---|
| `design-review` (gstack · Garry Tan) | Designer Who Codes: per-issue atomic-commit instructions + before/after screenshot mandate. Closes the loop from "found problem" → "here's the verbatim fix". |
| `plan-design-review` (gstack · Garry Tan) | Per-dimension 0-10 scoring (typography / hierarchy / spacing / color / motion / craft) + AI-Slop detector (vibrant gradient + glass morphism + emoji headings + Inter everywhere). |
| `creative-director` (smixs · Cannes-calibrated) | 3-axis evaluation (Idea / Craft / Impact) calibrated against Cannes/D&AD. 20+ ideation methodologies (SCAMPER, SIT, TRIZ). Premium-tier judgement: "is this a *good ad*", not "is this a clean layout". |
| `web-design-guidelines` (Vercel-labs) | Hard-coded Vercel-style rules: layout grid, type scale, color tokens, motion guidelines, a11y. Maps closely to T2/T3 dims we already have but more prescriptive. |

These four skills cover the **designer-quality** dimensions that v3's vision LLM gestures at but doesn't operationalize.

### 1.4 · Why batch delivery needs v4

ProfitsLocal is moving from 1-customer-at-a-time to N-clients-per-cycle. A batch run must:

- **Reproduce** (same site re-audited → ±2 points · catches model drift).
- **Aggregate** (dashboard across N sites · find systemic regressions).
- **Block** (gate publish · `production_ready === true`).
- **Itemize** (give the fix-loop concrete `issues[]` · not paragraphs).
- **Cost-meter** (LLM calls cost · per-site $0.05–$0.30; need ledger).

v3 does the first two poorly, the third well, the fourth not at all, the fifth not at all.

---

## 2 · Decision · 5-tier model

We extend v3's 4-tier model to **5 tiers**. T1–T3 keep v3 semantics 1:1 (so dashboards survive). T2 in v3 becomes T3 in v4 (copy is moved into the brand-contract tier's slot logically reordered). **Important compatibility note**: v4 internally still calls v3's tier names where the wrapping is preserved. The reorder below is the *conceptual* v4 model; the implementation in `pl-audit-v4.js` keeps backward-compatible names where it wraps v3.

### Tier matrix

| Tier | What | Determinism | LLM? | Cost/page | Threshold | Replaces |
|---|---|---|---|---|---|---|
| **T1 · Hard mechanical** | PASS/FAIL · contract violations | 100% deterministic | None | $0 | 0 fails | v3 T1 (verbatim — same 9 checks) |
| **T2 · Brand contract** | Token discipline · 0-100 | 100% deterministic | None | $0 | ≥80 | NEW (covers Phase 3 MVP gap) |
| **T3 · Vision audit** | Layout/typo/color/readability · 0-100 | LLM (temp 0, seed pinned) | Yes | ~$0.05 | ≥70 | v3 T3 + v3 T2 codex |
| **T4 · Designer review** | Hierarchy / detail / AI-slop · 0-100 | LLM (temp 0, seed pinned) | Yes | ~$0.10 | ≥70 (optional default-on) | NEW (adapts OD `design-review` + `plan-design-review`) |
| **T5 · Creative director** | Idea / Craft / Impact · 0-100 | LLM (temp 0, seed pinned) | Yes | ~$0.15 | ≥60 (premium-only · default opt-in) | NEW (adapts OD `creative-director`) |

### 2.1 · T1 · Hard mechanical (PASS/FAIL · 0 LLM · ~50 ms/page)

Carry forward verbatim from v3 SOP §1. No semantic change. These 9 checks are the contract that publishing must never violate.

1.1 business_name verbatim every page
1.2 phone verbatim ≥3 per content page
1.3 address present
1.4 ABN verbatim-or-absent (never fabricated)
1.5 state licensing authority correct (VIC→VBA, QLD→QBCC, …)
1.6 brand hex present in CSS (presence-only · contract depth moves to T2)
1.7b hours no-fabrication (closed-day cross-check)
1.8 no fabricated stats (regex bans `+47%` / `50,000+ customers` / `10× faster`)
1.9 license-claim no-fabrication (NEW in v3 2026-05-27 · keep)

**Add in v4**:

1.10 **Cross-client content leak** (batch-mode only). Re-scan customer A's HTML for verbatim phrases from customer B's facts.json (name, phone, owner_name, suburbs). Catches the OD agent borrowing from a previous brief.
1.11 **Logo refs resolve** (file-existence check). Every `<img src="logos/*.svg">` must resolve to a file on disk; broken logo refs are P0.
1.12 **4xx/5xx outbound links** (offline cache check). For published sites, run the link cache; for previews, skip.
1.13 **JSON-LD validity** (parse `<script type="application/ld+json">` · must be valid JSON · LocalBusiness type present on home).

T1 score: binary. Any check fails → T1 fails → composite = 0 → ship blocked.

### 2.2 · T2 · Brand contract compliance (0-100 · 0 LLM · ~100 ms/page)

NEW tier. Captures the token-discipline gap surfaced by the 2026-05-27 Phase 3 MVP audit.

| Dim | Weight | Method | Threshold |
|---|---|---|---|
| **D2.1 var(--brand-*) coverage %** | 30% | Count CSS rules using `var(--brand-*)` / count CSS rules with color or background-color. Pass: ≥60%. | 60% = 100pts · 25% = 0pts (linear) |
| **D2.2 Hardcoded hex count** | 25% | Count unique non-grayscale hex literals in inline + `<style>`. Pass: ≤8 unique. | ≤8 = 100pts · ≥30 = 0pts (linear) |
| **D2.3 Brand-spec type rule compliance** | 15% | If `brand-spec.json` declares `primary_font`, ≥80% of body text must compute to that family. | binary per page · average |
| **D2.4 Logo variant per surface** | 15% | Parse `<img src="logos/*.svg">`; for each, check whether the surrounding section's background is light/dark; ensure `logo-light` on light, `logo-dark` on dark, `logo-mono-*` only where declared. | 0 mismatches = 100 · −20 per mismatch |
| **D2.5 Brand color palette honored** | 15% | Verify brand-spec `colors.brand_primary` / `brand_accent` appear ≥1× in computed CSS AND no other near-saturated hue dominates. | qualitative · graded by static count |

**Why brand-contract is T2 not T1**: failing it doesn't violate a fact, it violates token discipline. The site still ships; we just want ≥80 here for batch-quality.

### 2.3 · T3 · Vision audit (0-100 · LLM · ~$0.05/page · 8 dims)

This is the existing v3 T3 (vision LLM via `pl-audit-vision`) PLUS the existing v3 T2 codex-deep-audit copy dims, merged into a single "what does the rendered site look + read like?" tier. The 8 dims mirror SOP-AUDIT-STANDARD §3 and §2 to keep dashboards compatible.

| Dim | Weight | Method |
|---|---|---|
| D3.1 Layout / grid rhythm | 15% | vision LLM |
| D3.2 Typography hierarchy | 15% | vision LLM |
| D3.3 Color hierarchy | 10% | vision LLM |
| D3.4 Readability | 10% | vision LLM |
| D3.5 Image–text balance | 5% | vision LLM |
| D3.6 Copy depth (codex D1+D2+D3) | 25% | codex-deep-audit |
| D3.7 Cross-page chrome consistency | 10% | static byte-diff (carried from v3) |
| D3.8 Module diversity | 10% | static class-name parse (carried from v3) |

T3 is deterministic for the static dims (D3.7, D3.8) and LLM for the rest. LLM calls pin model + temp 0 + JSON schema; seed = sha256(html). Re-run health metric: |T3_now − T3_prior| ≤ 2 expected; >5 = drift alert.

### 2.4 · T4 · Designer review (0-100 · LLM · ~$0.10/page)

NEW tier. Adapts OD `design-review` + `plan-design-review`.

5 dims × 0–10 each → multiply by 2 to get 0–100:

| Dim | What a 10 looks like (per OD plan-design-review) |
|---|---|
| **D4.1 Philosophy commitment** | One clear visual idea, executed everywhere. No "vibrant gradient + minimal + brutalist" salad. |
| **D4.2 Hierarchy** | Eye lands on hero in <1s · scans CTA in <2s · finds proof in <4s. Z-pattern or F-pattern committed. |
| **D4.3 Detail** | Optical alignment, micro-spacing, off-by-1px corrections. No misaligned baselines, no widow lines. |
| **D4.4 Innovation** | Not a Tailwind template clone. At least one non-default move (custom grid / unexpected type pairing / proprietary illustration). |
| **D4.5 Functionality** | Buttons look clickable; forms have visible labels; mobile tap targets ≥44px. |

PLUS **AI-Slop sub-score** (separate · 0–100 · multiplied as a cap):
- Detect: vibrant gradient + glass morphism + emoji headings + Inter-everywhere + "Built with ❤" + stock photo of "diverse team in office".
- 0 slop markers = 1.0× cap. 5+ markers = 0.5× cap (designer review halved).

T4 LLM prompt is structured-output JSON; v4 stores `{D4.1: int, D4.2: int, D4.3: int, D4.4: int, D4.5: int, ai_slop_markers: [str], ai_slop_score: int}`.

### 2.5 · T5 · Creative director critique (0-100 · LLM · ~$0.15/page · OPTIONAL premium)

NEW tier. Adapts OD `creative-director`. Default OFF; enabled via `--tier premium` flag.

3-axis Cannes-calibrated · each 0–10 · sum × (10/3) → 0–100:

| Axis | Calibrated against | What a 10 means |
|---|---|---|
| **Idea originality** | Cannes Gold / D&AD Black | Not seen in 50 other roofing sites. A real insight about the customer's emotional state. |
| **Cultural relevance** | HumanKind Top 10 | AU-tradie register · not consultant-speak · local proof not generic stock. |
| **Craft** | D&AD Wood/Graphite | Type kerned not auto-spaced · grid intentional · proof has texture (real names + suburbs not "John D.") |

T5 is **gated**: only runs if T1 PASS and T4 ≥ 60. No point running creative-director on a site that fails brand-contract or designer-review basics.

---

## 3 · Composite formula

```
if T1.pass === false:
    composite = 0
    ship_verdict = "BLOCKED · T1 fail"
else:
    weights = {T2: 0.15, T3: 0.30, T4: 0.20, T5: 0.10, _floor: 0.25}
    # _floor is the lowest of {T2, T3, T4} — protects against averaging away a bad tier
    weighted = T2*0.15 + T3*0.30 + T4*0.20 + (T5 if premium else T3)*0.10 + min(T2,T3,T4)*0.25
    composite = round(weighted)

ship_verdict:
    composite ≥ 73 → "SHIP"
    60 ≤ composite < 73 → "FIX_LOOP" (pl:iterate-site · max 3 rounds)
    composite < 60 → "REJECT" (re-do brief/seed)
```

**Default weights** `0.15/0.30/0.20/0.10` plus a `_floor=0.25` (lowest-tier penalty). Sum to 1.0. T3 weighs most because that's the user-perceived layer.

**Per-tier hard gates** (any one trips → ship_verdict = "FIX_LOOP" even if composite ≥ 73):
- T1 fail → composite = 0 (already covered above)
- T2 < 70 → brand-contract too loose · iterate brand-injection
- T3 < 60 → vision sees real problems · iterate skill
- T4 ai_slop_score < 60 → designer flags slop · iterate DESIGN.md

**Premium-tier (T5)** does not enter the composite by default. Only when `--tier premium` flag is set; then `T5*0.10` replaces the redundant T3 weight in the formula above. This keeps composite scores comparable across runs unless explicitly opted in.

**Re-audit health metric** (logged to `audit-trace.md`):
```
delta_composite = |composite_now - composite_prior|
expected: ≤ 2 (because T1+T2+T3.7+T3.8 are deterministic = ~50% of weight)
if delta_composite > 5: emit drift_alert (LLM judge is unstable; pin a different seed)
```

---

## 4 · Issues schema (actionable)

Every audit emits `audit-issues.json`. Each issue is **fix-loop-ready**.

```json
{
  "schema_version": "audit-v4-issues/1",
  "slug": "vicwest-roofing",
  "audit_run_id": "20260527-2342-vicwest",
  "issues": [
    {
      "id": "I-001",
      "tier": "T1",
      "dim": "1.5_licensing_authority",
      "severity": "P0",
      "page": "about.html",
      "file": "clients/vicwest-roofing/v2/output/about.html",
      "line": 142,
      "what": "Page says \"QBCC-licensed\" but facts.json state=VIC (expected VBA)",
      "why": "Cross-state authority leak. Fabricates licensing in wrong jurisdiction. Legal risk + T1 hard fail.",
      "fix": "Replace \"QBCC-licensed roofing contractor\" with \"VBA-registered building practitioner\" at line 142. Re-grep all pages for QBCC and remove.",
      "fix_command": "sed -i '' 's/QBCC-licensed/VBA-registered/g' clients/vicwest-roofing/v2/output/*.html"
    },
    {
      "id": "I-002",
      "tier": "T2",
      "dim": "D2.1_var_brand_coverage",
      "severity": "P1",
      "page": "<sitewide>",
      "file": null,
      "line": null,
      "what": "var(--brand-*) coverage is 25% (mark-squire-style failure). Threshold ≥60%.",
      "why": "Hardcoded heritage hex values block portability. If brand-spec ever updates, design won't follow.",
      "fix": "In editorial/preview.html <style> block, replace 15 hardcoded hex (#5C2E0A, #C29B5C, …) with var(--brand-primary)/var(--brand-accent). Map provided in audit-trace.md.",
      "fix_command": null
    }
  ],
  "summary": {
    "P0": 1, "P1": 3, "P2": 8,
    "total": 12,
    "ship_blockers": 1,
    "fix_loop_addressable": 11
  }
}
```

**Severity scheme**:
- **P0** = T1 fail · contract violation · ship-blocker (must fix before publish)
- **P1** = T2/T3/T4 below tier threshold · ship-blocker for "production-ready" rating
- **P2** = polish · won't block ship · improves composite by 1-3 points

**`fix` field is mandatory and concrete**. Forbidden: "improve hierarchy", "make it cleaner". Required: "Replace H2 at line 87 from 24px to 32px"; "Add 24px padding-top to .hero section in editorial/preview.html line 142".

**`fix_command` is optional** but encouraged for mechanical fixes (sed / brand-spec update / file rename).

---

## 5 · Output structure

```
<output-dir>/
├── _tier-audit.json          # v3 backward-compat (still written by pl-audit-tier)
├── audit-v4-report.html      # NEW · customer-facing per-site report (OD-style "research-decision-room")
├── audit-v4-issues.json      # NEW · machine-readable issues[] for fix-loop
├── audit-v4-trace.md         # NEW · LLM call ledger · model/temp/seed/cost per tier
├── audit-v4-screenshots/     # NEW · evidence images for T3/T4 issues
│   ├── home-above-fold.png
│   ├── home-hero-detail.png
│   └── about-typography.png
└── audit-v4-summary.json     # NEW · 1-page dashboard input (tier scores, composite, verdict)
```

### 5.1 · `audit-v4-report.html`

Customer-facing. Sections:
- Hero: site name + composite score + grade (A/B/C/D/F) + verdict (SHIP / FIX_LOOP / REJECT)
- Per-tier accordion: score · top 3 issues · "what good looks like" reference
- Screenshots side-by-side: current vs reference (e.g. competitor at composite 90)
- Issues table sorted by severity then tier
- LLM trace footer (model, temp, seed, total cost)

Style matches OD "research-decision-room" template (`/tmp/open-design/skills/research-decision-room/` if installed).

### 5.2 · `audit-v4-trace.md`

```
# Audit Run · vicwest-roofing · 2026-05-27 23:42 UTC

## LLM calls

| Tier | Model | Temp | Seed | Tokens in | Tokens out | Cost (USD) |
|---|---|---|---|---|---|---|
| T3.1-T3.5 (vision) | claude-3-5-sonnet-20251022 | 0.0 | a4b7… | 8420 | 1240 | $0.0432 |
| T3.6 (codex) | claude-sonnet-4-5 | 0.0 | a4b7… | 4180 | 980 | $0.0186 |
| T4 (designer) | claude-sonnet-4-5 | 0.0 | a4b7… | 5200 | 1480 | $0.0982 |
| T5 (creative-director) | claude-opus-4-7 | 0.0 | a4b7… | 6100 | 2240 | $0.1532 |
| **Total** | | | | | | **$0.3132** |

## Re-audit drift
- Composite prior run: 76
- Composite this run: 78
- Δ = 2 (within ±2 expected · OK)
```

---

## 6 · Determinism strategy

### 6.1 · Deterministic tiers (T1, T2)

100% reproducible. Same HTML in → same JSON out. No LLM. These cover ~40% of composite weight.

### 6.2 · LLM tiers (T3, T4, T5)

Each LLM call pins:
- **Model**: e.g. `claude-sonnet-4-5` (frozen per tier · upgrade requires ADR amendment)
- **Temperature**: `0.0`
- **Seed**: `sha256(html_content)[:16]` (when supported by API; otherwise omitted)
- **Response format**: structured-output JSON schema (Anthropic tool-use forced JSON)
- **System prompt**: frozen string committed to `core/audit/v4-prompts/` (one file per tier)

Re-run health: same-site re-audit must give Δcomposite ≤ 2. Logged in `audit-v4-trace.md`. >5 → drift alert.

### 6.3 · Versioning

Each tier's prompt is versioned. Changing a prompt bumps `audit_v4_prompt_version` (e.g. `t4-designer-v1.2`). Dashboards filter by prompt-version to avoid mixing apples with oranges.

### 6.4 · Cost ledger integration

Every LLM call appended to `data/cost-ledger/audit-v4.ndjson`:

```json
{"ts":"2026-05-27T23:42:01Z","slug":"vicwest-roofing","tier":"T4","model":"claude-sonnet-4-5","input_tokens":5200,"output_tokens":1480,"cost_usd":0.0982,"prompt_version":"t4-designer-v1.0"}
```

Per V2 cost-discipline memory (`feedback_cost_discipline.md`): T3 = T2 (subscription metered), T4/T5 = T3 (premium · gate with `--tier premium` for T5).

---

## 7 · Batch delivery integration

### 7.1 · Scripts

```
npm run pl:audit-v4 -- --slug <slug> --tier full        # T1-T4 (default)
npm run pl:audit-v4 -- --slug <slug> --tier fast        # T1+T2 (no LLM · ~$0/site)
npm run pl:audit-v4 -- --slug <slug> --tier premium     # T1-T5 (includes creative-director)
npm run pl:audit-v4 -- --site <html> --tier T1          # single-tier on a single file
npm run pl:audit-v4 -- --slug <slug> --json             # stdout JSON, no file outputs
npm run pl:audit-v4 -- --slug <slug> --report           # generate audit-v4-report.html

npm run pl:audit-v4-batch -- --slugs <slug1,slug2,…> --tier full --parallel 4
```

### 7.2 · Aggregate dashboard

`docs/v3/AUDIT-DASHBOARD.md` auto-generated by `pl:audit-v4-batch`:

```markdown
# Audit Dashboard · 2026-05-27 (5 clients)

| Slug | T1 | T2 | T3 | T4 | T5 | Composite | Grade | Verdict |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| vicwest-roofing | ✓ | 85 | 78 | 72 | — | 78 | B | SHIP |
| mark-squire | ✓ | 55 | 80 | 65 | — | 67 | C | FIX_LOOP |
| a-j-roofing | ✗ | — | — | — | — | 0 | F | BLOCKED · T1.5 cross-state leak |
...
```

### 7.3 · Failure modes + retry

- **LLM call timeout (60s)**: retry once with longer timeout. If second fails → mark tier as "indeterminate" · don't include in composite · composite computed on remaining tiers with renormalized weights.
- **JSON schema parse fail**: retry once with explicit schema reminder in user message. If second fails → indeterminate.
- **Cost ceiling hit**: each run has `--max-cost-usd 1.00`; if approaching, skip T5 first, then T4. Always run T1+T2 (free).

### 7.4 · Parallel execution

`--parallel 4` runs 4 sites concurrently. Each site's LLM calls go sequentially (T3→T4→T5) to keep determinism. Total wall-time: ~2 min/site at full tier; 8 min for 16-site batch.

---

## 8 · Migration from v3

### 8.1 · Phased rollout

| Week | Action |
|---|---|
| **W1 (now)** | Land `pl-audit-v4.js` skeleton (this doc + matching CLI). T1+T2 actually run; T3/T4/T5 stubbed. `pl:audit-tier` unchanged. |
| **W2** | Wire T3 (wrap v3 vision + codex into v4 format). v4 still calls v3 under the hood for T3 dims. |
| **W3** | Implement T4 (designer-review LLM prompt + AI-slop detector). |
| **W4** | Implement T5 (creative-director · premium opt-in). Run shadow on 3 reference clients (vicwest, a-j, mark-squire). |
| **W5** | Switch publish-gate from `pl:audit-tier` to `pl:audit-v4 --tier full`. v3 alias kept for 4 more weeks (`pl:audit-tier` → wraps v4 and exits with v3 schema). |
| **W6+** | Retire v3 writer. v4 is sole audit-tier writer. SOP-AUDIT-STANDARD.md is rewritten to point at this ADR. |

### 8.2 · Backward compat

During W1-W4, `pl-audit-v4 --tier fast` MUST produce a `_tier-audit.json` that matches v3 schema (so existing dashboards keep working). v4-only fields (`audit_v4_*`) live in separate files.

### 8.3 · Delta tracking

W2 onward, both old and new composite are logged side-by-side:
```json
{ "composite_v3": 73, "composite_v4": 78, "delta": +5 }
```
If average delta across batch > 10 → audit-v4 is mis-calibrated · pause rollout.

---

## 9 · Anti-patterns this avoids

1. **Single LLM "give me a score 0-100"**. Loses dim breakdown · gives different number each call · not actionable. v4 has 5 tiers and structured-output JSON per tier.
2. **Manual designer review only**. Doesn't batch. Two paying clients means two days of Matthew reviewing. v4 keeps the designer review but operationalizes it through `plan-design-review` skill prompt.
3. **Retired codex-deep-audit 5-dim composite**. Too coarse · "what's wrong" not surfaced. v4 keeps codex but as ONE input to T3 (weight 25%), not the score.
4. **AI-only judge**. Can't catch contract violations (T1) · not reproducible. v4 keeps T1+T2 deterministic (~40% of weight) and pins LLM determinism for the rest.
5. **Multiple writers for tier scores** (SSOT violation per CLAUDE.md §6). v4 has ONE writer: `pl-audit-v4.js`. v3's `pl-audit-tier.js` is wrapped, not duplicated. During migration W2-W5, v4 writes BOTH `_tier-audit.json` (v3 schema) AND `audit-v4-*` (v4 schema).
6. **Composite that hides a bad tier behind a good tier**. v4 adds `_floor` term (lowest-tier × 0.25) so a single 40-scoring tier drags composite from 73 to 65.
7. **No re-audit health metric**. v3 has none. v4 logs prior composite, computes delta, emits drift_alert if >5.

---

## 10 · Open questions for Matthew

1. **T5 default**: opt-in (current proposal · `--tier premium`) or default-on for all paying clients? Cost is +$0.15/site/run · for 16-site batch that's $2.40/cycle.
2. **OD skill integration**: do we **wrap** OD `design-review` (shell out to the skill workflow · slow but faithful) or **import the prompt direct** (faster, but we own forking the prompt)? Current proposal: import the prompt verbatim into `core/audit/v4-prompts/t4-designer.md` and credit upstream.
3. **Composite weight defaults** (`T2:0.15 / T3:0.30 / T4:0.20 / T5:0.10 / floor:0.25`): willing to tune after first 3 reference clients re-audited? My instinct says T3 might want to drop to 0.25 and T4 climb to 0.25 once T4 lands · because that's where slop hides.
4. **Drift threshold**: ±2 acceptable or want stricter ±1? Stricter forces lower temperature ceilings · safer but cost-equivalent.
5. **`audit-v4-report.html` template**: build from scratch, or fork OD `research-decision-room`? Latter is faster but creates a coupling we'd own.
6. **Cross-client leak check (T1.10)** is a batch-mode-only check. In single-site mode it has nothing to compare against. Skip silently or warn?
7. **Deprecation of v3**: 4-week alias OK, or do you want v3 frozen indefinitely as a "v3-legacy" command name? I lean toward retiring it · two writers always drift.

---

## 11 · Acceptance criteria

This ADR is implemented when:

- [ ] `scripts/cli/pl-audit-v4.js` exists and runs (Week 1 · this PR delivers skeleton).
- [ ] `--tier fast` produces valid JSON with T1 + T2 results on the brand-grid-experiment preview HTML files.
- [ ] `--tier full` exits 0 with T3/T4 stubbed (TODO markers visible).
- [ ] `--tier premium` exits 0 with T5 stubbed.
- [ ] Re-running `--tier fast` on same input gives byte-identical JSON output (deterministic check).
- [ ] `npm run pl:audit-v4 -- --help` prints usage with all 5 tier flags.
- [ ] This ADR is linked from SOP-AUDIT-STANDARD.md (one-line cross-ref in §0).
- [ ] DECISIONS-LOG.md has an entry pointing here.

---

## 12 · Related docs

- `docs/v3/SOP-AUDIT-STANDARD.md` — v3 SOP (still canonical until v4 lands fully)
- `docs/v3/SOP-DATA-CHECKPOINT.md` — upstream gate · pre-audit data sufficiency
- `docs/v3/SOP-LOCKED-BASELINE-V1.md` — current pipeline recipe
- `templates/roofing/brand-grid-experiment/AUDIT-PHASE-3-MVP.md` — 2026-05-27 manual audit · informed T2 brand-contract dim
- `/tmp/open-design/skills/design-review/SKILL.md` — OD skill catalogue entry (T4 source)
- `/tmp/open-design/skills/plan-design-review/SKILL.md` — OD skill catalogue entry (T4 0-10 dims source)
- `/tmp/open-design/skills/creative-director/SKILL.md` — OD skill catalogue entry (T5 source)
- `/tmp/open-design/skills/web-design-guidelines/SKILL.md` — Vercel-style rules (cross-referenced in T3 prompts)

---

## Changelog

### v4.0 · 2026-05-27 (this ADR)

- First proposal of 5-tier model.
- T1 carries v3 verbatim; T1.10–T1.13 added (cross-client leak, logo refs, link cache, JSON-LD validity).
- T2 NEW: brand-contract compliance · 5 dims · 100% deterministic.
- T3 merges v3 T2 (codex) + v3 T3 (vision) into a unified 8-dim "rendered site" tier.
- T4 NEW: designer-review · adapted from OD `design-review` + `plan-design-review` · 5 dims × 0–10 + AI-slop sub-score.
- T5 NEW: creative-director · adapted from OD `creative-director` · 3-axis Cannes-calibrated · premium opt-in.
- Composite formula: weighted sum + lowest-tier floor term + per-tier hard gates.
- `audit-v4-issues.json` schema · P0/P1/P2 severity · mandatory concrete `fix` field.
- Determinism: pinned model + temp 0 + seed + structured-output JSON.
- Migration plan: 4-week shadow run · then v3 alias retired.
