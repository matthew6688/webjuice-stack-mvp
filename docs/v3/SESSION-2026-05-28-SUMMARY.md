# Session Summary · 2026-05-28 · ProfitsLocal Canonical v1.0 lock

> **TL;DR**: V1 composer is canonical render path. 5 P0 audit framework locked. 4 deprecated paths archived. 2 of 4 clients SHIP-ready (vicwest GREEN · a-j YELLOW). 36+ commits · 11 codex consensus rounds (R26-R36). Next session continues with Phase B Step 5 (a-j → GREEN promotion · then mark-squire/abc enrichment).

## Read this first if you're a new agent

1. **`docs/v3/CANONICAL.md`** (master index · 11 locked decisions + re-test triggers · 226 lines)
2. **`CLAUDE.md §7`** (existing-work-discovery operating constraint)
3. **`docs/v3/SOP-AUDIT-STANDARD-V2.md`** (audit framework · 618 lines)
4. **`docs/v3/CANONICAL-DECISION-RECORD-RENDER-PATH.md`** (V1 = canonical)

## What got locked today

### Render path
- **V1 `pl:compose-editorial`** = canonical (template + Mustache + skill-driven data injection)
- **V5 hybrid** (`--use-wireframe` opt-in flag) = fallback for narrative quality issues
- **Path A (OD daemon)** = deprecated · 13 variants · 0/13 hit ≥85
- **Path C (LLM whole-page)** = deprecated · -71pt token coverage loss · 11pt variance · 50% mobile veto · premium leak-free 20 vs V1 100

### Audit standard v2 · 7 ordered hard gates (CANONICAL.md §3)
```
GATE 1 · checkpoint GREEN (YELLOW+banner ok · RED hard-block)
GATE 2 · brief.yaml validates
GATE 3 · minimum_content_signal (services ≥3 · suburbs ≥3 · reviews-or-banner)
GATE 4 · M1 mobile mechanical (overflow + sticky + critical tap-target)
GATE 5 · fast-tier audit (T1 + T2 + T4d + D2.14 + D2.11 + composite ≥80)
GATE 6 · premium-tier audit (D2.10 ≥70 · 0 leak · 0 halluc)
GATE 7 · regression fixture
```

### N/A_BLOCKED rule (codex R35 Q-PP-5)
Audit refuses to publish composite numbers (93/99/etc) when any blocker fails. Critical because empty content (abc RED · 0 services) was scoring composite 99 by absence-of-bad. Now blocked clients show `composite: "N/A_BLOCKED"` with block_reason explicit.

### 8 new audit dims wired
- D2.BC6 token coverage depth (5 categories: color/radius/shadow/space/motion)
- D2.BC7 logo variant per surface (light/dark detection)
- D2.14 proof variety (6 types · ≥3 required)
- D2.11 facts cross-check (HTML vs brief.yaml strict match)
- D2.10 engagement-persuasion (premium · codex-deep-audit D6)
- M1.1-M1.3 mobile mechanical vetos (Playwright at 390px)
- minimum_content_signal (anti-gaming check)

## 4-client status (snapshot)

| Client | Verdict | Notes |
|---|---|---|
| vicwest-roofing | SHIP · composite 91/A | GREEN · all 7 gates pass · 0 hallucinations · 0 banned phrases · production-ready |
| a-j-roofing-solutions | SHIP · composite 83/B | YELLOW + PREVIEW banner (placeholder reviews) · 5 services · 3 suburbs · valid SHIP path |
| mark-squire-roof-restorations | N/A_BLOCKED | GATE 1 RED · 3 missing hard fields · no website to crawl · 3 GBP reviews · upstream enrichment needed |
| abc-roof-restoration-brisbane | N/A_BLOCKED | GATE 1 RED · 5 missing hard fields · phone/address absent · cross-state QLD · upstream enrichment needed |

## Critical insights to remember

### "Less LLM freedom = better quality"
Empirical: V1 template (Mustache + content fill) beats V3 LLM (whole-page render) on:
- Composite 91 vs 85.5 mean
- Variance 0 vs 11pt
- Cost $0 vs $0.30/render
- CSS token coverage 90 vs 19 (LLM strips design system architecture)
- Premium leak-free 100 vs 20 (LLM whole-page leaks form labels)

Reason: design is a SYSTEM (spacing scale · radius tokens · shadow tokens · animation timing · grid rhythm) that templates encode and LLMs cannot reliably reproduce. LLM excels at copy generation (constrained) · not whole-page render (unconstrained).

### "Audit composite is inversely correlated with data depth on thin clients"
Discovered when abc-roof RED (no phone · no address · 0 services) scored audit 99 because "no banned phrases · no hallucinations · brand kit intact" = audit-gamed by emptiness. **Checkpoint GATE is the correct filter · not composite alone.**

### "Existing-work discovery prevents wheel-rebuilding"
Twice today I almost proposed building new artifact types that already existed (codex R22 7 artifacts · 5 already exist · 1 renamed · only 1 truly new). CLAUDE.md §7 now mandatory for profitslocal project.

## What's NOT locked (provisional · explore freely · CANONICAL §6)

