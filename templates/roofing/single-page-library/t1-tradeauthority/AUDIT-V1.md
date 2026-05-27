# T1 TradeAuthority · Self-Audit v1

**Date**: 2026-05-27 · post-form-update screenshots
**Auditor**: Claude (self) · viewports tested 1440×900 desktop, 390×844 mobile (iPhone 13)

## Overall verdict

**B+** · ships as-is but ~12 concrete improvements would push to A. Strongest: hero, trust bar, services grid, sticky mobile CTA. Weakest: section background rhythm, copy consistency, process-section visual weight.

---

## Per-axis grades

| Axis | Grade | Notes |
|---|:---:|---|
| **Above-fold conversion** | A | Phone + form + 2 CTAs + 1 trust chip all in 700px · email-mandatory model now correct |
| **SEO foundation** | A | 1 H1, 7 H2, JSON-LD valid, meta description present, semantic HTML5, alt on all images |
| **Visual design** | B+ | Clean Pentagram-style grid · navy/amber works · few transition issues |
| **Typography** | B+ | Inter Tight + Inter loaded properly · 1 issue with smart quotes |
| **Copywriting** | B | Strong concrete language · 2 consistency issues (callback vs email-response) |
| **Mobile UX** | A− | Sticky bottom CTA visible · form stacks · hero pushes form below fold (acceptable) |
| **Accessibility** | B+ | aria-required on form · alt text on images · color contrast OK · missing skip-nav |
| **Performance** | A− | 52KB HTML, ~12KB gzipped, no JS frameworks · only loose end is image weight |

---

## 🔴 P0 · Must fix before showing to a paying customer (4 items)

### 1. Contact-section headline says "Same-day callback" but form says email-first

**Where**: section #contact heading + `.section-lede` paragraph
**Symptom**: I changed form copy to email-first but left the headline saying "Same-day callback. Easiest: pick up the phone."
**Fix**: change heading + intro to:
- H2: "Free on-site quote. Same-day email response."
- Lede: "Pick up the phone for fastest response. Otherwise drop your name + email and we'll write back within 2 hours during business hours."

### 2. Process headline uses straight quotes around colloquial phrases

**Where**: "Six steps from `\"I think we've got a leak\"` to `\"It's sorted, mate.\"`"
**Symptom**: Straight ASCII quotes feel ugly at large display size. Smart quotes ("") would be more polished.
**Fix**: replace `"` with `"` open and `"` close (already used in review section).

### 3. Service card "Call now: 0403 554 592 →" breaks visual rhythm

**Where**: services-grid · 4th card "Storm & Emergency Repairs"
**Symptom**: 5 cards have "Get a X quote →" links (consistent verb pattern). The storm card has "Call now: 0403 554 592" (different pattern). When eye scans the grid, this single card sticks out distractingly.
**Fix**: change to "Call us 0403 554 592 →" or "Get emergency help →" (`tel:` link is still good · just match the verb pattern).

### 4. JSON-LD `@type: "RoofingContractor"` is non-standard

**Where**: JSON-LD in head
**Symptom**: `RoofingContractor` is a specific schema but Google's reference is `LocalBusiness` or `HomeAndConstructionBusiness` parent. `RoofingContractor` IS in schema.org as a specific HomeAndConstructionBusiness subclass · so it's valid.
**Verdict**: Actually correct · keep as-is. (Validated via schema.org docs.) **No change needed.**

---

## 🟡 P1 · Quality improvements (7 items)

### 5. Hero subhead readability on dark navy overlay

**Where**: hero subhead paragraph "Re-screw, re-coat, replace — with a 10-year written warranty..."
**Symptom**: text at `rgba(250, 250, 247, 0.92)` on navy gradient is readable but a touch low-contrast at the right edge where gradient fades to 0.35 opacity.
**Fix**: Either (a) bump subhead color to full opacity `var(--paper)`, OR (b) add `text-shadow: 0 1px 2px rgba(15,46,76,0.4)` for safety.

### 6. "Or call 0403 554 592" link beside primary CTA is hard to spot

**Where**: hero CTA row
**Symptom**: It's a small mono-font link without obvious affordance. Users won't realize it's clickable.
**Fix**: convert to a secondary button style `.btn--ghost` with phone icon · matches design system.

### 7. Service cards low contrast with paper background

