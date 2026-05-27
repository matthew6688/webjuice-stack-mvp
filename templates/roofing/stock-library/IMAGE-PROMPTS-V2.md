# Roofing Stock Library · Image Generation Prompts v2

> **Trigger**: Phase A audience reframe (4 buying-intent segments) + market mediocrity browse + LBP-11/12/13/14 (supplier wall · real trade photo · review date · GBP hours)
> **Generated**: 2026-05-28
> **Niche**: roofing (AU)
> **Library state**: 101 images · v1 + batch1 + batch2 complete · v2 fills 4-persona + before/after expansion gaps
> **Owner**: Matthew generates · Claude consumes (same flow as v1)

## How to use

Same flow as v1:
1. Generate with Midjourney v6 / DALL-E 3 / Flux 1.1 Pro · pick best AU photo-realism
2. Use **exact filename + folder** below
3. Drop into `_inbox/<exact-filename>.<ext>` · tell me "图片好了 · 跑 import"
4. I verify · sort · update `_manifest.json` · backlog

**AU-specific tells to AVOID** (anti AI-slop):
- ❌ US-style 3-tab asphalt shingles (we want Colorbond · concrete tile · terracotta)
- ❌ Suburban "McMansion" aesthetic (AU homes have eaves · simpler rooflines · brick veneer)
- ❌ Lifestyle stock (smiling family / pristine driveway) — we want **trade context** (workers · materials · close-up details)
- ❌ Pristine impossible AI gradients · weird text on hi-vis · fake brand logos
- ❌ US-style PVC gutters · we use Colorbond Quad/D-shape gutters
- ❌ Roof color extremes that don't ship in AU (bright red · jet black with sheen)

**AU-specific tells to INCLUDE**:
- ✅ Eucalyptus gum tree visible in distance (AU suburb signature)
- ✅ Colorbond brand colours (Surfmist · Woodland Grey · Monument · Manor Red · Basalt · Cottage Green)
- ✅ Brick-veneer 1970s-1990s home (most common AU roofing job · not modern minimal)
- ✅ Workers in proper AU PPE (Stubbie helmet · Hi-vis class D/N · harness)
- ✅ AU-style ute (Toyota Hilux · Ford Ranger · Holden Colorado) with ladder rack + roof rack
- ✅ Concrete tile or terracotta (most common AU residential roof material)

---

## §A · Persona-specific photo gaps (8 images)

These directly serve audit T5 deterministic gates (per `core/audit/personas/<segment>.js critical_signals_5_second`).

### A1 · urgent-repair · storm-damaged roof at dusk · drip evidence
- **Prompt**: Photo · weatherboard Australian home at dusk after heavy storm · part of metal roof flashing torn back exposing dark underlay · interior ceiling drip visible through bedroom window · water stain on white plaster ceiling · realistic phone in foreground showing time 7:32pm · NOT cinematic · NOT dramatic-rain-fall · just real evidence shot · suburban Melbourne / Brisbane context · eucalyptus tree silhouette · 4:3 photo · documentary style · no people · no text
- **Dimensions**: 1600×1200
- **Filename**: `hero/hero-urgent-storm-leak-evidence.png`
- **Used by**: urgent-repair persona hero · LBP-12 real trade photo · gallery before pair for storm-repair

### A2 · urgent-repair · tradie ladder set against tarped roof
- **Prompt**: Real photo · Australian roofer mid-50s grey beard in faded blue Stubbies polo + hi-vis vest setting up extension ladder against a roof partially covered by emergency blue tarp · two-storey 1980s brick veneer home · roofing ute parked on lawn behind · early morning light · documentary photojournalism style · NO smiling-tradie-stock · NO staged poses · NOT cinematic · 16:9 · no text in image
- **Dimensions**: 1920×1080
- **Filename**: `service/service-urgent-tarp-ladder.png`
- **Used by**: urgent-repair tile in service-list · process step 1 "make-safe"

