---
name: pl-au-trade-voice
description: AU local-trade language layer for ProfitsLocal single-page websites. Generic AU spelling + trade tone + compliance phrasing + banned-genericisms + owner-voice exception patterns. Plus inline § Roofing addendum (niche interface contract filled for roofing per codex R15 Q-X-1 a · split to pl-trade-vocab-<niche> when 3rd niche makes file noisy). Layered with `core/audit/personas/*.js` voice_modifiers (codex R15 Q-X-4 c · layered: AU base + niche override + segment override · LLM prompt merges all three). NOT a runtime executor — content + replacement data consumed by `pl-llm-page-copywriter-site` (LLM prompt context), `core/eval/content-validator.js` (forbidden phrase extension), and `pl-audit-rubric` (voice scoring rubric · TODO Step 3.2).
metadata:
  version: 1.0.0
---

# ProfitsLocal · AU Trade Voice

> **Rule of source**: page-spec defines structure · personas define WHO · this skill defines HOW IT SOUNDS · audit-rubric defines what passes. We don't recreate other layers here.

The language contract for AU local-trade single-page websites. Covers what's universal across AU trades + how each segment voice modulates + (right now) how roofing fills the niche interface contract. When plumber/electrician/landscaper enters production, this skill grows §s for each niche · or splits to `pl-trade-vocab-<niche>` if it gets noisy (codex R15 Q-X-1 split-at-3rd-niche rule).

## When to invoke

- DURING brief copywriting (LLM prompt loads this for `pl-llm-page-copywriter-site` context)
- DURING audit `pl-audit-rubric` voice scoring (TODO Step 3.2 · maps `vis-H-2` and segment-voice checks)
- DURING content-validator extension when expanding FORBIDDEN_PHRASES (this skill is the SSOT for AU trade voice forbidden list · `core/eval/content-validator.js` imports from here · TODO Step 3.3 wire)

Use ONLY for AU local trade (roofer · plumber · electrician · landscaper · pest · cleaning · concrete · gutter · brickwork · tiling). NOT SaaS · restaurants · portfolios.

## Owner & sources

| Layer | Owner | This skill's role |
|---|---|---|
| Page structure / 11-section sequence | `skills/pl-local-trade-page-spec` v1.0 | reference only · don't restate sections |
| WHO (segment data · 5s signals) | `core/audit/personas/{urgent-repair,planned-upgrade,commercial-maintenance,guided-first-time-buyer}.js` | reference voice_modifiers.tone field |
| Forbidden phrase canonical list (53 base) | `core/handoff/niche-spec-loader.js` `FORBIDDEN_PHRASES` | this skill EXTENDS (adds 9 single-page + 7 AS-trade overlaps · re-exports from here Step 3.3) |
| Audit rule execution | `skills/pl-audit-rubric` v1.0 (TODO Step 3.2) | rubric reads voice rule IDs from here |
| Niche-specific signal detection | `core/audit/trust-signals/<niche>.js` | reference patterns · don't restate |

---

## §1 · Universal AU layer (every trade · every segment)

### 1.1 Spelling — UK conventions strict

| ✗ US | ✓ AU |
|---|---|
| color | colour |
| center | centre |
| catalog | catalogue |
| program | programme (noun) |
| realize | realise |
| organize | organise |
| analyze | analyse |
| meter (length) | metre |
| meter (device) | meter |
| fiber | fibre |
| inquiry | enquiry (general) / inquiry (formal) |
| labor | labour |
| neighbor | neighbour |
| favorite | favourite |
| traveled | travelled |

**Rule**: any US spelling in copy → content-validator `au_spelling` check fails (TODO Step 3.3 add this check).

### 1.2 Trade tone register — vs SaaS / consultant