**Where**: services-grid
**Symptom**: Cards are `background: var(--paper)` on `background: var(--paper)` body. Border is `--border` (E8EAEC). The 1px border barely shows · cards feel like they're floating without separation.
**Fix**: Either (a) make card bg `white` (slight pop) OR (b) change body bg in this section to slightly darker `#F3F3EF` · OR (c) increase shadow on cards `box-shadow: var(--shadow)`.

### 8. Section background transitions feel abrupt

**Where**: paper → white → paper → white → paper rhythm
**Symptom**: Service (paper) → About (white border-top) → Process (paper) → Reviews (white) → Gallery (paper) → Service Area (navy) → Contact (white). Some transitions have a 1px border line · others don't. Slightly inconsistent.
**Fix**: Standardize · use same `border-top: 1px solid var(--border)` between every white↔paper transition.

### 9. Gallery section heading wraps awkwardly on mobile

**Where**: mobile seg-m4
**Symptom**: "Before. After. Photographed at the job, not staged." takes 3 lines on mobile · feels broken.
**Fix**: Reword to 2 lines max:
- "Before &amp; After"
- subhead: "Photographed at the job · not staged."
- OR keep but add explicit `<br>` to control line break

### 10. Process section feels visually thin

**Where**: process section
**Symptom**: 6 columns of numbers + 1-2 sentences each. Section is ~600px tall but feels like filler vs. about (1200px substantial content).
**Fix**: Either (a) add icons above each number, OR (b) add divider lines between steps, OR (c) accept that process IS quick-scan content and remove if can't add value.

### 11. Trust bar metric "VBA" as a value reads weirdly

**Where**: trust bar chip #2
**Symptom**: Numbers are "22+", "VBA", "4.1★", "15+". The "VBA" stands out as a non-number among numbers. Inconsistent metric type.
**Fix**: Either (a) change to a number: "100%" with label "Licensed & Insured", OR (b) keep "VBA" but reframe label to clearly identify license body, OR (c) replace with "0" with label "Subcontractors used".

### 12. Missing skip-to-content link for screen readers

**Where**: top of body
**Symptom**: WCAG keyboard navigation expects a skip link.
**Fix**: add `<a class="skip-link" href="#services">Skip to content</a>` with `.skip-link { position: absolute; left: -9999px; } .skip-link:focus { left: 0; top: 0; ... }`

---

## 🟢 P2 · Polish (5 items)

### 13. Hero phone link icon could be larger or replace with phone emoji
- Current: tiny SVG · easy to miss
- Better: 24×24 SVG OR full text "📞 0403 554 592" with clearer affordance

### 14. Quote card form button text could be more action-specific
- Current: "Request Free Quote"
- Better: "Email Me a Quote" (matches new email-mandatory flow)

### 15. Service-area suburbs could be H3-grouped by region
- Current: flat list of 18 pills
- Better: "Central Ballarat" group (8) + "Outer Ballarat" group (6) + "By arrangement" group (4)
- Better SEO for "{suburb} roofer" search variants

### 16. Footer "Built by ProfitsLocal" credit
- Current: shown with `opacity: 0.65`
- Decision: keep or remove? Probably remove for customer-facing demos · keep for internal previews

### 17. No favicon link
- Current: nothing
- Fix: `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><rect width='36' height='36' fill='%230F2E4C'/><text x='50%25' y='50%25' fill='%23FFB627' font-family='sans-serif' font-weight='800' font-size='16' text-anchor='middle' dominant-baseline='central'>VR</text></svg>">`
- Or use the actual logo when we have one

---

## Audit summary · 17 improvements

- **4 P0** · fix before any customer demo
- **7 P1** · quality polish · would push to A grade
- **5 P2** · nice-to-have

## What I'm NOT going to change without asking

- Color palette (navy + amber + paper + slate) — locked per design decision
- Section order (9 sections in current order is proven conversion sequence)
- Hero layout (split content + form) — strongest above-fold pattern for trade
- Font stack (Inter Tight + Inter + JetBrains Mono) — committed
- Brand mark size · location · style — minimal SVG works

## My recommendation

**Fix all 4 P0 (15 min) · then take a fresh screenshot · show Matthew.**

After Matthew validates the P0 fixes look good, I'll do the 7 P1 in a batch. P2 items can be backlog.

---

## Screenshots referenced

- Desktop full page: `/tmp/t1-screenshots/desktop-full-correct.png` (1440×8239)
- Mobile full page: `/tmp/t1-screenshots/mobile-full.png` (390×15059)
- Desktop segments: `/tmp/t1-screenshots/seg-d{1..5}.png`
- Mobile segments: `/tmp/t1-screenshots/seg-m{1..5}.png`
