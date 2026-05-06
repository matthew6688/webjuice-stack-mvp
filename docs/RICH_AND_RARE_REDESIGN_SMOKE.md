# Rich & Rare Redesign Smoke

Updated: 2026-05-06

## Purpose

Challenge the restaurant workflow against a business that already has a decent official website.

The goal was not to prove this is an automatic build target. The Lead Qualification Engine correctly marked Rich & Rare as `good_website` and `recommendedAction: skip`. This smoke asks a different question:

> If a human decides to challenge the system anyway, can we use existing evidence and produce a better, framework-compatible redesign?

## Flow Used

```text
Official site / Google Places evidence
-> Clean client artifacts
-> Apply artifacts to webjuice-restaurant framework
-> Build local generated repo
-> Screenshot QA
-> Create Cloudflare Pages live/dev projects
-> Create GitHub client repo and push main/dev
-> Attach ProfitsLocal subdomain
-> Public domain QA
-> Funnel endpoint smoke checks
```

## Design Direction

Direction: `Premium Steakhouse Editorial`

Principles:

- website route first, not menu route;
- use official logo and real official restaurant photography;
- dark cellar-blue hero, brass accents, ivory editorial sections;
- sell steak, seafood, West Village, private dining, booking, call, and map;
- keep menu highlights factual and secondary.

## Outputs

Client artifacts:

- `clients/rich-and-rare-restaurant/content.restaurant.json`
- `clients/rich-and-rare-restaurant/design.restaurant.json`

Generated local repo:

- `/Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant`
- GitHub: `https://github.com/matthew6688/rich-and-rare-restaurant`

Main implementation file:

- `/Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant/src/pages/index.astro`

Published URLs:

- Production custom domain: `https://rich-and-rare.profitslocal.com/`
- Production menu route: `https://rich-and-rare.profitslocal.com/menu/`
- Production Pages URL: `https://rich-and-rare-restaurant-live.pages.dev/`
- Development Pages URL: `https://rich-and-rare-restaurant-dev.pages.dev/`

QA evidence:

- `data/qa/rich-and-rare-redesign/desktop-final-home.png`
- `data/qa/rich-and-rare-redesign/mobile-final-home.png`
- `data/qa/rich-and-rare-redesign/mobile-final-menu.png`
- `data/qa/rich-and-rare-redesign/qa-results-final.json`
- `data/qa/rich-and-rare-redesign/qa-results-domain-final.json`

Domain evidence:

- `data/domain/requests/rich-and-rare-restaurant/smoke_rich_rare_publish_001.json`
- `data/domain/rich-and-rare.profitslocal.com.json`
- `data/domain/rich-and-rare.profitslocal.com.pages-status.json`

## Verification

Build:

```bash
npm run build
```

Result:

```text
11 page(s) built
status: success
```

Production preview screenshot QA:

```text
desktop-final: HTTP 200, 0 console/page errors, no horizontal overflow, images loaded
mobile-final:  HTTP 200, 0 console/page errors, no horizontal overflow, images loaded
/menu mobile:   HTTP 200, 3 sections, 9 items, no horizontal overflow
```

Link assertions:

```text
reserve links: 4
tel links: 3
map links: 2
```

Public copy check:

```text
internalCopyPresent: false
toolbarPresent: false
```

Cloudflare Pages projects:

```text
rich-and-rare-restaurant-dev:  GitHub Actions Deploy Dev completed/success (latest run 25422728793)
rich-and-rare-restaurant-live: GitHub Actions Deploy Live completed/success (latest run 25422717332)
```

Public URL checks:

```text
https://rich-and-rare-restaurant-dev.pages.dev/  -> HTTP 200
https://rich-and-rare-restaurant-live.pages.dev/ -> HTTP 200
https://rich-and-rare.profitslocal.com/          -> HTTP 200
https://rich-and-rare.profitslocal.com/menu/     -> HTTP 200
```

Custom domain QA:

```text
domain desktop:      HTTP 200, 0 console/page errors, no horizontal overflow, images loaded, insecureAssets 0
domain mobile:       HTTP 200, 0 console/page errors, no horizontal overflow, images loaded, insecureAssets 0
domain /menu mobile: HTTP 200, 3 sections, 9 items, no horizontal overflow, insecureAssets 0
```

Funnel endpoint smokes inherited from the restaurant framework:

```bash
npm run smoke:revision-request
npm run smoke:approval-request
npm run smoke:domain-request
```

Result:

```text
all passed
```

## Notes

The initial auto-parsed menu artifact had bad section grouping. The smoke fixed this by using a cleaned, smaller menu set:

- banquet prices where clear;
- signature dish descriptions without invented prices;
- private dining facts from official site copy.

This is an important lesson for the Collect Skill: menu extraction needs a confidence gate. If the parser cannot preserve section structure, the website should use verified menu highlights instead of pretending the full menu is clean.

## Publishing Lessons

The redesign did successfully pass our hosted subdomain route, but the run exposed several useful process fixes:

- Store `CF_ZONE_ID` locally and check it before domain work. Cloudflare zone lookup by name returned a generic 500 once; explicit zone IDs make ProfitsLocal-owned subdomains reliable.
- Domain inspection must be Cloudflare-aware. A proxied Cloudflare CNAME appears as A/AAAA records in public DNS, so plain `dig CNAME` can falsely say the domain is not ready. `scripts/domain/inspect.js` now checks Cloudflare DNS records when `CF_ZONE_ID` is available.
- Normalize scraped asset URLs to HTTPS before deployment. One official Squarespace image used `http://`; browser QA caught the mixed-content warning and the content artifacts were corrected.
- Create GitHub repo variables/secrets before the first push. The first live workflow failed because `PAGES_PROJECT_NAME` and Cloudflare secrets were not available at workflow start. Rerunning after setup passed.
- Add `pages_build_output_dir = "dist"` to generated/template `wrangler.toml` so Wrangler stops warning that it is ignoring Pages config. This was applied to the template and Rich & Rare repo.
- Add `--commit-dirty=true` to generated/template Pages deploy workflows so build output does not create noisy dirty-worktree deploy warnings. This was applied to the template and Rich & Rare repo.
- Direct Wrangler deploy is a useful emergency smoke, but the durable process must be repo-backed `main`/`dev` so Hermes/Discord revisions have a stable project to modify and redeploy.
- GitHub Actions now warns that Node 20 based actions will be deprecated. This is not blocking today, but the template workflow should move to Node 24-compatible actions before GitHub enforcement dates.
