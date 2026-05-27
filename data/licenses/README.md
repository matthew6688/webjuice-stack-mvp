# License Lookup · AU State Registers

> Local SQLite FTS5 index of Australian state-by-state building/trades license registers.
> Used by data-checkpoint + build pipeline to verify customer license status before claiming on website.
> **Soft signal only** — unlicensed/grey-zone customers can still get websites built (per Matthew rule 2026-05-27); we just don't claim license on their site.

## State coverage

| State | Authority | Source | Status |
|---|---|---|---|
| QLD | QBCC | data.qld.gov.au · weekly CSV · CC-BY 4.0 | ✅ live (107k licensees) |
| VIC | VBA / BPC | data.vic.gov.au · BPC Building Practitioner Register CSV | ⏳ next |
| NSW | Fair Trading | api.nsw.gov.au Trades API (2500 free/month) + data.nsw.gov.au CSV | ⏳ next |
| WA | Building Commission (DMIRS) | TBD · likely data.wa.gov.au | 🟡 backlog |
| SA | CBS | search portal only · OpenCLI scrape | 🔴 fallback |
| TAS | CBOS | search portal only · OpenCLI scrape | 🔴 fallback |
| ACT | Access Canberra | search portal only · OpenCLI scrape | 🔴 fallback |
| NT | Building Practitioners Board | search portal only · OpenCLI scrape | 🔴 fallback |

## Commands

```bash
# 1. Download + convert + index all available state registers
npm run pl:license-csv-sync

# 2. Force refresh (skip 24h cache)
npm run pl:license-csv-sync -- --force

# 3. Only one state
npm run pl:license-csv-sync -- --state qld

# 4. Rebuild SQLite index from existing CSVs (no download)
npm run pl:license-build-index

# 5. Lookup by various methods
npm run pl:license-lookup -- --slug <slug>                       # via clients/<slug>/v2/master.md → business_id → entity
npm run pl:license-lookup -- --entity-key <key>                  # direct entity
npm run pl:license-lookup -- --name "Vicwest Roofing" --state VIC
npm run pl:license-lookup -- --abn 34134811831
npm run pl:license-lookup -- --licence-number 1161095
```

## Lookup ladder (CLI implements all 4 in order)

| Tier | Match by | Confidence |
|---|---|---|
| A | exact ABN | highest |
| B | exact licence_number | high |
| C | normalized licensee name (strip Pty Ltd/&/punct) within state | high |
| D | FTS5 fuzzy + niche-class preference (roofing prefers "Roof and Wall Cladding") | medium |
| — | not_found | (grey-zone allowed · no website claim) |

## Storage

```
data/licenses/
├── qld-qbcc.csv        ← downloaded · 36 MB UTF-8 (was 73 MB UTF-16) · gitignored
├── vic-bpc.csv         (TBD)
├── nsw-fairtrading.csv (TBD)
├── _index.sqlite       ← rebuilt from CSVs · 102 MB · FTS5 + indexes · gitignored
└── README.md           ← this file
```

## entity.license schema (written by pl:license-lookup)

```json
{
  "state": "QLD",
  "authority": "QBCC",
  "licence_number": "1161095",
  "licensee_name": "A & J ROOFING SOLUTIONS PTY LTD",
  "abn": "34134811831",
  "address": "98 Buchan St Portsmith QLD 4870",
  "licence_class": "Roof and Wall Cladding",
  "licence_category": "Category 2",
  "status": "active",
  "lookup_tier": "name_exact_normalized",
  "source": "csv-qbcc",
  "looked_up_at": "2026-05-27T...",
  "_candidates_top5": [...]
}
```

## Cron suggestion

Weekly QLD/VIC/NSW refresh via Hermes:
```
0 3 * * 1  cd /Users/matthew/Developer/google-map-website-v3 && npm run pl:license-csv-sync >> data/licenses/_sync.log 2>&1
```

## Smoke test (already verified 2026-05-27)

`a-j-roofing-solutions` (QLD): `pl:license-lookup --slug a-j-roofing-solutions` → ✅ QBCC #1161095 · "Roof and Wall Cladding" · active.