### A3 · planned-upgrade · owner with hand-pointing on heritage tile
- **Prompt**: Australian roofer aged 45-60 in worn Stubbies polo + faded jeans + scuffed work boots · kneeling on a terracotta tile roof · hand-pointing ridge cap with trowel · close-up showing the actual mortar work · slate grey terracotta tiles · realistic dirty hands · NOT pristine · NOT cinematic lighting · photojournalism Australian working-trade documentary · weatherboard chimney in frame · 3:2 · no text · no fake brand
- **Dimensions**: 1800×1200
- **Filename**: `service/service-heritage-ridge-pointing-detail.png`
- **Used by**: planned-upgrade persona · LBP-7 owner-on-roof visible

### A4 · planned-upgrade · pristine completed Colorbond Monument roof aerial
- **Prompt**: Aerial drone photo · single-storey AU brick-veneer home · 1980s/90s build · freshly-installed Colorbond Monument (charcoal) corrugated metal roof · neat ridge caps · matching dark grey gutters and downpipes · two eucalyptus trees in backyard · neighbouring older terracotta roofs visible for contrast · golden hour light · suburb feel (not country) · 16:9 · no text · NOT polished real-estate-glossy
- **Dimensions**: 1920×1080
- **Filename**: `hero/hero-planned-colorbond-completed-aerial.png`
- **Used by**: planned-upgrade hero · gallery 13-after for restoration→Colorbond pair

### A5 · commercial-maintenance · property manager + tradie reviewing roof report
- **Prompt**: Documentary photo · Australian property manager (early 40s woman in business-casual shirt + cardigan) and a roofer (early 50s man in hi-vis polo + branded work jacket) standing on commercial strata building courtyard · both looking at an iPad showing a photo report of roof damage · multi-storey beige apartment building behind · loading-dock context · NOT corporate-stock · NOT smiling-handshake · 16:9 · weekday morning light · documentary commercial photography
- **Dimensions**: 1920×1080
- **Filename**: `hero/hero-commercial-property-manager-review.png`
- **Used by**: commercial-maintenance persona hero · about-story

### A6 · commercial-maintenance · branded ute + ladder + worker in hi-vis
- **Prompt**: Real photo · Australian work ute (Toyota Hilux or Ford Ranger · white) with extendable ladder rack carrying full extension ladder · roofer in proper hi-vis Class D vest + helmet loading toolbox onto ute · branded magnetic decal on driver door reading clearly "ROOFING" · commercial business park context · concrete pavement · NOT shiny new ute · NOT cinematic · realistic 5-year-old work vehicle · 16:9 · no fake business name text
- **Dimensions**: 1920×1080
- **Filename**: `equipment/equipment-branded-ute-loadup.png`
- **Used by**: commercial-maintenance trust-bar · about · LBP-12 trade-vehicle proof

### A7 · guided-first-time-buyer · tradie explaining roof issue to homeowner
- **Prompt**: Documentary photo · Australian roofer (50s · friendly face · NOT model-handsome) in faded hi-vis polo standing on front lawn next to young homeowner couple (early 30s · casual weekend clothes) · pointing UP at the roof while explaining · clipboard in roofer's hand · brick-veneer 1980s home with concrete tile roof · NOT corporate-stock-smiling · NOT staged · the homeowners look slightly worried but engaged · 16:9 · weekday morning · suburb Melbourne / Brisbane / Sydney aesthetic
- **Dimensions**: 1920×1080
- **Filename**: `hero/hero-first-buyer-roofer-explains.png`
- **Used by**: guided-first-time-buyer hero · process step "we explain everything"

### A8 · guided-first-time-buyer · building inspector report with annotated photos
- **Prompt**: Top-down photo of an Australian building inspection report opened on a kitchen table · A4 paper · technical-looking with annotated roof photos showing red circles around damaged tiles + handwritten notes "REPAIR PRIORITY" · coffee mug beside · keys + first-home-buyer "settled" envelope visible at edge · NO faces · just the document and table · diffused indoor afternoon light · 4:3 · realistic
- **Dimensions**: 1600×1200
- **Filename**: `equipment/equipment-building-inspection-report.png`
- **Used by**: guided-first-time-buyer about / process · "why are you here" anchor

---

## §B · Before/after pair expansion (4 new pairs · 8 images · for draggable-slider)

