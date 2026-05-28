# Design Review · v5-od-editorial (OD `editorial` design system · "Ballarat Roofing Journal")

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **9/10** · DESIGN-NOTES claims a magazine-as-website transposition and the HTML literally honours it. The `editorial` tokens are pasted verbatim (lines 56-115), nothing is overridden by a second `:root`, every spacing / colour / font is `var(--*)`. Folios "Section I … VI" run consistently across all six major sections, each with a thematic eyebrow ("The Catalogue", "The Workshop", "From the letters page", "The Plates", "The Beat", "The Correspondence"). Drop-cap on the about, "Plate 01" hero caption, colophon footer with "Set in Source Serif Pro & Georgia" type-credit — these are real editorial gestures, not vibe-words. The discipline holds across nine sections. Loses 1pt because the bookish micro-copy ("Send the brief", "Request a written quote") slightly over-eggs the conceit — Vicwest is a roofer, not a publisher.
- Visual hierarchy: **8/10** · True five-step ladder: H1 92px → H2 66px → H3 30px → body 18px → meta 12px is a real magazine scale, not the compressed sans ladder most AU trade sites ship. The folio + eyebrow + H2 + lede section-head is unambiguous. Pull-quote reviews with a 48px caramel curly-quote glyph give reviews proper editorial weight. Loses 2pts because the strap (22+ / 10yr / VBA / 4.1) is visually quieter than the v0 trust strip — at first scroll the credentials whisper rather than punch.
- Detail execution: **9/10** · The micro-details earn the magazine claim: 88px Georgia drop-cap on the first paragraph of about, mono `Plate 01 · Colorbond replacement · Sebastopol` overlay on the hero photo, captioned figures everywhere (no naked images), the dark colophon footer with `--fg` background + paper text + `Set in Source Serif Pro & Georgia · VBA · CDB-U 65938` type-credit line. The hairline `--border-soft` rules between sections enforce the bound-issue rhythm. The 4:5 portrait hero image is a magazine cover aspect, not a SaaS 16:9.
- Function (conversion path · CTA prominence · trust signals): **7/10** · Primary `Request a written quote` is a real coloured button at 48px min-height with a 4px focus ring — much more legible than v1's 12px mono. Phone is always visible in the masthead and pinned on mobile. Trust strip + chip row + JSON-LD all present. Loses 3pts because: 112px section padding makes the page genuinely long, the form sits in section VI not the hero column, and the bookish copy ("Send the brief") will read as quirky to a 55+ Ballarat homeowner expecting "Send enquiry".
- Innovation (departure from AI default): **8/10** · Roman-numeral folios across every section + thematic eyebrows + drop-cap + Plate caption + colophon footer is genuinely uncommon in AU trade space. The 4:5 portrait hero is a real departure from the 16:9 SaaS hero default. Loses 2pts because the underlying palette (warm cream + Georgia + caramel) sits inside the same 2024-2025 "editorial Squarespace" lane as v2 and v4 — distinguishable from them, but the AI-template universe is already adjacent. v3 holds more singular moat.
- **Total: 41/50**

## Top 3 strengths
- The folio + thematic-eyebrow system across all six sections is the single best structural decision in the set. It turns nine content blocks into "Issue 03 of a publication", which is a register no Ballarat competitor will photocopy by next quarter.
- The token discipline is exemplary: verbatim `:root` paste, no overrides, every value via `var(--*)`. Provable that the design system is doing the work, not the page.
- The about-block drop-cap + Plate-01 image caption + colophon type-credit are the kind of editorial micro-decisions that reward the close reader. They cost nothing and lift the page out of the trade-site median in one pass.

## Top 3 weaknesses
- The bookish micro-copy ("Send the brief", "Request a written quote", "From the letters page") will read as twee to half the suburban Ballarat audience. The publication metaphor is load-bearing in the layout — it doesn't need to be load-bearing in the button labels too.
- 112px desktop section padding pushes the page to a long scroll on a service business where the goal is "find phone number → call". The strap (22+ / 10yr / VBA / 4.1) deserves to appear earlier and louder.
- Single accent (`--meta: #9a5a2f`) is used for eyebrows, drop-cap, chips, stars, accent-button, and folio rule — five overlapping jobs. v3's discipline (one accent for one job, the form asterisk) is more rigorous; v5's caramel is a workhorse rather than a poetic moment.

## Top 5 concrete fix recommendations
1. Trim the bookish CTA labels: `Send the brief` → `Send enquiry`, keep `Request a written quote` only on the primary hero CTA · selectors `.btn-primary[type="submit"]`, `.actions a.btn-primary` in the contact form
2. Lift the metric strap above the hero on landscape ≥1100px or duplicate the 22+/10yr/4.1 chip cluster directly under the H1 — the credentials read too quietly at first scroll · `.strap` reorder or `.hero-chips` enrichment
3. Cap section padding at 96px (currently 112px) — magazines breathe more than service sites can afford to · `:root { --section-y-desktop: 96px; }`
4. Reserve `--meta` caramel for the drop-cap + Plate caption + folio rule only; switch eyebrows and chips to `--muted` so the accent recovers some restraint · selectors `.eyebrow`, `.chip::before`, `.story-number`
5. Replace the dark colophon footer's "Set in Source Serif Pro & Georgia" credit with one that says something the customer actually values — e.g. `Ten-year workmanship warranty · VBA CDB-U 65938 · Ballarat 2003-2026` · selector `.colophon-bar`

## Audience fit
The Lake Wendouree / Newington / Soldiers Hill homeowner with some design literacy — same band as v3 but warmer and less austere. Also a credible register for Vicwest's heritage-restoration work and any architect-referred job. Will read as too quirky for the median Sebastopol/Wendouree quote-shopper.

## Verdict
- Recommended ship lane: **YES-with-fixes**
- Must-fix items: (1) detune the bookish micro-copy, (2) bring the strap forward / earlier, (3) reserve the caramel accent for fewer jobs. Once those land this is a stronger v2-replacement than v4 in the "warm editorial" lane because the folio system is structurally distinct, not just stylistically warmer.
