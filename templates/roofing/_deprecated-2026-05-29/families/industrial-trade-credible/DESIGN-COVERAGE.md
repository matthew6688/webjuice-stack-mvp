# DESIGN.md vs Module Library · Coverage Audit

Generated 2026-05-18 · `pl-compose-site` uses these 27 block types across 3 customer sites.

## Status legend
- ✅ Explicitly specified in DESIGN.md §4
- 🟡 Partially covered (tokens/principles apply but no module-specific rules)
- 🔴 Not specified — module author had to extrapolate

## Per-module coverage

| Block | Used by pages | DESIGN.md spec | Gap |
|---|---|---|---|
| `hero` (cinematic / banner / split / form variants) | home, all roles | 🔴 | No hero spec. 4 variants exist with inconsistent eyebrow/h1 sizes, min-heights, overlay gradients. |
| `trust-bar` | home, about, contact | ✅ §4 Trust Bar | Aligned |
| `services-grid` | home, services | ✅ §4 Service Card | Aligned |
| `service-card` (single) | service-detail hero region | ✅ §4 Service Card | Aligned |
| `why-us` | home, about, services, service-detail | 🟡 (Cards generic) | No 3-col vs 4-col rule, no icon spec, no body length guidance |
| `process` | home, services, service-detail | 🔴 | No step-card spec — numbers vs icons, vertical vs horizontal |
| `gallery` | home, our-work, services | 🔴 | No grid-density, aspect-ratio, hover-treatment spec |
| `faq` | every page | ✅ §4 FAQ Accordion | Aligned |
| `cta-band` | every page | 🟡 | Buttons covered, band layout not (centered-dark vs split-image variants) |
| `contact-form` | contact | ✅ §4 Form Fields | Field-level covered, multi-column form layout not |
| `about-body` | about | 🔴 | No long-form prose rules (line-length, paragraph break) |
| `about-timeline` | about | 🔴 | No timeline / vertical-list pattern |
| `before-after` | home, service-detail, our-work | 🔴 | No interactive slider spec |
| `case-study` | service-detail, our-work | 🔴 | No case-card layout, no spec-list rules |
| `comparison-table` | services, service-detail | 🔴 | No table styling rules |
| `emergency-callout` | storm-damage page | 🔴 | No semantic-emergency / colored-band rules |
| `financing-band` | home, services | 🔴 | No band-with-options pattern |
| `lead-form` | every page | 🟡 (Form fields covered) | No lead-band layout (text-left + form-right) spec |
| `legal-body` | legal pages | 🔴 | No legal-prose rules |
| `map-embed` | contact | 🔴 | No iframe-side-by-side pattern |
| `product-spotlight` | home, services, service-detail | 🔴 | No product-spec card |
| `proof-strip` | home, our-work | 🔴 | No logo-strip / cert-tile spec |
| `reviews` | home, our-work, about | 🔴 | No review-card spec |
| `safety-insurance` | about, contact | 🔴 | No coverage-card spec |
| `service-areas` | home, contact | 🔴 | No chip-list / suburb-grid spec |
| `spec-callout` | services, service-detail | 🔴 | No profile-comparison spec with SVG visuals |
| `stats-band` | home, our-work | 🔴 | No big-number band spec |
| `team-grid` | about | 🔴 | No staff-card spec (photo / name / role) |
| `warranty-detail` | home, services, service-detail | 🔴 | No tier-card spec |

## Summary

| Coverage | Count | % |
|---|---|---|
| ✅ Fully specified | 5 | 19% |
| 🟡 Partially covered | 4 | 15% |
| 🔴 Not specified | 18 | 67% |

## Where DESIGN.md drift shows up in practice

1. **Section padding** — 18 modules use `padding: clamp(64px, 9vw, 120px) 0` (consistent) but `cta-band` uses 80px, `emergency-callout` uses 56px. No rule in DESIGN.md fixed this.