Per SOP §6 R-BA-6 hard rule (Matthew 2026-05-28): only the draggable-slider variant is allowed. We need varied before/after pairs that LOOK GOOD in the slider (same camera angle · same crop · same time-of-day · only the roof state differs).

### B1 · Terracotta tile restoration (cracked → re-pointed + sealed)
- **Prompt before**: Close-up Australian terracotta tile roof · faded orange-brown · multiple cracked tiles · moss between ridge caps · weathered mortar pointing · overcast soft light · 3:2 photo · documentary · NO text · NO people
- **Prompt after**: Same exact angle and crop · same terracotta roof but now restored · clean glazed tiles · fresh white mortar in ridge cap · no moss · subtle sheen from recent sealing · same overcast soft light · 3:2 photo · NO text · NO people
- **Dimensions**: 1800×1200 each
- **Filenames**: `gallery/gallery-13-terracotta-before.jpg` + `gallery/gallery-13-terracotta-after.jpg`
- **Critical**: same camera angle/crop · only roof state changes (drag-slider needs identical framing)

### B2 · Gutter overflow / blocked → cleaned + restored
- **Prompt before**: Photo close-up · Australian Colorbond Quad gutter completely overflowing with leaf debris + visible water cascading over front edge during light rain · fascia stained with dirty water marks · 3:2 · documentary · soft daylight · no people · no text
- **Prompt after**: Same camera angle + crop · Australian Colorbond Quad gutter now perfectly clean · no debris · clean fascia · same soft daylight · 3:2 · no people
- **Dimensions**: 1800×1200 each
- **Filenames**: `gallery/gallery-14-gutter-before.jpg` + `gallery/gallery-14-gutter-after.jpg`

### B3 · Storm-damage tarped → permanent repair
- **Prompt before**: Documentary photo · Australian brick-veneer house roof · part covered with blue emergency tarp held with sandbags · adjacent tiles damaged + cracked · gum tree in background · 16:9 · soft natural light · no people
- **Prompt after**: Same exact camera angle + crop · same house · tarp removed · new Colorbond Monument sheets replacing damaged area · clean ridge cap re-pointed · same gum tree · same light · 16:9 · no people
- **Dimensions**: 1920×1080 each
- **Filenames**: `gallery/gallery-15-storm-before.jpg` + `gallery/gallery-15-storm-after.jpg`

### B4 · Cement-tile painting (faded → fresh)
- **Prompt before**: Close-up · Australian concrete tile roof · severely faded grey · uneven discoloration · mossy stripes near gutter · 1990s suburban home · 3:2 · overcast soft daylight · no people
- **Prompt after**: Same camera angle + crop · same concrete tile roof now freshly painted with anti-fungal coating · clean even charcoal grey · subtle satin finish · same overcast soft daylight · 3:2 · no people
- **Dimensions**: 1800×1200 each
- **Filenames**: `gallery/gallery-16-tile-paint-before.jpg` + `gallery/gallery-16-tile-paint-after.jpg`

---

## §C · LBP-11 supplier wall + LBP-13 review-date assets (3 images)

### C1 · BlueScope + Colorbond supplier credential wall (rendered)
- **Prompt**: Clean studio shot · 3 official roofing supplier logos arranged horizontally on white wall · BlueScope Steel (real logo · accurate corporate blue) · Colorbond (red dot accent) · iFold Sheet Metal · NOT generic-icons · NOT placeholder shapes · clean architectural setting · soft side-lighting · 16:9 · no other text · these are real AU roofing supply chain partners

Note: AI may hallucinate logos · alternative: render this as 3 separate logo-text cards then I composite.

- **Dimensions**: 1920×640 (wide banner format)
- **Filename**: `equipment/equipment-supplier-wall-bluescope-colorbond.png`
- **Used by**: trust-bar · LBP-11 supplier wall
- **Fallback if AI can't draw real logos**: generate plain wall · I overlay logos manually

