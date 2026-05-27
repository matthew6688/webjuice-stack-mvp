# Codex Response 2 · Next Move

**Date**: 2026-05-27  
**Pick**: **Move C · Fix the 3 in-flight customers' data-layer gaps**

## 1. Pick

Pick **C**, with one important ordering constraint: start with **VIP's data-checkpoint bug**, not with the mechanical customer cleanup.

The trade-off I weight most heavily is that VIP exposes a stable-layer gate failure. The checkpoint currently owns the canonical GREEN/YELLOW/RED decision and is supposed to exit 1 on RED (`scripts/cli/pl-data-checkpoint.js:14-21`, `scripts/cli/pl-data-checkpoint.js:335`). VIP's generated checkpoint says `GREEN` / `multi` (`clients/vip-roofing-brisbane/v2/checkpoint.json:2-4`) even though the handoff service extractor wrote an empty service list and explicitly said the scrape was a parked/ad landing page (`clients/vip-roofing-brisbane/v2/handoff/content/services.json:2-4`). That is not just customer-specific cleanup; it is a defect in the gate that all future customers depend on.

I would defer **A** because skill docs are useful but do not change today's behavior or unblock any of vicwest/vip/a-j. I would defer **B** because `pl:compose-site` is still the unstable layer: it validates handoff, then loads handoff/spec/content inputs (`scripts/cli/pl-compose-site.js:209-247`, `scripts/cli/pl-compose-site.js:249-291`), but it does not consume `issue-fix-matrix` or `FIX-INSTRUCTIONS.md`; those only show up in docs/iterate paths (`scripts/cli/pl-iterate-site.js:3-12`, `scripts/cli/pl-iterate-site.js:213-214`, `docs/v4/CODEX-RESPONSE.md:64-70`). Closing B would also force the new `compose-result.json` contract that the prior response explicitly said not to make mandatory yet (`docs/v4/CODEX-RESPONSE.md:101`).

## 2. First Concrete File Edit

First edit: **`scripts/cli/pl-data-checkpoint.js`**

Change description:

1. Read `clients/<slug>/v2/handoff/content/services.json` and, if present, `clients/<slug>/v2/handoff/od-package/content/services.json`.
2. Add a hard gate, e.g. `service_content`, that fails when services are empty, when all services are meta/non-real after the existing real-service filter, or when extractor notes contain parked-domain/ad-landing signals.
3. Reuse the existing hard-field/missing mechanism so this naturally makes `verdict = "RED"` and exits 1 (`scripts/cli/pl-data-checkpoint.js:170-200`, `scripts/cli/pl-data-checkpoint.js:256-284`, `scripts/cli/pl-data-checkpoint.js:335`).
4. Add a fix hint that points upstream to scrape/enrichment/research-pack repair, not AI-generating core service facts.
5. Keep the current signal-score logic, but remove the false-positive path where core-extract reports many services while the handoff package that the builder consumes has zero usable services.

Why this edit first:

- The current checkpoint counts services from `core.real_facts.service_list` only (`scripts/cli/pl-data-checkpoint.js:99-103`) and never cross-checks the actual handoff services file that downstream tools consume.
- The handoff audit catches empty services later (`scripts/cli/pl-audit-handoff.js:176-184`), but the checkpoint is the earlier burn-prevention gate.
- The composer has its own dangerous fallback that invents service descriptions from page slugs or generic roofer services when `services.length === 0` (`scripts/cli/pl-compose-site.js:293-316`). A RED checkpoint is the right upstream guard against reaching that path with bad data.

## 3. Stop Criterion

This move is done when all three in-flight customers are no longer blocked by data-layer defects:

1. **VIP**: `npm run pl:data-checkpoint -- --slug vip-roofing-brisbane` returns exit 1 and writes `checkpoint.json.verdict = "RED"` until real, non-parked service evidence exists. The RED must cite `service_content` or equivalent, and must not suggest AI-generating core services.
2. **Vicwest**: scrub the customer-facing meta-language tokens from `content/about.md`, `content/services.json`, and `content/faq.json`; rerun `pl:audit-handoff` and get zero hard failures, with P5 either pass or only intentionally accepted soft notes. The current forbidden-token detector is in `scripts/cli/pl-audit-handoff.js:60-64` and P5 scans those customer-facing files at `scripts/cli/pl-audit-handoff.js:210-231`.
3. **A-J**: run the missing asset/brand steps so `image-manifest.json` and the brand pack files exist, then rerun `pl:audit-handoff`. The audit requires the brand files at `scripts/cli/pl-audit-handoff.js:41-58`, checks `image-manifest.json` at `scripts/cli/pl-audit-handoff.js:92-148`, and the package scripts exist for `pl:classify-images` / `pl:audit-handoff` (`package.json:375-376`).
4. The stable-layer doctors pass: `npm run ops:sop-audit`, `npm run ops:doc-freshness-audit`, and `npm run ops:skill-cli-validate`, matching the prior implementation order (`docs/v4/CODEX-RESPONSE.md:105`).

## 4. Next Move After C Closes

After C closes, do **A** next: write the 5 missing `SKILL.md` files and update the 3 existing skill docs.

Reason: once the live defects are fixed, the stable behavior is worth canonicalizing. The prior response's skill map is already specific enough to implement from (`docs/v4/CODEX-RESPONSE.md:13-25`), and the implementation order already starts with skill-doc updates plus the five missing stable skills (`docs/v4/CODEX-RESPONSE.md:105`). That avoids freezing today's known VIP bug into the skill layer.

Only after C then A would I take **B**. At that point, the stable data/handoff contracts are documented, and the compose-site bridge can be designed as an explicit experimental-to-canonical graduation step rather than as an emergency customer fix.
