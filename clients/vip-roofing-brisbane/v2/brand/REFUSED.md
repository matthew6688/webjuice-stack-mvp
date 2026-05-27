# Brand kit generation: REFUSED

**Slug**: vip-roofing-brisbane
**Date**: 2026-05-27
**Phase**: Phase 1B · brand-design experiment (logo-brand-design-integration)
**Gate**: `pl:data-checkpoint`
**Verdict**: **RED**

## Why refused

The data-checkpoint gate (`clients/vip-roofing-brisbane/v2/checkpoint.json`,
generated 2026-05-27T03:45:23Z) returned `verdict: RED`.

Per the project's hard rule ("OD hard rule · 数据不够直接 skip" / "Data Checkpoint
强制 SOP"), a RED verdict means **refuse to open downstream production
(OD, brand-kit, multi-page)**. AI fallback is permitted with INTERNAL provenance,
but the gate must be respected — and this experiment's own prompt also says:
"If status RED → STOP · write REFUSED.md · report back."

## What the checkpoint says

- `hard_ok: 6 / 7` · `rich_ok: 5 / 6` — most hard fields pass
- **Single failure forcing RED**: `service_content`
  - `handoff/content/services.json` present but **empty**
  - Source URL is a **parked domain / ad-landing page** ("Book Your Own
    Appointment Online", "Walk-In Showers for Bathrooms", etc. — unrelated
    boilerplate)
  - Hard rule (2026-05-27): if `handoff/content/services.json` is present
    but empty / parked-domain → RED. This closes the prior VIP defect where
    core-extract reported services but the extractor wrote 0 from a parked
    landing page.

## Fix path (NOT for this agent — owner = data intake)

The checkpoint's `missing[0].fix` says:

> Scrape hit a parked / ad-landing page (not the actual business website).
> Re-intake against a real URL via
> `npm run pl:scrape-docker -- --niche <niche> --city <city>`
> or manually update entity `existing_website` then re-run
> `npm run pl:enrich-handoff -- --slug vip-roofing-brisbane`.
> **NEVER AI-generate the service list.**

That fix is upstream of brand-design and out of scope for this Phase 1B
experiment.

## What was NOT generated

Nothing. Specifically, none of the following were created:

- `brand-spec.json`
- `brand-tokens.css`
- `logo-mark.svg` / `logo-wordmark.svg` / `logo-horizontal.svg`
- `logo-dark.svg` / `logo-light.svg`
- `logo-mono-dark.svg` / `logo-mono-light.svg`
- `favicon.svg` / `social-avatar.svg`
- any review / handoff / QA docs

Only this `REFUSED.md` exists in `clients/vip-roofing-brisbane/v2/brand/`.

## Downstream signal

Any downstream agent that reads this directory and looks for brand assets
should treat the absence as **gated, not missing**: do not retry, do not
fall back to AI-generated brand. Wait for re-intake (real website scrape)
to flip the checkpoint to YELLOW or GREEN, then re-run brand-kit generation.

## References

- Checkpoint JSON: `clients/vip-roofing-brisbane/v2/checkpoint.json`
- Hard rule memory: "Data Checkpoint 强制 SOP" + "OD hard rule · 数据不够直接 skip"
- Experiment doc: `docs/v3/EXPERIMENT-LOGO-BRAND-DESIGN-INTEGRATION.md`
- Canonical SOP: `docs/v3/SOP-DATA-CHECKPOINT.md`
