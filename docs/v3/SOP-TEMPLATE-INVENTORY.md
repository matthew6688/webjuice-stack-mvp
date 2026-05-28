# SOP · Template Inventory · v1.0 · 2026-05-29

> **PURPOSE**: how to bring a new single-page template into the canonical library so that `pl:compose-editorial --template <name>` can render it for any client. Walked through for the first time on V0 → `trade-classic` (codex Round 38). All future templates follow this SOP.
>
> **TRIGGER**: any time someone wants to add a new template family (V1/V2/V3/V4 in `_compare/`, or a fresh design from huashu/taste-skill).
>
> **OUT OF SCOPE**: template-selector logic (defer until ≥2 inventoried templates · codex Q-SS-7).

---

## §0 · Empirical bars (must beat ALL to inventory)

| Gate | Requirement | Source |
|---|---|---|
| Composite ≥ 80 on all 3 calibration clients (vicwest / a-j / mark-squire) | CANONICAL.md §3 GATE 5 minimum | Codex Q-SS-4 (b) |
| T1 mechanical PASS on all 3 | CANONICAL.md §3 GATE 1+5 | Audit-v4 hard rule |
| M1 mobile vetos resolved on all 3 (M1.1 overflow / M1.2 sticky CTA / M1.3 tap targets) | CANONICAL.md §3 GATE 4 | Audit-v4 mobile_gate |
| 0 hallucinations · 0 banned phrases on vicwest at minimum | Pl-au-trade-voice rules | T4d voice audit |
| Render reproducible: identical output for identical inputs (no LLM in path) | Deterministic = $0 = scalable | CANONICAL.md §0 R-1 lock |

If any gate fails → fix until passes OR document why this template family isn't fit for canonical (e.g. "V4 Awwwards too maximalist for AU-trade · keep as design reference").

---

## §1 · Pipeline overview (7 stages · ~6-8h first time · ~3-4h thereafter)

```
Stage 0  Discovery        · 10min
Stage 1  Slot-fill        · 2-3h  (sub-agent does best · need precise brief)
Stage 2  DOM hooks        · 30min (audit selector compliance · cheap)
Stage 3  Brand-tokens     · 30min (wrap {{{brand_tokens_css_inline}}} inside <style>)
Stage 4  Composer wire    · 20min (--template flag · add ctx extensions)
Stage 5  Calibrate        · 1-2h  (3 clients · iterate audit feedback)
Stage 6  Inventory        · 30min (CANONICAL.md §0 + version bump + commit)
Stage 7  Template selector· deferred (only when ≥2 templates · codex Q-SS-7)
```

---

## §2 · Stage 0 · Discovery

