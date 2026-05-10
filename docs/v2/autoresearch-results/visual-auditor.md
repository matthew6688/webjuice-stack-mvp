# Visual Auditor — Autoresearch

Generated: 2026-05-10T14:36:34.200Z
Duration: 1055.0s
Fixtures: 3 · Candidates: 2

## Per-candidate summary

| Candidate | Tier | Parse rate | All-fields rate | Avg latency | Avg issues |
|---|---|---|---|---|---|
| **ollama-qwen3.6-27b** | T0 | 0% | 0% | NaNs | 0.0 |
| **ollama-gemma3-27b** | T0 | 100% | 100% | 111.6s | 5.0 |

## Side-by-side per fixture

### place_chij-9wdzxxakwsr-lljrd1u3jq

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b | no | 0 | - | - | - | - |  |
| ollama-gemma3-27b | yes | 5 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated experience, potentially hin |

**First issue per candidate:**

- **ollama-gemma3-27b** — major: Low-Resolution Hero Image
  - observed: The hero image on desktop appears pixelated and blurry, especially noticeable in the roofing tiles.
  - why problem: A blurry image immediately signals a lack of professionalism and attention to detail. A potential customer searching for a quality roofing service will likely assume the business doesn't care about quality if their own website looks sloppy.
  - correct: High-resolution, professionally shot image of a completed roofing project, showcasing quality workmanship. Image should be optimized for web to load quickly.
  - fix: Replace the current hero image with a high-resolution, professionally photographed image. Ensure image is compressed for web performance.

### place_chija7rmbn38k2srv29x1ubwqmg

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b | no | 0 | - | - | - | - |  |
| ollama-gemma3-27b | yes | 5 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated design that could benefit f |

**First issue per candidate:**

- **ollama-gemma3-27b** — major: Low-Quality Hero Image
  - observed: The hero image features a stock photo of two people pointing, appearing unnatural and low resolution.
  - why problem: Customers searching for a local service expect professionalism. A low-quality, generic image makes the business appear less credible and trustworthy. It feels like a placeholder, not a real company.
  - correct: A high-quality, authentic photo of a completed roof renovation project in a local Brisbane setting. Focus on showcasing the quality of work.
  - fix: Replace the stock photo with a professional, high-resolution image of a real roof renovation in the Brisbane area. Prioritize authenticity over staged photos.

### place_chijwdbif2xzkwsrru6lkmu2l0o

| Candidate | Parsed | Issues | Fresh | Trust | Conv | Design age | Summary |
|---|---|---|---|---|---|---|---|
| ollama-qwen3.6-27b | no | 0 | - | - | - | - |  |
| ollama-gemma3-27b | yes | 5 | 4 | 6 | 5 | slightly_outdated | The website presents a functional but visually dated design that could benefit f |

**First issue per candidate:**

- **ollama-gemma3-27b** — major: Outdated Hero Gradient
  - observed: The large blue gradient background in the hero section appears dated and unprofessional.
  - why problem: Gradients like this were popular in the early 2000s and now make the business look less current and trustworthy. A potential customer searching for a roof restoration service might assume the business isn't up-to-date with modern techniques.
  - correct: A clean, flat color background or a high-quality, professional photograph of a restored roof.
  - fix: Replace the gradient with a solid, modern color or a professional hero image. Ensure sufficient contrast between text and background.

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

Per-candidate raw outputs: ../../../data/v2/fixtures/visual-autoresearch/2026-05-10T14-36-34
