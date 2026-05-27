# Design Review · v2-tasteskill-core (warm-paper editorial)

## 5-Dim Scoresheet (each 0-10)
- Philosophy consistency: **7/10** · DESIGN-NOTES claims "warm-paper editorial · terracotta + slate · asymmetric but restrained", and the HTML largely delivers: paper `#f4efe6`, brick `#b8492c` on every CTA/star/focus ring, Bricolage Grotesque (not Inter, not Geist), italic emphasis on the H1 word "winter". Loses 3pts because the bento (`svc-1` + `svc-2` large, then 4 small) is described as the signature move but in the actual rendering it doesn't read as dramatically asymmetric — closer to "2 highlighted + 4 standard" than to true editorial bento.
- Visual hierarchy: **8/10** · Hero split (7/5 copy/form) works cleanly; section-head pattern (eyebrow + H2 + lede) is consistent; the about+process combined section is the smartest structural move in the set — kills the section count without losing content. Reviews and gallery are clean. The Bricolage display variable weight + italic on "winter" gives the hero a real focal moment.
- Detail execution: **8/10** · The Section 9.G em-dash sweep (`Done in 3-5 days`, all hyphens not en-dashes) is a discipline most variants didn't bother with. `font-feature-settings: "ss01","cv11"` for IBM Plex stylistic sets. `@media (prefers-reduced-motion)` gating on every transition. Real `data-reveal` IntersectionObserver scroll-fade. The brick dot on the brand-mark `::after` is a quiet brand touch. Some unevenness: `var(--star)` defined as `#c98a1e` but stars on reviews use brick — minor inconsistency.
- Function (conversion path · CTA prominence · trust signals): **8/10** · Brick CTAs are highly visible against cream paper; form lives in hero aside; sticky mobile phone bar is brick — high contrast. Trust bar uses real numbers. The "Talk to a Ballarat roofer, not a call-centre" contact H2 is the best converting copy on any of the 5 variants. Solid.
- Innovation (departure from AI default): **6/10** · Distinguishable from v0 instantly — warm paper, brick instead of amber, Bricolage instead of Inter. But it sits inside a well-trodden "premium-craft warm-cream Squarespace" lane that AI also produces. Not as committed as v1 or v3. Picks "tasteful editorial" rather than picking *one specific* editorial.
- **Total: 37/50**

## Top 3 strengths
- The strongest copywriting + visual marriage of the five. "Roofs built to outlast a Ballarat *winter*" with italic-brick "winter", then "Talk to a Ballarat roofer, not a call-centre" later — the words and the design are working the same job.
- Real attention to the Taste-Skill anti-default checklist: no Inter, no slate-900, no centred hero, no 3-equal cards (the bento attempt counts), no glassmorphism, em-dashes swept. Hard discipline visible in the source.
- The about+process combined block is the right structural call — most roofing sites pad these as two sections; combining them keeps trust-narrative compact and prevents zigzag-fatigue.

## Top 3 weaknesses
- The asymmetric bento (`svc-1` + `svc-2` large, 4 small) is the headline differentiator but visually under-delivers. Either commit harder (true 12-col 6/3/3/3/3/6 with portrait vs landscape image crops) or fall back to a clean 3×2 grid.
- The brick CTA + cream paper is the safest premium-craft pairing in 2025 — it works, but it's also the look every Squarespace template and Framer artisan-bakery site has converged on. The "soft skill" follow-on (v4) shows how to push further.
- Form field treatment is competent but unmemorable: 4px radius inputs with brick focus ring is fine, but doesn't carry the editorial register the rest of the page sets up.

## Top 5 concrete fix recommendations
1. Make `svc-1` and `svc-6` true full-width hero cells (16:9 image, span 2 cols on 3-col grid) so the bento actually reads bento · `.services-grid { grid-template-columns: repeat(6, 1fr); } .svc-1, .svc-6 { grid-column: span 6; } @media(min-width:980px) { .svc-1, .svc-6 { grid-column: span 6; } .svc-2, .svc-3, .svc-4, .svc-5 { grid-column: span 3; } }`
2. Resolve the `--star: #c98a1e` vs brick inconsistency — pick one. Brick keeps the palette tight · selector `.stars svg`
3. Add a brick-coloured `::first-letter` style on the about section's first paragraph to introduce an editorial drop-cap moment · `.about-copy p:first-of-type::first-letter`
4. Bump form input padding to 14px y, 16px x — same shape, more breathing room, reads more "editorial publication" less "Bootstrap form" · `.hero-form input, .hero-form select`
5. Add italicised brick emphasis to one word in each H2 (mirroring the H1 "winter" treatment) — currently only the H1 carries the italic-brick fingerprint, so the move feels like a hero gimmick not a system · `.section-head h2 em` pattern

## Audience fit
The 40-55 Ballarat homeowner who reads *Country Style* and follows local artisan trades on Instagram. Trusts "small honest crew, warm paper, italic accent". Will also resonate with female decision-makers in heritage-suburb households — a register the navy-amber v0 actively repels.

## Verdict
- Recommended ship lane: **YES-with-fixes**
- Must-fix items: (1) commit the bento harder or fall back to 3×2, (2) star colour consistency, (3) form field breathing. The base is solid; it just needs to finish the asymmetric-bento promise the DESIGN-NOTES made.
