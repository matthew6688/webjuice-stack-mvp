# Visual Auditor — Autoresearch

Generated: 2026-05-10T15:00:09.296Z
Duration: 700.0s
Fixtures: 3 · Candidates: 2

## Per-candidate summary

| Candidate | Tier | Parse rate | All-fields rate | Avg latency | Avg issues |
|---|---|---|---|---|---|
| **ollama-qwen3.6-27b-nothink** | T0 | 100% | 100% | 124.3s | 3.0 |
| **ollama-gemma3-27b** | T0 | 100% | 100% | 109.0s | 5.0 |

## Side-by-side per fixture

### Queensland Roofing Pty Ltd

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b-nothink | yes | 1 | 1 | 1 | 1 | severely_outdated | The provided screenshots are completely blank white images, indicating a total f |
| ollama-gemma3-27b | yes | 4 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated design that could benefit f |

**First issue per candidate:**

- **ollama-qwen3.6-27b-nothink** — critical: Screenshots are completely blank
  - observed: Both the desktop and mobile screenshots provided are entirely white with no visible text, images, buttons, or navigation elements.
  - why problem: A visitor seeing a blank page assumes the website is broken, the business is closed, or it is a scam. It is impossible to trust a business that cannot display its own website.
  - correct: A fully rendered webpage with a visible header, navigation menu, hero section with an image, and clear call-to-action buttons.
  - fix: Ensure the website files are correctly hosted and accessible. If this is a staging environment, ensure the correct URL is provided for the audit.
- **ollama-gemma3-27b** — major: Low-Resolution Hero Image
  - observed: The hero image on desktop appears pixelated and low resolution.
  - why problem: A blurry image immediately signals a lack of professionalism and attention to detail. A customer searching for a reliable roofing service will likely assume the quality of the work will also be subpar.
  - correct: High-resolution, professionally shot image of a completed roofing project, optimized for web display (around 1920x600px).
  - fix: Replace the current hero image with a high-quality, professionally photographed image. Ensure the image is optimized for web use to reduce file size and improve loading speed.

### Roof Space Renovators

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b-nothink | yes | 4 | 5 | 6 | 4 | slightly_outdated | The site uses a dated stock-photo aesthetic and cluttered navigation that distra |
| ollama-gemma3-27b | yes | 6 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated design that could benefit f |

**First issue per candidate:**

- **ollama-qwen3.6-27b-nothink** — critical: Mobile CTA buried below fold
  - observed: On the mobile screenshot, the 'Get in touch for a free quote' button is not visible; the user sees the headline and the top of the family photo, but must scroll to find the action.
  - why problem: A local customer searching on their phone wants to know if they can get a quote immediately. If they have to scroll past the hero image to find the button, they will likely bounce back to Google results.
  - correct: The primary 'Get a Free Quote' button should be visible immediately below the headline on mobile, or a sticky bottom bar should appear as soon as the user scrolls.
  - fix: Move the CTA button above the fold on mobile, placing it directly under the 'Love the space you're in' headline, or implement a sticky 'Get Quote' button fixed to the bottom of the screen.
- **ollama-gemma3-27b** — major: Low-Resolution Hero Image
  - observed: The hero image featuring the couple appears pixelated and low-resolution, especially noticeable on desktop.
  - why problem: A blurry image immediately signals a lack of professionalism and attention to detail. A local customer searching for a reliable roofing company will likely perceive this as a sign of a poorly run business and quickly leave.
  - correct: High-resolution, professionally shot image of a finished attic renovation or happy customers. Image should be optimized for web and appear sharp on all devices.
  - fix: Replace the current hero image with a high-resolution, professionally photographed image. Ensure the image is optimized for web to reduce file size and improve loading speed.

### Brisbane Roof Restoration Experts

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b-nothink | yes | 4 | 4 | 5 | 6 | slightly_outdated | The site uses a functional but dated layout with a cluttered form and low-contra |
| ollama-gemma3-27b | yes | 5 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated design that could benefit f |

**First issue per candidate:**

- **ollama-qwen3.6-27b-nothink** — critical: Low contrast white text on light background
  - observed: The main headline 'Brisbane Roof Restoration Specialists' is white text overlaid on a light blue sky background. The text has a drop shadow, but the contrast is low, making it look washed out.
  - why problem: A visitor scanning the page on a bright phone screen will struggle to read the headline instantly. If they can't read it easily, they assume the business is unprofessional or the site is broken.
  - correct: Dark charcoal or navy text on the light background, or a dark semi-transparent overlay behind the text to ensure high contrast.
  - fix: Change headline color to #1a1a1a (dark grey) or add a dark overlay (opacity 0.4) behind the text block.