1. Confirm template source is NOT in `templates/roofing/_deprecated-*/` (those failed audit · don't revive)
2. Confirm `single-page-library/_compare/<variant>/preview.html` exists with vicwest data
3. Read `DESIGN-NOTES.md` if present · understand the design philosophy
4. Note the variant's strongest dim from `COMPARISON-REPORT-FINAL.md` if scored

---

## §3 · Stage 1 · Slot-fill (use sub-agent · LLM faster than manual Edit on 1000+ line files)

### Mustache contract (MUST match editorial-newsletter)

Required placeholders the composer provides. **DO NOT INVENT NEW NAMES** · the composer's `ctx` is the SSOT.

**Meta + SEO + JSON-LD:**
```
{{seo.title}}  {{seo.meta_description}}  {{seo.canonical_url}}
{{seo.og_title}}  {{seo.og_description}}
{{{jsonld_localbusiness}}}      ← triple-brace · raw JSON insert
{{asset.favicon_path}}  {{brand.primary_hex}}
```

**Client data:**
```
{{client.business_name}}  {{client.short_name}}  {{client.email}}
{{client.phone_display}}  {{client.phone_tel}}  {{client.city}}  {{client.state}}
{{client.year_founded}}  {{client.years_in_business}}  {{client.warranty_years}}
{{client.rating}}  {{client.review_count}}  {{client.google_maps_url}}
{{client.address_full}}  {{client.suburb}}  {{client.maps_embed_url}}
{{client.license_authority}}  {{client.license_number}}
{{#client.license_visible}}…{{/client.license_visible}}    ← conditional
{{#client.email}}…{{/client.email}}                        ← REQUIRED guard
```

**Brand tokens (CRITICAL):**
```
<style>
{{{brand_tokens_css_inline}}}    ← MUST be inside <style> · D2.5 audit reads here
</style>
```

**Iterations:**
```
{{#services.items}}   {{title}} {{description}} {{image_src}} {{image_alt}} {{cta_label}} {{cta_href}}   {{/services.items}}
{{#reviews.items}}    {{stars_unicode}} {{quote}} {{author}} {{location}}                                  {{/reviews.items}}
{{#gallery.pairs}}    {{before_src}} {{before_alt}} {{after_src}} {{after_alt}} {{caption}}                {{/gallery.pairs}}
{{#coverage.suburbs}} {{.}}                                                                                {{/coverage.suburbs}}
{{#trust_bar.chips}}  {{value}} {{label}}                                                                  {{/trust_bar.chips}}
{{#about.paragraphs}} {{.}}                                                                                {{/about.paragraphs}}
{{#about.chips}}      {{.}}                                                                                {{/about.chips}}
{{#process.steps}}    {{num}} {{title}} {{desc}}                                                           {{/process.steps}}
```

**Banner:**
```
{{#reviews.is_placeholder}}<div class="reviews-disclaimer">…</div>{{/reviews.is_placeholder}}
```

**Section headings (use _html variant if template needs `<em>` or `<br>`):**
```
{{services.eyebrow}}  {{services.headline}}  {{services.subhead}}
{{about.eyebrow}}     {{{about.headline_html}}}
{{coverage.eyebrow}}  {{{coverage.headline_html}}}
{{contact.eyebrow}}   {{{contact.headline_html}}}
{{gallery.eyebrow}}   {{{gallery.headline_html}}}
{{reviews.eyebrow}}   {{reviews.headline}}  {{reviews.subhead}}
{{process.eyebrow}}   {{{process.headline_html}}}
{{colophon.year}}     {{colophon.tagline}}
```

### Verification commands after slot-fill

```bash
# Should ALL be 0 (no client residue from source variant · vicwest in case of V0-V4):
grep -c "Vicwest\|0403554592\|info@vicwestroofing\|Ballarat" templates/roofing/<name>/template.html

# Should be 80+ Mustache placeholders:
grep -c "{{" templates/roofing/<name>/template.html

# Critical audit hooks (audit-v4 selectors):
grep -c '<li class="suburb-pill"' templates/roofing/<name>/template.html      # expect 1 (iteration block)
grep -c "{{{jsonld_localbusiness}}}" templates/roofing/<name>/template.html  # expect 1
grep -c "{{{brand_tokens_css_inline}}}" templates/roofing/<name>/template.html # expect 1
```

---

## §4 · Stage 2 · DOM hook compliance (audit-v4 selectors)

These class names + tag structures are REQUIRED. Audit-v4 cheerio selectors look for them. If missing · GATE 3 minimum_content_signal BLOCKS the ship.

| Audit dim | Required DOM | Why |
|---|---|---|
| GATE 3 services count ≥ 3 | `<div class="services-grid">` containing `<article class="service-card">` (≥3) | `$('.story, [class*="services-grid"] article, [data-type="service"]').length` |
| GATE 3 suburbs count ≥ 3 | `<ul class="suburb-list">` containing `<li class="suburb-pill">` items | `$('.suburb-list li, [class*="suburb"] li, [class*="coverage"] li').length` |
| GATE 3 reviews count ≥ 1 OR banner | `<article class="review-card">` OR `<blockquote>` OR `<div class="reviews-disclaimer">` | `$('.review, [class*="review"]:not([class*="reviews-disclaimer"]), blockquote').length` + banner check |
| M1.2 sticky CTA | `<div class="sticky-cta">` containing `<a href="tel:...">` (wrapper div · anchor child) | Audit looks for `[class*="sticky"]` with descendant `a[href^="tel:"]` |
| M1.3 tap targets | All contact anchors `<a href="tel:..." class="contact-info__value">` need `display:inline-block; min-height: 44px; padding-block: 10px` | Anchors with `text` "0403 ..." must be ≥44×44px |
| D2.14 proof variety | 3+ of: `.review-card`, `.trust-chip` (stats), `.gallery-pair` (photos), expert quote, certifications | Mixed evidence types |
| AS-trade-5 hero form | Above-fold `<form>` must have ≤ 4 visible inputs | T1 hard rule |
| D2.BC7 logo variant per surface | Header `<img>` with class `logo*` + favicon | Logo detection |

### Common pitfalls (each cost us 1+ render-audit cycle to find)

- ✗ `<span class="suburb-pill">` items (not `<li>`) → 0 suburbs counted → GATE 3 BLOCKED. **Fix**: use `<ul><li>`.
- ✗ `<a class="sticky-cta" href="tel:..."></a>` (anchor IS the sticky element) → M1.2 looks for child anchor → fails. **Fix**: wrap anchor in `<div class="sticky-cta">`.
- ✗ `<a href="mailto:{{client.email}}">{{client.email}}</a>` without `{{#client.email}}` guard → empty hrefs on clients without email → M1.3 0×44 violation. **Fix**: always wrap email/phone anchors in conditionals.
- ✗ Hero `<form>` with 5+ inputs → AS-trade-5 fails. **Fix**: drop one (e.g. suburb input duplicates select).
- ✗ Footer `<a href="tel:...">` without min-height styling → 107×19 tap target. **Fix**: add `.site-footer p a[href^="tel:"] { display: inline-block; min-height: 44px; padding-block: 10px; }`.

---

## §5 · Stage 3 · Brand-tokens architecture

```html
<style>
/* === CLIENT BRAND TOKENS (composer-injected · D2.5 audit reads hex values here) === */
{{{brand_tokens_css_inline}}}
</style>

<style>
:root {
  /* Map composer-injected tokens to template-local names · keeps existing CSS working */
  --theme-color: var(--brand-primary);
  --navy: var(--brand-primary);          /* example: trade-classic uses --navy throughout */
  --amber: var(--brand-accent);
  --paper: var(--brand-paper, #FAFAF7);
  /* ...other template-local mappings */
}
/* ...rest of template CSS */
</style>
```

**Critical rule**: `{{{brand_tokens_css_inline}}}` MUST be inside `<style>` tags. D2.5 audit captures via regex `/<style[\s\S]*?<\/style>/g` and searches for brand-spec hex values inside.

**Compatibility note (codex Q-SS-3 b)**: do NOT yet extract to a shared `templates/roofing/shared/brand-tokens.css`. Each template inlines per-render. Promote to shared file only when ≥2 templates need identical token contract (future SOP refactor).

---

## §6 · Stage 4 · Composer wiring (`pl:compose-editorial`)

### Add `--template <name>` flag (already done in trade-classic · skip if exists)

```js
// scripts/cli/pl-compose-editorial.js
const templateName = args.template || 'editorial-newsletter';
const templatePath = path.join(REPO, 'templates/roofing', templateName, 'template.html');
if (!fs.existsSync(templatePath)) {
  die(`template not found: templates/roofing/${templateName}/template.html`);
}
```

### Add template-specific ctx extensions (additive · don't break editorial-newsletter)

If your new template needs ctx keys editorial-newsletter doesn't have (process.steps, trust_bar.chips, about.chips, headline_html variants, client.address_full, etc.), append them AFTER the `ctx = { ... }` build. Editorial-newsletter ignores unused keys.

```js
// Example (from trade-classic add):
ctx.process = { steps: [{num:'01', title:'Call or form', desc:'…'}, …], headline_html: '…', eyebrow: '…' };
ctx.trust_bar = { chips: [{value: `${yearsTrading}+`, label: `Years in ${city}`}, …] };
ctx.about.chips = ['VBA Licensed', 'Fully Insured', …];
ctx.hero.headline_html = ctx.hero.headline;
ctx.client.address_full = addrParts.join(', ');
```

---

## §7 · Stage 5 · Calibration (3 clients · audit feedback loop)

```bash
# Render + audit each client
for slug in vicwest-roofing a-j-roofing-solutions mark-squire-roof-restorations; do
  npm run pl:compose-editorial -- --slug $slug --template <name>
  npm run pl:audit-v4 -- --slug $slug --output-dir clients/$slug/v2/editorial-output --tier fast
done
```

### Iterate per audit failure

| Failure pattern | Where to fix |
|---|---|
| T1 1.14 AS-trade-5 form | Template · drop hero form input |
| GATE 3 services 0 | Template · use `[class*="services-grid"] article` DOM |
| GATE 3 suburbs 0 | Template · convert spans to `<ul><li class="suburb-pill">` |
| M1.2 sticky CTA missing | Template · wrap anchor in `<div class="sticky-cta">` |
| M1.3 tap target | Template CSS · `.contact-* a, .site-footer p a[href^="tel:"] { min-height: 44px }` |
| D2.5 brand palette honored 0 | Template · move `{{{brand_tokens_css_inline}}}` inside `<style>` |
| D2.BC6 token coverage <60 | Template CSS · increase `var()` usage in colors/radius/shadow/space props |
| Brand tokens empty in render | UPSTREAM · client missing `v2/handoff/od-package/brand/brand-tokens.css` · fix path or composer fallback |

### Restore canonical render after calibration

Trade-classic renders OVERWRITE editorial-newsletter's `editorial-output/index.html`. After calibration:
```bash
# Restore editorial-newsletter as the canonical render for each client
for slug in vicwest-roofing a-j-roofing-solutions mark-squire-roof-restorations; do
  npm run pl:compose-editorial -- --slug $slug   # no --template = default editorial-newsletter
done
```

(Future: dedicated `editorial-output-<template>/` subdirs to avoid overwrites. SOP v1.0 keeps single dir for simplicity.)

---

## §8 · Stage 6 · Inventory (CANONICAL.md §0 entry)

Add a row to CANONICAL.md §0 master state table:

```markdown
| **Template family · <name>** | Inventoried v<X.Y> · calibration scores <V>/<A>/<M> · all SHIP | templates/roofing/<name>/template.html | Replace = match editorial-newsletter ±5pt OR new persona-fit |
```

Bump CANONICAL minor version (e.g. v1.1 → v1.2). Codex consensus required (1 round).

Commit message format:
```
v4 · R<NN> · <template-name> inventory complete (<source-variant> · Nth add)

NEW: templates/roofing/<name>/template.html (N lines · Mustache)
  - <N> placeholders · 0 source-client residue
  - DOM hooks: …
  - <unique attributes>
…
Verification: vicwest <V> · a-j <A> · mark-squire <M> · all SHIP
```

---

## §9 · Stage 7 · Template selector (DEFERRED · codex Q-SS-7)

Only build `core/handoff/template-selector.js` when ≥2 templates inventoried. Until then composer default = `editorial-newsletter`. When 2+ exist, selector dispatches on brand_tier / rating / reviews / niche_detail.

Out-of-scope for THIS SOP. Separate codex round.

---

## §10 · Calibration baseline (today's truth · 2026-05-29)

| Template | vicwest | a-j | mark-squire | Avg | Notes |
|---|---|---|---|---|---|
| editorial-newsletter | 91 A | 89 A | 93 A | 91 | Canonical · best-of-breed warm editorial |
| trade-classic | 84 B | 82 B | 87 A | 84.3 | Just inventoried · safe navy/amber AU-trade |

Future templates compete against editorial-newsletter average (91). To be best for a niche-tier · should match within 5pt OR clearly dominate a persona segment.

---

## §11 · Anti-patterns (don't repeat the trade-classic learning curve)

1. **Don't slot-fill manually** for templates >500 lines. Use a sub-agent with the FULL Mustache contract from §3 as the brief.
2. **Don't trust the source variant's DOM** to be audit-compliant. Most huashu/taste-skill variants use `<span class="suburb-pill">` (audit can't see) instead of `<li>`. Always re-verify §4 selectors.
3. **Don't put `{{{brand_tokens_css_inline}}}` outside `<style>`** (D2.5 misses it).
4. **Don't add new ctx keys to composer** when the template can use existing names. Only extend when genuinely new (process.steps was new · headline_html was new).
5. **Don't ship a template that scores composite < 80 on any of the 3 clients.** Iterate until it passes OR retire the variant.
6. **Don't change the canonical editorial-newsletter** to accommodate a new template. Templates conform · composer is SSOT.
7. **Don't skip the calibration restore** · always re-render with editorial-newsletter after trade-classic testing to restore canonical client outputs.

---

## §12 · Out-of-scope (future SOP updates)

- Per-template `editorial-output-<name>/` subdirs (avoid overwrites)
- Shared `templates/roofing/shared/brand-tokens.css` (when ≥2 templates need it)
- `pl:validate-template-contract` lightweight check at compose time (codex Q-SS-5 c)
- Multi-page templates (Phase C+)

---

## §13 · Reference inventory (today's run)

Source: V0 (Claude default · 1108-line dead HTML at `templates/roofing/_deprecated-2026-05-29/single-page-library/_compare/v0-claude-default/preview.html`)
Inventoried: `templates/roofing/trade-classic/template.html` (902 lines · 97 placeholders)

| Stage | Time | Outcome |
|---|---|---|
| 0 Discovery | 10 min | V0 picked from 5 ranked variants |
| 1 Slot-fill | 25 min (sub-agent) | 97 placeholders · 0 residue |
| 2 DOM hooks | 15 min | `<li class="suburb-pill">` conversion · sticky wrapper |
| 3 Brand tokens | 5 min | Moved inside `<style>` |
| 4 Composer wire | 20 min | --template flag + ctx extensions |
| 5 Calibrate | 45 min | 3 audit cycles · 1 brand-tokens path fix |
| 6 Inventory | 30 min | CANONICAL.md row + commit |
| **Total** | **~2h 30min** | Faster than estimated 6-8h (sub-agent saved 3h on slot-fill) |

Bonus side-effect: fixed a-j's missing `v2/handoff/od-package/brand/brand-tokens.css` (was at `v2/brand/`) · editorial-newsletter score 83 → 89 (+6pt).

---

**Sign-off**: SOP v1.0 · 2026-05-29 · codex Round 38 · trade-classic as the canonical reference run. Update SOP when V1-V4 inventory reveals new pitfalls.
