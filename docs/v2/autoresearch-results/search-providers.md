# Search Providers — Live Comparison

Generated: 2026-05-10T11:27:47.760Z
Query: `roofing brisbane`

## Side-by-side

| Provider | OK | Latency | Results | Structured | Notes |
|---|---|---|---|---|---|
| **tinyfish** | ✅ | 2571ms | 10 | JSON | top: Brisbane Roofing Solutions - Roof Restoration Spec |
| **ddgs** | ✅ | 3960ms | 10 | JSON | top: Roof Replacement Specialists Brisbane | Roo Roofin |
| **dokoSearch** | ✅ | 5286ms | 20 | raw 17434c | top: A.M.J Metal Roofing [14] |

## Top result per provider

### tinyfish
- position: 1
- title: Brisbane Roofing Solutions - Roof Restoration Specialists
- url: https://brisbaneroofingsolutions.com.au/

### ddgs
- position: 1
- title: Roof Replacement Specialists Brisbane | Roo Roofing Company
- url: https://www.rooroofing.com.au/

### dokoSearch
- position: 1
- title: A.M.J Metal Roofing [14]
- url: https://www.amjmetalroofing.com.au

## Recommendation

Default routing (search chain):

1. **Tinyfish search** — 2571ms, structured JSON, free. Primary.
2. **DDGS Python lib** — 3960ms, structured JSON, free. First fallback.
3. **Doko Search** — 5286ms, raw rendered SERP, unblockable. Last-resort retrieval before paid Perplexity.

Doko Search is slowest but uses the user's real Chrome session — anti-bot detection effectively neutralized. Prefer it over paid Perplexity for raw retrieval when Tinyfish + DDGS both fail.

To regenerate this report: `npm run scrape:test-search-compare`.