- **ollama-gemma3-27b** — major: Outdated Hero Gradient
  - observed: The large blue gradient background in the hero section appears dated and unprofessional.
  - why problem: Gradients like this were popular in the early 2000s and now make the business look less current and trustworthy. A potential customer searching for a roof restoration service might assume the business isn't up-to-date with modern techniques.
  - correct: A clean, flat color background or a high-quality, relevant image of a restored roof. Use a single primary brand color.
  - fix: Replace the gradient with a flat, modern background color (e.g., a muted blue or gray) or a professional photograph of a completed roof restoration project.

## Decision

Pick the cheapest candidate that meets ALL of:
- parse_success_rate >= 100%
- has_all_fields_rate >= 80% (every issue has all 4 actionable fields)
- issues identified are visually grounded (judged by reading the side-by-side above)

If T0 (ollama) candidates pass, use them — zero cost. Otherwise add paid models in iter 2.

## Regenerate

```
npm run audit:test-visual-autoresearch
```

Per-candidate raw outputs: ../../../data/v2/fixtures/visual-autoresearch/2026-05-10T15-00-09

---

## Hallucination check (CRITICAL FINDING — 2026-05-11 follow-up run)

The first run (2026-05-10T14:36:34) showed gemma3 producing 5 issues per lead vs qwen 0 (timeout). After fixing qwen with `think:false`, the re-run (this report) reveals a more interesting picture: **gemma3 hallucinates content when the input screenshot is blank or insufficient**.

### Test case: Queensland Roofing Pty Ltd

The Playwright fetch produced a blank-white screenshot (5851 bytes, all white pixels) because the site's HTTPS endpoint hangs after a 301 redirect from HTTP. Visually inspecting the file confirms: nothing on the screen.

| Candidate | Saw blank? | Issues produced |
|---|---|---|
| **qwen3.6-27b (think:false)** | ✓ correctly identified | 1 issue: `blank_screenshots` (critical) — "Both desktop and mobile screenshots are entirely white with no visible text, images, buttons, or navigation. A visitor seeing a blank page assumes the website is broken, the business is closed, or it is a scam." |
| **gemma3:27b** | ✗ hallucinated content | 4 issues incl. "Low-Resolution Hero Image: hero image on desktop appears pixelated and blurry, especially noticeable in the **roofing tiles**" — there are no roofing tiles, no hero, nothing. Total fabrication. |

### Why this matters

If the visual auditor's output drives the redesign brief (per the actionable-audit memory rule), hallucinated issues directly poison the redesign:
- Designers waste hours "fixing" a fabricated stock-photo problem
- The real problem (the site is unreachable from any modern browser via HTTPS) is hidden
- Operator trust in the audit collapses as soon as one hallucination is spotted

**qwen-nothink's blank-screenshot detection is itself a valuable signal** — it surfaced an underlying Playwright fetch bug AND a real production-grade outage on the customer's site (broken Sucuri/Cloudproxy HTTPS).

### Decision

**Selected model: `ollama-qwen3.6-27b` with `think:false`.**

Trade-off: ~14% higher latency (124s vs 109s avg) and fewer issues per lead on real-content cases (3 vs 5). Acceptable because:
- 100% parse / 100% all-fields rate (matches gemma)
- Honest about insufficient input — does not fabricate
- Found a unique major issue gemma missed on Roof Space Renovators (`desktop_nav_clutter` — "8 distinct menu items in header")
- T0 zero cost, runs locally

### Implementation

`scripts/leads/build-internal-report.js` prefer order updated to:
1. `ollama-qwen3.6-27b-nothink` (selected)
2. `ollama-qwen3.6-27b` (legacy fallback)
3. `ollama-gemma3-27b` (last-resort fallback)

Memory rule landed: `feedback_qwen_disable_thinking.md` — all qwen invocations across the codebase default to `think:false`.

### Future autoresearch

Worth comparing against:
- Claude Sonnet via Claude Code CLI (T1 sub) — likely best honesty + grounding
- GPT-4o-mini direct API (T2 cheap) — speed reference
- Kimi vision — Moonshot's grounding is rumored strong

Add when the existing T0 candidate hits a real edge case it can't handle (rare with qwen-nothink given current data).