### C2 · Real customer photo + handwritten review card mockup
- **Prompt**: Documentary photo · Australian homeowner (early 60s woman · grey hair · friendly face · NOT model) standing in front of her restored 1980s brick-veneer house with neat Colorbond Surfmist roof · holding a small handwritten thank-you note card · NOT corporate-testimonial-stock · 4:3 · natural Saturday-morning daylight · suburb context · eucalyptus tree
- **Dimensions**: 1600×1200
- **Filename**: `about/about-customer-testimonial-real.png`
- **Used by**: reviews section · LBP-10 testimonial with attribution depth

### C3 · Roofer holding sample tile + brochure (for first-buyer explainer)
- **Prompt**: Photo · Australian roofer (50s · trustworthy face · NOT model) sitting at homeowner's kitchen table · holding a Colorbond colour sample card AND a concrete tile sample · clipboard with notes beside · suburban kitchen window with Roman blind visible · NOT salesy · NOT staged · documentary consultation feel · 16:9 · weekday afternoon light
- **Dimensions**: 1920×1080
- **Filename**: `about/about-roofer-consultation-with-samples.png`
- **Used by**: guided-first-time-buyer process section · "we explain repair vs replace"

---

## §D · Tradie portrait library (2 images · for LBP-7 owner photo)

These serve `clients/<slug>/v2/brand/logo-review.md` owner-photo flag · used when client's `owner_full_name + owner_photo_url` is present.

### D1 · Owner portrait · planned-upgrade niche (heritage / restoration register)
- **Prompt**: Studio-quality portrait · Australian male tradesman 50-60 · neat grey beard · navy work polo with subtle logo placeholder · arms crossed · standing in front of his work ute parked outside a partly-restored heritage Victorian terrace · NOT corporate-headshot · NOT smiling · serious-craftsman expression · documentary photojournalism · golden hour soft daylight · 3:2
- **Dimensions**: 1800×1200
- **Filename**: `about/about-owner-portrait-heritage.png`
- **Used by**: planned-upgrade primary about-story · LBP-7 conditional

### D2 · Owner portrait · commercial-maintenance niche
- **Prompt**: Documentary photo · Australian businesswoman OR businessman 40s in smart-casual button-down + work pants + clipboard · standing on commercial building rooftop with safety harness clipped to anchor point · iPad in hand · multi-storey buildings visible behind · NOT corporate-stock · NOT pose-y · realistic commercial-facilities-manager-meets-trade context · 16:9 · weekday business hours
- **Dimensions**: 1920×1080
- **Filename**: `about/about-owner-portrait-commercial.png`
- **Used by**: commercial-maintenance about-story · LBP-7 conditional

---

## §E · Niche-expansion forward stock (DEFER until Phase B niche split)

(Not needed yet · listed so future image batches have planning context)

- Plumbing niche: blocked-drain · burst pipe · hot-water-system install · gas-line cert
- Electrical niche: switchboard upgrade · solar inverter install · safety-switch test · LED retrofit
- Landscape niche: turf laid · paver patio · retaining wall · drainage swale
- Pest control: termite barrier · spider treatment · rodent station · borer treatment

**DON'T generate these now** · roofing library is canonical · niche split happens in Phase B+.

---

## Summary · 17 images requested (8 persona + 8 BA + 3 trust-LBP - 2 portrait = 17 wait let me recount: §A 8 + §B 8 + §C 3 + §D 2 = 21 images)

| § | Images | Folder | Primary use |
|---|---:|---|---|
| A · Persona | 8 | hero/service/equipment | Audit T5 deterministic gates per segment |
| B · Before/after | 8 (4 pairs) | gallery/ | SOP §6 R-BA-6 hard rule · draggable-slider |
| C · LBP supplier + review | 3 | equipment/about | LBP-10/11/13 attribution + supplier wall |
| D · Owner portraits | 2 | about/ | LBP-7 owner_photo_url conditional |
| **TOTAL** | **21** | | |

After import:
- Library 101 → 122 images
- 4 buying-intent segments each have ≥2 hero options
- Before/after pairs 12 → 16
- LBP-7 + LBP-11 + LBP-13 assets exist
- Phase A.2 + Phase B can compose against real material

Drop into `_inbox/<exact-filename>` · ping "图片好了 · 跑 import" when ready.
