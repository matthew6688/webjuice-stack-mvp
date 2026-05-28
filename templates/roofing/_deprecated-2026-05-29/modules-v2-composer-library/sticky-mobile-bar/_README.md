# sticky-mobile-bar

Fixed-position bottom bar that surfaces a tap-to-call CTA + a quote CTA on mobile only.

## Variants

- **`phone-cta-pair.html`** (default · canonical for roofing single-page)
  - Two buttons: `Call {{phone}}` (uses `--brand-accent`) + `Get a Quote` (outlined)
  - Visible only when `window.scrollY > 200` (avoids competing with the hero CTA above-fold)
  - Shown only at `max-width: 720px`
  - Tap targets `min-height: 48px` (a11y · ≥44px requirement)
  - Honours `env(safe-area-inset-bottom)` for iOS notch / home-indicator
  - Background: `color-mix(in oklab, var(--brand-primary), transparent 8%)` with subtle top border in brand-accent

## Variables consumed

| Mustache var       | Source                                    |
| ------------------ | ----------------------------------------- |
| `{{tel_link}}`     | `compose-site` `baseCtx.tel_link`         |
| `{{phone}}`        | `compose-site` `baseCtx.phone` (display)  |

## SOP reference

SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD §2 block 12 ("sticky mobile bar").

## Placement contract

This module emits `position: fixed` content; in `pl-compose-site --single-page`
it is rendered AFTER `</footer>` so it sits as an absolute layer above page flow.