- Lead-side pipeline orchestration (discovery → enrichment → checkpoint sequencing)
- Multi-template selection (editorial-portrait · lead-capture-phone-first)
- Premium-tier LLM dims D2.13 · D3.10 · M1.4-5 (deferred per codex R30)
- Phase C sales materials (outreach copy · email · Stripe)
- Phase D outreach automation
- Per-niche thresholds (electrician vs plumber differs from roofing)

## Today's commits · in order (36 total · key milestones bolded)

```
cde3043d  R-BA-6 hard rule + image prompts v2
a0366635  Phase A.1 audit-bug pivot · D2.1/D2.2 false-negative fix
edee4074  LocalBusiness JSON-LD partial
088ffe9a  AS-trade-5 cheerio DOM detector
ad3c657e  E2E fixture · 11 assertions golden contract
bcec3a77  Audit backport · 3 SHIP recovered
d7b16dad  T4d voice rules
3719a442  Persona overlay copywriter
391a046c  PHASE3-PARITY-CHECKLIST
5a4ce39c  editorial-newsletter template extracted from Phase 3
723597ae  pl:compose-editorial CLI built
**3b6c5038  SOP-AUDIT-STANDARD-V2 (618 lines · 5 P0 framework · canonical)**
cffe0722  4 fast-tier dims (BC6/BC7/D2.14/D2.11)
767d18f4  M1 mobile gate Playwright
c3d18a07  Fast-tier 3-site sanity calibration PASS
d139a960  ABN + tap-target fixes (audit feedback loop closed)
7f4cd46e  D2.10 engagement-persuasion premium tier
9b3814ef  3-path experiment data (V1/V3/V4/V5)
**041bc966  CDR · V1 canonical · cross-client a-j PASS · Path C archived**
3d23e56c  stock-library V2-batch-2 · 22 new images digested
b23919cb  IMAGE-PROMPTS-V3 · 15 prompts dispatched
**f0aa9b79  CANONICAL.md v1.0 · master institutional memory**
**c89f0220  N/A_BLOCKED hierarchy + minimum_content_signal · §3 tightened**
```

## Next session start point

### Immediate (per codex R36 next-session direction)
1. Promote a-j YELLOW → GREEN via `pl:llm-infer-thin-data` (fills testimonials · suburbs_served · owner_name)
2. Re-audit a-j · expect composite ≥83 (no regression) + verdict GREEN+SHIP (not YELLOW+banner)
3. Attempt mark-squire `pl:summarize-external-mentions` once · accept skip if data is genuinely missing (no website · 3 GBP reviews) · cross-client validation 2 of 3

### Then
4. **Phase B Step 6**: `pl:audit-rubric.json` (61 rules) wired into audit-v4 dispatch (currently doc-only)
5. **Phase B Step 7**: `pl:site-report` CLI (9-section provenance · sales material)
6. **Phase B Step 8**: V2 module library README updated to "legacy fallback only"

### Phase B done definition
- 3+ GREEN-ready clients (currently 1 · with a-j promotion = 2)
- pl:audit-rubric wired
- pl:site-report shipping
- V1 composer + audit standard v2 production-ready

### Phase C trigger (after Phase B done)
- Outreach copy templates
- Email pitch generation
- Stripe link integration
- Cold email automation

## Open questions for Matthew (deferred from today · not blocking)

1. **Lead pipeline consolidation system** (Matthew Q · "我们筛选的标准是什么 · 客户从不同渠道进来 · license · DB integration · photo curation")
   - Multiple enrichment CLIs exist (pl:scrape-docker · pl:places-enrich · pl:tinyfish-extract · pl:license-build-index · classify-images.js)
   - Need unified orchestrator with explicit filtering thresholds
   - Goal: modular CLI for Hermes Agent integration
   - Deferred per Matthew's own permission · "如果方案可行 · 我们再回来"

2. **V4 client funnel** (Matthew mentioned · need to re-investigate)
   - Different scoring tiers for client tier (A/B/C/D · qualification)
   - Database integration for industry-database sourced leads
   - Photo curation pipeline (high-quality customer photos vs template fallback)

3. **Image library V3 batch** (15 prompts dispatched today)
   - Heritage + tropical + insurance + design-family + extra B/A pairs
   - Drop in stock-library/ root when generated
   - Workflow: same as V1/V2 · I'll digest + manifest update

## What MUST be true on next session start

- `docs/v3/CANONICAL.md` exists and is v1.0 (don't re-litigate locked decisions)
- audit-v4 N/A_BLOCKED logic active (don't show 93/99 for RED clients)
- 4-client audit baselines unchanged (vicwest 91 · a-j 83 · mark-squire/abc BLOCKED)
- editorial-newsletter template untouched (canonical)
- CLAUDE.md §7 first-read-CANONICAL still pointed
- 22 images in stock-library subdirs · manifest tracks 78

## What MAY have changed (next-session check)

- New images dropped in `templates/roofing/stock-library/` root (IMAGE-PROMPTS-V3 batch · Matthew generates at his pace)
- Matthew may have run lead pipeline / enrichment manually on some clients
- mark-squire/abc may have gotten upstream data added
- Path C re-test triggers may have new evidence (don't re-litigate without it)

## Session end · 2026-05-28 · 36 commits · 11 codex consensus rounds · canonical v1.0 LOCKED

Don't drift. Read CANONICAL.md first.
