# Brand Injection Map — Editorial × Vicwest

Brand tokens inlined verbatim from `clients/vicwest-roofing/v2/brand/brand-tokens.css`; editorial design-system tokens now read from them.

| Brand var | Editorial token mapped onto it | Renders at |
|---|---|---|
| `--brand-primary #0F1115` | `--fg`, `--accent-on` (text on brass CTA), footer `bg`, mobile-CTA `bg` | All headlines, masthead-cta border, footer surface, mobile sticky bar |
| `--brand-secondary #6D6E71` | brand-rule divider in masthead | Header logo separator |
| `--brand-accent #C5A572` (brass) | `--accent`, `--meta` | H2 underline, primary CTA fill, eyebrow/folio text, section-meta rule, drop-cap initial, blockquote ❝, review left-border, pair-caption badge, link hover, focus-ring |
| `--surface #FFFFFF` | `--bg` | Page surface, story cards, form |
| `--surface-muted #F4F4F5` | `--bg-warm` | Strap, review cards, coverage block, about figcaption |
| `--text #1B1D22` | `--fg-2` | Body copy, chip text, suburb pills |
| `--text-muted #5A5C61` | `--muted` | Form note, strap labels, captions |
| `--border #E4E4E7` | `--border-soft` | All hairlines, card borders, form inputs |
| `--roof-shadow rgba(15,17,21,.18)` | `--elev-raised` | Hero image lift, story hover, about figure, form card, mobile CTA shadow |

**Explicit overrides** (editorial defaults that brand replaced): rust `#9a5a2f` → brass `#C5A572` everywhere · sand-cream `#fbf7f0` → white · radii 8–12px → 2–4px · IBM Plex Mono → JetBrains Mono · italic blockquote → upright · body Source Serif Pro → Inter / Inter Tight · footer warm-gray text → `#B5B5B7` on `--brand-primary` per brand-spec.json footer rule.

**Logo placements**: `logos/logo-horizontal.svg` (header, 40px) · `logos/logo-mono-light.svg` (footer, 48px on dark) · `logos/favicon.svg` (browser tab).