| ✗ SaaS / consultant | ✓ AU tradie |
|---|---|
| "leverage" | "use" |
| "facilitate" | "help" |
| "synergy" | (skip · don't say) |
| "optimise your workflow" | "save you a Saturday" / specific outcome |
| "value-added" | (skip) |
| "best-in-class" | "20-year warranty in writing" / specific |
| "solutions" | "fixes" / "replacements" / "repairs" / specific |
| "engage" / "engaging with" | "talk to" / "call" |
| "ROI on your investment" | "what you'll save / earn" |
| "industry-leading" | (skip · pure puffery · no proof) |
| "Empower" | (banned · don't use) |
| "Streamline" | (banned · don't use) |
| "Innovative" | (banned · skip) |
| "Cutting-edge" | (banned · trade work is not cutting-edge) |
| "Tailored to your needs" | (banned · vague · replace with specific) |

**Tradie register markers (preferred)**:
- "We'll be there Tuesday morning" (specific time)
- "Tidy site daily" (concrete habit)
- "10-year workmanship warranty in writing" (specific guarantee)
- "We re-pointed 47 ridge caps in 2024" (specific number)
- "Same crew turns up · we don't sub out" (concrete promise)
- "If it rains the day we're booked · we reschedule and call" (concrete failure mode handling)

### 1.3 Compliance phrasing (license + ABN + insurance · state-aware)

| Field | Format · enforced by content-validator + trust-signals |
|---|---|
| License | `<authority> · <number>` · e.g. `VBA-licensed · CDB-U 65938` (VIC) · `QBCC · 1234567` (QLD) · `NSW Fair Trading · 123456C` (NSW) · `Building Commission WA · BC12345` (WA) |
| State authority | Must match site's state. Cross-state mention = T1.5 zero-tolerance fail. |
| ABN | 11-digit format · spaces optional · e.g. "ABN 34 134 811 831". Never list without spaces unless rendering as machine ID. |
| Public liability insurance | "Public liability insurance · $X million cover" · `present_or_absent` (per SOP) · NEVER fabricate amount |
| Workers comp | "Workers compensation insurance current" · `present_or_absent` |

**Forbidden license claims** (any niche):
- "Lifetime guarantee" without product backing (illegal under ACL · ACCC pursues)
- "Insurance approved" without naming insurer (vague claim · breaks consumer law)
- "Award-winning" without specific award + year
- "Government-approved" / "Council-certified" without specific cert # + body

### 1.4 "No obligation" pattern (AU friction-reduce · NOT SaaS "free trial")

| ✓ AU | ✗ SaaS |
|---|---|
| "Free quote · no obligation" | "Free trial · no credit card" |
| "Obligation-free site inspection" | "Get started free" |
| "Written quote within 24 hours · no pressure to book" | "Sign up now" |
| "We come out · measure · quote in writing · you decide" | "Try it free" |
| "If you don't like the quote · throw it in the bin" (tradie register) | (no SaaS equivalent) |

### 1.5 Banned genericisms (53 base + 16 new = ~69 total)

`pl-au-trade-voice` extends `core/handoff/niche-spec-loader.js#FORBIDDEN_PHRASES` (53 entries · loaded at content-validator runtime) with these additions:

**New for single-page (Codex Rounds 4-15 + market browse)**:
- "passionate about"
- "quality workmanship" (vague · replace with warranty years)
- "competitive prices" (AS-trade-7 · vague · ban)
- "family-owned and operated" (replace with specific year founded)
- "your local roofer" / "your local plumber" / "your local <trade>" (AS-trade · generic SEO filler)
- "established reputation" (vague · replace with year + suburb)
- "no job too big or small" (cliché · skip)
- "customer satisfaction guaranteed" (legally meaningless)
- "trusted name in [niche]" (puffery · no proof)
- "above your head specialists" (AS-trade-3 · trade-specific cliché)
- "the best in [city]" (no proof · banned)
- "we offer / provide" leading every service tile (replace with active "we install" / "we replace" / "we fix")
- "feel free to contact us" (passive · low-conversion)
- "in business since [year] of [year]" (redundant · just "Since YYYY")

**Owner-voice exception** (R8 / SOP §3 H-seg-1):
Owner-led trades may use up to 11-word H1 IF and only IF the headline contains one of:
- Owner first name (e.g. "Mark Squire" · "Pete" · "Jaz")
- Personal accountability device ("the man whose name is on the truck" · "I'm Jaz · I'll be on your roof")
- Family explicit ("My dad started this in 1998" / "Three generations of roofers")

Detection regex (for `mech-H-1` audit check):
```
/(\b(?:I|my|me|we)\b.{0,40}\b(?:name|on the (?:truck|roof|job|tools)|family|generations|dad|grandfather)\b)|(\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?'s\s+(?:roof|plumb|spark|paint))/i
```

If exception fires AND H1 ≤11 words → pass. If exception fires AND H1 ≥12 words → still fail (limit is hard at 11).
If exception doesn't fire AND H1 >10 words → fail.

### 1.6 Tradie sentence patterns (LLM prompt aids)

When LLM writes copy, prefer these constructions:

| Pattern | Example |
|---|---|
| Specific number → claim | "22 years on Ballarat roofs" not "decades of experience" |
| Concrete failure-mode handling | "If we can't be there same-day · we tell you upfront" |
| Material name + action | "We re-sheet Colorbond and seal the ridges in one visit" |
| Suburb + service | "Tile restoration across Sebastopol · Wendouree · Mt Pleasant" |
| Time + outcome | "Tuesday quote · Friday start · written warranty before we leave" |
| Cost-anchor without lying | "Restoration typically $4-12k depending on size and access — written quote free" |
| Owner credit | "I'm Mark · 22 years · my name's on the truck for a reason" |

---

## §2 · Per-segment voice modifiers (layered with personas)

Codex R15 Q-X-4 (c) layered model. AU-wide base above + segment-specific overrides below. LLM prompt MUST merge BOTH when generating copy.

### 2.1 `urgent-repair` voice (Sarah)

| Lever | Pattern |
|---|---|
| Tone | direct · empathetic · time-urgent |
| Opener pattern | "Roof leaking after the storm? We can be there [today/this afternoon]." |
| Avoid | "discover" · "explore options" · "consultation" · "premium" |
| Reinforce | response SLA hours · same-day language · "we make-safe first · quote after" |
| Trust pivot | "VBA-licensed · public liability insurance · 5★ Google for urgent jobs" |
| Forbidden for this segment | luxury/heritage language ("hand-pointed" · "carefully restored" · "Federation") |

### 2.2 `planned-upgrade` voice (Mike)

| Lever | Pattern |
|---|---|
| Tone | considered · documented · craftsmanship · file-clerk register |
| Opener pattern | "Ballarat roof restoration · done by the man whose name is on the truck." OR "Signed off in writing · 10-year warranty · 20+ years on Ballarat tile and Colorbond." |
| Avoid | "emergency" front-loaded · panic language · "today" urgency |
| Reinforce | warranty years · material brand names · inspection→quote→site protection→warranty process · before/after gallery |
| Trust pivot | "VBA-licensed · 22 years · 4.7★ on Google across 84 reviews · transferable workmanship warranty" |
| Forbidden for this segment | "free quote" alone (he expects that · not differentiating) · cheap-positioning |

### 2.3 `commercial-maintenance` voice (Karen)

| Lever | Pattern |
|---|---|
| Tone | procurement-aware · neutral · brief · admin-fluent |
| Opener pattern | "Commercial roofing for property managers and strata across [city] · ABN 12 345 678 901 · public liability $20M · NET-30 invoicing." |
| Avoid | "Mate" · "g'day" · "your local roofer" residential register · emotional copy |
| Reinforce | ABN visible above-fold · insurance certificate availability · SWMS · access coordination · "tenant notice provided" · photo report sample |
| Trust pivot | "Real estate / strata friendly · we send the photo report to your agency on completion" |
| Forbidden for this segment | residential-only photos · "family-owned" softness · cash-friendly language |

### 2.4 `guided-first-time-buyer` voice (Tom)

| Lever | Pattern |
|---|---|
| Tone | plain-language · friendly · explanatory · no jargon · low-pressure |
| Opener pattern | "Not sure what your roof needs? We'll come out · take a look · explain it in plain English · written quote for free." |
| Avoid | jargon ("sarking" / "valley" / "pointing") · "premium" / "luxury" · big numbers · technical specs upfront |
| Reinforce | "free site inspection" prominent · indicative price band ("typical roof restoration: $4-12k") · "no surprise costs" · explainer for "what does this term mean" |
| Trust pivot | "I'll explain what's urgent · what can wait · what it'll cost in plain English." |
| Forbidden for this segment | "starting from $X" without disclosure · "premium quality" · technical jargon without translation · pressure CTAs |

### 2.5 Voice-modifier merge spec (for LLM prompt builder · TODO Step 3.4 Step 4)

When `pl-llm-page-copywriter-site` builds prompt for a render:

```
1. Load §1 (AU universal layer)        ← this skill
2. Load §3 (niche-specific layer)      ← this skill (e.g. §Roofing addendum below)
3. Load persona.voice_modifiers        ← core/audit/personas/<primary_segment>.js
4. Merge into system prompt:
   - §1 sets the FLOOR (banned phrases · spelling · compliance format)
   - §3 adds NICHE VOCAB (Colorbond · ridge cap · etc.)
   - persona OVERRIDES TONE (urgent · planned · commercial · first-buyer)
   - Conflicts: persona override wins for tone · §1 wins for spelling/compliance
5. Append "renderer MUST honor §1 banned phrases · violation = audit FAIL"
```

---

## §3 · Roofing addendum (niche-specific · fills 8-field niche interface contract)

Per `pl-local-trade-page-spec` §Niche interface contract · roofing-specific implementation. When plumber/electrician arrive · they get their own §Plumbing / §Electrical here · split to `pl-trade-vocab-<niche>` if/when this skill gets unscannable (codex R15 Q-X-1 split-at-3rd-niche).

### 3.1 `services` field

Standard roofing service taxonomy (referenced by `service-list` section):

| Service ID | Display | Description (≤15 words · tradie register) |
|---|---|---|
| `roof-restoration` | Roof restoration | Tile or Colorbond roof: clean · re-point · re-bed · seal · 10-year warranty |
| `roof-replacement` | Roof replacement | Complete tear-off + new Colorbond OR re-tile. Includes sarking and battens. |
| `roof-repair` | Roof repair | Leak diagnosis · cracked tiles · loose flashing · storm damage. Quote within 24h. |
| `gutter-replacement` | Gutter replacement | Colorbond gutters + downpipes. Matched colour. Lifetime metal warranty. |
| `gutter-clean` | Gutter clean | Pre-storm season clear-out. Photo report on completion. |
| `ridge-capping` | Ridge re-pointing | Hand-pointed mortar ridges · 8-10 year warranty depending on substrate. |
| `storm-repair` | Storm/emergency repair | Make-safe tarping · permanent repair quoted in writing. Insurance compatible. |
| `colorbond-install` | Colorbond installation | BlueScope-supplied · full colour range · we install ridge sealing + valley sarking. |
| `metal-roofing` | Metal roofing | Zincalume · Colorbond Custom · architectural standing seam available. |
| `roof-painting` | Roof painting | Cement tile painting · roof restoration coatings · 3-coat system. |

Each niche-vocab skill (future plumber/electrician) defines equivalent service taxonomy.

### 3.2 `emergency_posture` field

- Default: `mixed` (most roofers do both planned + emergency)
- `emergency-heavy`: storm-response specialists · 24/7 line · same-day for emergency
- `scheduled-heavy`: heritage/restoration specialists · 2-week+ booking · no after-hours

Default `urgency_mix` value when brief omits it: `mixed` for roofing niche.

### 3.3 `license_signals` field (state-aware · matches `core/audit/trust-signals/roofing-au.js`)

| State | Authority | License # format | Regex |
|---|---|---|---|
| VIC | VBA | `CDB-U <5-6 digits>` | `/vba.*\bCDB-?[A-Z]?\s*\d{4,6}\b/i` |
| QLD | QBCC | `<6-7 digits>` | `/qbcc.*\b\d{6,7}\b/i` |
| NSW | NSW Fair Trading | `<6 digits>C` | `/nsw.*fair.*trading.*\b\d{6}C\b/i` |
| WA | Building Commission | `BC<5 digits>` | `/building\s*commission.*\bBC\s*\d{5}\b/i` |
| SA | CBS | `BLD <6 digits>` | `/cbs.*\bBLD\s*\d{6}\b/i` |
| TAS | CBOS | `<6 digits>` | `/cbos.*\b\d{6}\b/i` |
| ACT | Access Canberra | `<6 digits>` | `/access\s*canberra.*\b\d{6}\b/i` |
| NT | NT Worksafe | `<6 digits>` | `/worksafe.*nt.*\b\d{6}\b/i` |

**Cross-state mention** (e.g. QBCC on a VIC site) = T1.5 zero-tolerance fail.

### 3.4 `trust_proof` field

Roofing-specific authority signals (referenced by `trust-bar` + `about-story` + `footer`):

- HIA member (Housing Industry Association · cite year joined)
- Master Builders member (cite state)
- Supplier credentials: BlueScope-approved · Colorbond-certified · CSR Monier-trained · Boral-trained
- Workmanship warranty years (10 / 15 / 20 / 25 — `present_or_absent`)
- Product warranty cited (e.g. "Colorbond 25-year corrosion warranty")
- WHS (Work Health Safety) ticket / RIIWHS204D height work cert
- Past project count (e.g. "84 Ballarat roofs replaced 2019-2024" · specific)

### 3.5 `objections` field (FAQ pre-empt list · top 6 roofing-specific)

In rough buyer priority:

1. **Cost** — "What's a typical roof replacement / restoration cost?" → indicative range + "free written quote · varies by size/material/access"
2. **Timeline** — "How long does it take?" → "1 day repair · 2-5 days restoration · 5-15 days full replacement weather-permitting"
3. **Warranty** — "What if it leaks afterwards?" → "10-year workmanship warranty in writing · transferable if you sell"
4. **Mess** — "Will my garden / driveway be ruined?" → "We tarp the property · clean up daily · drive-off video"
5. **Insurance** — "Is this an insurance job?" → "We provide photo reports + scope letter for your insurer · approved by [major insurers] when applicable"
6. **Pre-sale** — "I'm selling — will this hold for 6 months / 2 years?" → "Yes · warranty transfers · written certificate for the contract of sale"

### 3.6 `forbidden_claims` field (roofing-specific legal risk)

- "Lifetime workmanship guarantee" (illegal · pursue Australian Consumer Law)
- "Insurance approved" without specific insurer (vague claim breaks ACCC guidance)
- "Best roofer in [city]" without survey/award (puffery)
- "Council-certified" without specific certification # + body
- "We do everything" / "no job too big or small" (generic · banned per §1.5)
- "Cheapest in [city]" (race-to-bottom · also unprovable)

### 3.7 `local_modifiers` field (Aussie roofing vocab)

The terms a roofing buyer expects + the trade insider terms (for credibility · use sparingly so first-buyers don't bounce):

**Buyer-familiar (always OK)**:
- Roof restoration · roof replacement · re-roof · gutters · downpipes · leak · flashing · tile · Colorbond · ridge cap

**Trade insider (use 1-2 max in hero · save deep terms for FAQ / process)**:
- Sarking · valley · battens · turret cap · ridge capping · pointing / bedding · barge cover · capping · soaker · apron flashing · valley iron · Zincalume

**Material brands (concrete credibility)**:
- BlueScope · Colorbond · Custom Orb · Trimdek · Monier (CSR) · Boral · Bristile · CSR Roofing

**Climate-aware regional language**:
- Bushfire zone? "Bushfire-rated material per AS3959"
- Coastal? "Marine-grade Colorbond corrosion-rated"
- Tropical? "Cyclone-rated to AS4055 / AS1170.2"

### 3.8 `schema_expectations` field

LocalBusiness JSON-LD subtype: **`RoofingContractor`** (most specific schema.org type for roofing).

Required JSON-LD fields:
- `@type: RoofingContractor`
- `name` · `address` · `telephone` · `priceRange` ("$$" for restoration/replacement · "$" for repair-only · "$$$" for premium tile/copper)
- `areaServed` (array of suburb names · matches §service-area section)
- `aggregateRating` if `entity.review_count ≥ 5` (else omit · never fabricate)
- `openingHoursSpecification` (matches LBP-14 GBP consistency)
- `image` (real trade photo URL)

---

## §4 · TODO Step 3.X markers

References that don't exist yet:
- **TODO 3.2** · `pl-audit-rubric` consumes voice rule IDs from this skill (file lookup table)
- **TODO 3.3** · `core/eval/content-validator.js` imports `pl-au-trade-voice` extended forbidden phrases (instead of hard-coded list in `niche-spec-loader.js`)
- **TODO 3.4** · `pl-llm-page-copywriter-site` builds prompt from §2 merge spec (loads AU + niche + persona)
- **TODO Phase B** · Add `§Plumbing` / `§Electrical` / `§Landscape` here when those niches enter production (split to `pl-trade-vocab-<niche>` when this skill exceeds 800 lines per codex R8 split rule)

---

## §5 · Build artifact

This SKILL.md is the human-authored canonical source. The build script `skills:build` (Step 2 · `scripts/cli/skills-build.js`) extracts a JSON artifact at `skills/pl-au-trade-voice/pl-au-trade-voice.json` for runtime consumers.

JSON schema (codex R10 + R15 Q-X-5 a generic voice extractor):

```json
{
  "name": "pl-au-trade-voice",
  "version": "1.0.0",
  "kind": "voice",
  "contract": {
    "inputs_required": [
      "primary_segment (from brief schema · Step 4)",
      "niche (from brief · default roofing for Phase A)"
    ],
    "outputs_expected": [
      "AU universal voice rules (§1)",
      "Segment voice modifiers (§2 merged with persona file)",
      "Niche addendum data (§3 for roofing · future §s for other niches)"
    ],
    "runtime_consumers": [
      "pl-llm-page-copywriter-site (prompt context)",
      "core/eval/content-validator.js (forbidden phrase extension · TODO 3.3)",
      "pl-audit-rubric (voice rule lookup · TODO 3.2)"
    ]
  },
  "constants": {
    "owner_voice_max_words": 11,
    "standard_h1_max_words": 10,
    "au_spelling_required": true,
    "us_spelling_violations_per_au": ["color", "center", "catalog", "realize", "organize"]
  },
  "rules": [
    { "id": "AV-1", "severity": "hard", "description": "All copy uses UK spelling (colour/centre/realise · etc.)", "enforced_by": ["content-validator au_spelling check"] },
    { "id": "AV-2", "severity": "hard", "description": "Owner-voice H1 ≤11 word exception requires regex match on owner-name OR personal-accountability device OR family device", "enforced_by": ["content-validator mech-H-1"] },
    { "id": "AV-3", "severity": "hard", "description": "Hero copy voice MUST match primary_segment voice_modifiers (urgent/planned/commercial/first-buyer)", "enforced_by": ["vision LLM vis-H-2 · pl-audit-rubric T5"] },
    { "id": "AV-4", "severity": "hard", "description": "Banned genericisms ~69 terms (53 base + 16 new) NEVER appear in any rendered text", "enforced_by": ["content-validator forbidden_phrases"] },
    { "id": "AV-5", "severity": "hard", "description": "License/ABN/insurance phrasing follows state-specific format (§1.3)", "enforced_by": ["content-validator state_authority + trust-signals/<niche>.js regex"] },
    { "id": "AV-6", "severity": "hard", "description": "Forbidden niche-specific legal claims NEVER appear (§3.6 for roofing)", "enforced_by": ["content-validator forbidden_claims (niche-overlay) · TODO 3.3"] }
  ],
  "sections": [
    { "id": "au-universal", "name": "AU Universal Layer", "purpose": "Spelling · trade tone · compliance phrasing · no-obligation pattern · banned genericisms", "hard_rules": ["AV-1", "AV-4", "AV-5"], "audit_check_ids": [], "anti_patterns": ["AS-trade-7"] },
    { "id": "segment-modifiers", "name": "Per-Segment Voice Modifiers", "purpose": "Layered overrides on AU base · merged with personas/*.js voice_modifiers", "hard_rules": ["AV-3"], "audit_check_ids": ["vis-H-2"], "anti_patterns": [] },
    { "id": "roofing-addendum", "name": "Roofing Niche Addendum", "purpose": "Fills 8-field niche interface contract for roofing", "hard_rules": ["AV-5", "AV-6"], "audit_check_ids": [], "anti_patterns": [] }
  ],
  "anti_patterns": []
}
```

Anti-patterns list is empty at the voice-skill level — anti-pattern catalog (AS-trade-1..8) lives canonically inside `pl-audit-rubric` (Step 3.2) per codex R15 Q-X-2. This skill REFERENCES anti-pattern IDs but doesn't store full detection prompts.

---

## §6 · Verification before Step 3.2

After this SKILL.md commits + `skills:build` runs:
1. `pl-au-trade-voice/pl-au-trade-voice.json` exists
2. JSON has `kind: voice` · 6 rules (AV-1..6) · 3 sections (au-universal · segment-modifiers · roofing-addendum)
3. `skills:check` returns clean
4. Future `pl-llm-page-copywriter-site` can load this JSON for prompt context (Phase A.2 / Phase B work)

After Step 3.2 (`pl-audit-rubric` lands):
5. Rubric resolves rule IDs AV-1..6 to T-numbered checks in audit framework
6. Forbidden phrase list extension wires through content-validator (Step 3.3)