2. **Section heading hierarchy** — Every section has eyebrow + h2 + (optional) lead-paragraph. But:
   - eyebrow font-size varies 11px-12px
   - eyebrow letter-spacing varies 0.1em-0.16em
   - h2 size clamp ranges differ (28-34, 30-38, 36-44, 40-64 px)
   - lead font-size varies 16-18 px
   DESIGN.md §3 Hierarchy mentions H1-H4 but no rule for the "section-eyebrow / section-h2 / section-lead" 3-line pattern that every block uses.

3. **Max-width on inner grids** — Pre-fix bug we just patched: 10 modules had `max-width: 1100px / 1200px` inside a 1240px container. DESIGN.md §5 says "Container max-width 1280px" but doesn't say "don't constrain further inside container."

4. **Spacing system** — DESIGN.md §5 defines 8-base scale but doesn't say which scale step to use per pattern (eyebrow-to-h2 = ?, h2-to-lead = ?, lead-to-content = ?). Modules each picked own values.

5. **CTA button hierarchy in non-CTA sections** — DESIGN.md §4 Buttons covers primary/secondary, but inside `gallery`, `case-study`, `before-after` there are mini-CTAs ("View all projects", "Get a quote →") with their own treatments that aren't covered.

## Recommendations for DESIGN.md V2

### Add §4.X for every module pattern

- **§4.9 Section Head** — eyebrow (uppercase mono, 11px, 0.12em, brand-accent) + h2 (display, clamp(28px,3.6vw,38px), brand-primary) + lead (17px serif, 1.55 line, text-muted, max 60ch)
- **§4.10 Stat Card** — number (display, 56-72px, brand-accent on dark / brand-primary on light) + unit (sup) + label (mono, 13px)
- **§4.11 Process Step** — circle number (or icon) + title + 2-line body, grid in 4-col on desktop / stack on mobile
- **§4.12 Gallery Tile** — aspect 4:3, hover scale 1.03, no border, 16px gap
- **§4.13 Case Study Card** — 2-col flipped pattern, spec-list with mono labels, 4:3 image
- **§4.14 Before-After Slider** — 16:10 ratio, white divider w/ accent handle, BEFORE/AFTER pills top corners
- **§4.15 Comparison Table** — 3-col, mono row labels, alternate column shading
- **§4.16 Spec Callout** — 3-card grid with SVG profile visuals, middle card featured (brand-primary bg)
- **§4.17 Warranty Tiers** — 3-card grid, big-number + title + body + issuer, middle featured
- **§4.18 Timeline** — vertical list w/ accent dots, year + title + body, 760px max-width
- **§4.19 Team Card** — 4:5 portrait + name + role-mono + bio
- **§4.20 Review Card** — quote + name + suburb + rating
- **§4.21 Emergency Band** — red bg, yellow CTA, urgency typography (heavier weight)
- **§4.22 Map Embed** — 1.5fr iframe + 1fr side-info card
- **§4.23 Lead Form** — text-col (1fr) + form-col (1.1fr), 56px gap, surface-muted bg
- **§4.24 Footer** — 2fr + 1fr × 3 grid (brand wider), trust-strip below, © centered

### Fixed rules to add

- **§5.6 Inner Wrappers** — sections wrap in `.container` (1240px). Inner grids do NOT add their own max-width.
- **§5.7 Section Vertical Rhythm** — every section: `padding: clamp(64px, 9vw, 120px) 0` (no exceptions).
- **§5.8 Section Head Spacing** — eyebrow→h2 = 16px, h2→lead = 12px, head→content = 48px.

## Bigger architecture observation

DESIGN.md should not list 24 specific patterns — that's brittle. Better: define **5 atomic patterns** that everything composes from:
1. Section head (eyebrow + h2 + lead)
2. Card (with optional image, with title, with body, with footer)
3. Grid (2/3/4 col with breakpoints)
4. Number callout
5. Pair (label + value, used in spec-lists)

Then every module documents WHICH atomic patterns it uses and any module-specific deviations get explicit approval.
