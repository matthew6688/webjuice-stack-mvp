# HANDOFF · Next Session · ProfitsLocal · 2026-05-29 (after R70–R87)

> Read FIRST: `docs/v3/INFRASTRUCTURE-INVENTORY.md` (look #0) · `docs/v3/CANONICAL.md` §0/§8.
> Governance: every structural change → codex round + update INFRASTRUCTURE-INVENTORY (SOP).
> (Prior handoff content superseded; this reflects state after the R70–R87 session.)

## Where we are (this session: R70–R87 · ~22 commits)

**Phase-1 audit→feedback→fix loop: SEALED** (`docs/v3/PHASE-1-SEAL.md` · codex R77 · connected
copy-only PASS). pl-compose-loop (dry-run default · fact-guard P0 red line · rollback) +
compose-feedback (resolveTrueWriter · never writes derived site-ctx). Audit standard
consolidated → `docs/v3/SOP-AUDIT-STANDARD-V2.md` (SSOT · T4-three-meanings resolved). Vision
LOW_CONFIDENCE guard. claude CLI re-authed → vision trustworthy (vicwest full-tier 79/B/SHIP).

**P2-0 (data completeness): DONE.**
- `pl:build-single-page-brief` — deterministic render-contract builder (core-extract.real_facts
  > master.md fm > null/data_gap · no LLM · no fabrication). mark/vicwest VALID.
- license: `entity.license` now FLOWS to brief; `pl-license-lookup` confidence-gated (abn/
  licence/name-exact = canonical; token/fts → _candidates · needs_manual_license_confirm · ABN
  cross-check). Caught a false "Mark Squire"→"Mark Prain Builders" match (P0).
- `pl:geo-suburbs` — offline suburb-within-radius (GeoNames CC BY 3.0 · data/geo/au-localities.json
  · centroid haversine). a-j unblocked (3 verified + 40 geo_derived). gate: verified+geo_derived≥8.

**P2-1 (real-vs-AI provenance): data + machine + image-decision layers DONE.**
- `docs/v3/SOP-PROVENANCE.md` — canonical tiers verified>geo_derived>ai_inferred>ai_placeholder>
  stock_placeholder · source_kind subtypes · replace_policy none/confirm/replace_required.
- `pl:provenance-map` (reader → provenance-map.json + missing_sections) · `pl:provenance-annotate`
  (preview data-provenance/data-replace · LIVE HARD-OFF · separate index.preview-annotated.html).
- `docs/v3/SOP-IMAGE-STRATEGY.md` (codex R86/R87) — quality-gated mixed; section matrix;
  usage_intent (fallback_missing_real vs intentional_design_asset); hard-no list; two-pass cost plan.
- `pl:image-decisions` (reader → image-decisions.json) — VERIFIED decision layer: vicwest
  hero→REAL img-06 (q9/fit10) · gallery→8 REAL · honest stock fallback. a-j → "missing · classify first".

## IMAGE TOPIC — closure state (updated R88)

**CLOSED (this session):** decision + policy + RENDER (vicwest end-to-end).
- Strategy: `SOP-IMAGE-STRATEGY.md` (quality-gated mixed · cost two-pass · usage_intent).
- `pl:image-decisions` — selects real images per gate → image-decisions.json.
- **RENDER WIRED (codex R88)**: composer reads image-decisions.json → copies verified real photos
  to assets/ → renders "Completed Projects" single-photo grid (data-provenance=verified · NO fake
  before/after · SOP §9). vicwest page now shows 6 REAL roof photos; provenance-map #gallery =
  verified. Mutually-exclusive gallery.projects/gallery.pairs (real wins → pairs suppressed).

**NOT done (next session):**
- **a-j / mark have NO source photos** (handoff/photos/source empty · never classified) → still
  stock/missing (honestly flagged · not mixed into vicwest). Need website-image download
  (pl-extract-crawl-images · filter *.pages.dev/screenshots · zero Google quota) → classify →
  image-decisions → recompose.
- **Two-pass cost classifier (codex R87)** not built (pl-classify-images still per-image).
- **hero image slot**: editorial hero is text-only this round (codex R88 #3 · left as text).
- design/copy quality polish (see below · 91/A is FAST tier only · NOT a design cert).

**Also honest (design/copy quality):** the 91/A/SHIP on vicwest is FAST tier = deterministic
facts/mechanics ONLY (vision_confidence n/a). It does NOT certify design or copy quality. The
last real vision audit was 79/B (claude · hero 71) and 57/REJECT (local gemma · cited "generic
copy, low-quality imagery, inconsistent design"). Design polish + persuasive copy = Phase-2/3,
NOT yet done. Do not present current renders as production-grade design.

## NEXT SESSION — open work (codex-sequenced)

1. **Two-pass image classifier (cost · codex R87)**: rewrite `scripts/cli/pl-classify-images.js`
   → overview contact-sheet (gemma local · 150px · bucket+shortlist ≤10) → detail (claude · 1600px
   · quality_score/brand_fit) → canonical `image-manifest.json`. Mark `core/handoff/classify-images.js`
   legacy (cheap-but-coarse A · $0.05 contact-sheet · merge its category/best_placement).
2. **Image render wiring**: composer consumes image-decisions.json → real photos into hero/gallery/
   service slots (resolveImage is currently DEAD CODE; galleryPairs hardcoded stock). NUANCE: gallery
   is before/after PAIRS but real photos are singles → SOP §9 forbids fake before/after → needs a
   single-photo "our work" grid OR pair only real before/after. provenance-map must then show real.
3. **a-j/mark image backfill**: after two-pass ships, run classify (website images · zero Google
   quota · filter *.pages.dev/screenshots per codex R85) → image-decisions → recompose.
4. **GBP photos (optional · needs Matthew's Google Places quota OK)**: pl-places-enrich +
   pl-download-places-photos for a-j/mark (never enriched).
5. **P2-2 service set fix**: a-j/mark services still have Chinese draft descs + unverified services
   (no backbone). provenance-map flags them ai_inferred/confirm. Fix the service SET (drop unverified,
   surface verified · D2.11 set_level_change · was Phase-1-blocked).
6. **P2-1c client UI**: human-facing "replace checklist" (after reviews/images fill produce real
   replace_required items).
7. **provenance-map polish**: scan rendered HTML assets/stock/* → mark stock_placeholder (codex R84
   #3 · not yet done) · field-level service provenance (short_desc = llm_from_verified_service_list).

## Test clients
vicwest-roofing (richest · hand brief · GREEN · real images) · a-j-roofing-solutions (QLD · geo
suburbs · no real images yet) · mark-squire-roof-restorations (VIC · license omit · 18 suburbs).
