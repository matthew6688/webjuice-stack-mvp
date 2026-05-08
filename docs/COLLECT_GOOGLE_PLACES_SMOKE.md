# Google Places Collect Smoke

Updated: 2026-05-06

## Purpose

Test whether the Collect skill can start from Google Places and gather enough data for a restaurant project.

## Query

```bash
npm run extract:google-places -- --query "restaurant in West End Brisbane" --niche restaurant --city Brisbane --count 1 --output data/collect-smoke/google-places-west-end.json --campaign collect-skill-smoke
```

## Result

Google Places returned:

```text
Rich & Rare Restaurant
97 Boundary St, West End QLD 4101, Australia
(07) 3638 8888
https://www.richandrare.com.au/
rating 4.8 / 3194 reviews
7 hours rows
10 photo references
Google Maps URL
```

## Finding

Google Places is good for identity/contact evidence but not enough for final restaurant website build.

Missing after Google Places:

- logo
- usable brand colors
- design language
- menu sections/items
- final reservation/menu distinction

## Follow-Up Enrichment

Official site + brand extraction filled:

- logo candidates
- official image candidates
- colors/fonts
- reservation/menu candidate links

Menu page scrape + menu parser filled:

- menu source
- menu sections/items

After enrichment:

```bash
npm run evidence:validate -- --file data/collect-smoke/rich-and-rare/evidence.json --niche restaurant
npm run pipeline:build-client -- --client rich-and-rare-collect-smoke --niche restaurant --evidence data/collect-smoke/rich-and-rare/evidence.json --out-dir data/collect-smoke/rich-and-rare/client
npm run intake:build-website-ready -- --client rich-and-rare-collect-smoke --evidence data/collect-smoke/rich-and-rare/evidence.json --content data/collect-smoke/rich-and-rare/client/content.restaurant.json --design data/collect-smoke/rich-and-rare/client/design.restaurant.json --brand data/collect-smoke/rich-and-rare/client/brand-spec.md --survey data/collect-smoke/rich-and-rare/client/intake/website-survey.json --build-packet data/collect-smoke/rich-and-rare/build-packet.md --source outbound
```

All three passed, and Ready-to-Build returned `website_ready_to_build`.

## Product Decision

The Collect skill should use Google Places as step 1, not as the whole collection flow.
