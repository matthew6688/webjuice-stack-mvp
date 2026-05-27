# Roofing Stock Library · Image Generation Prompts v1

> **Niche**: roofing / roofer (Australia)
> **Use**: single-page template library (5 templates)
> **Owner**: Matthew generates · Claude consumes
> **Generated**: 2026-05-27

## How to use this file

### 1 · Generate the image

Use Midjourney v6 / DALL-E 3 / Flux 1.1 Pro · whichever gives best photo-realism for Australian context. Each prompt has been pre-tuned to avoid AI tells (fake brand logos · weird hands · text artifacts).

### 2 · Fixed filename + folder

Every image has a **mandatory filename + target folder** in the table below. **Use these exact names** — the slot-filler CLI matches images by filename pattern, so renaming will break the pipeline.

### 3 · Drop into inbox · I sort

Once generated, drop the file(s) here:

```
templates/roofing/stock-library/_inbox/<exact-filename>.png
```

Then tell me **"图片好了 · 跑 import"** and I will:
1. Verify each file matches the manifest
2. Check dimensions
3. Move to the correct subfolder
4. Update `_manifest.json`
5. Tell you which images are still missing

If you generate fewer than the full set · still drop what you have · I'll work with what's available and tell you what's still blocking each template.

### 4 · File format rules

| Category | Format | Dimensions | Why |
|---|---|---|---|
| Hero | **PNG** | 1920×1080 (16:9) | Background image · needs sharp detail at large size |
| Service | PNG | 1200×900 (4:3) | Service cards · square-ish framing |
| Gallery (before/after) | **JPG** | 1600×1200 (4:3) | Pairs · JPG keeps file size down |
| About | PNG | 1600×1000 (16:10) | Wider section feel |
| Process | PNG | 1200×900 (4:3) | Step sequence |
| Detail/material | PNG | 1200×1200 (1:1) | Texture grid · square crop |
| Equipment | PNG | 1600×1000 (16:10) | Trust/equipment section |

Reject any image that comes out at a different aspect ratio · regenerate.

### 5 · Universal anti-AI-slop rules

Every prompt below already includes these · listing here for your reference if you tweak:

- **No fake brand names / logos / decals** on trucks, equipment, clothing
- **No faces** unless explicitly noted (most use back-of-head or back-of-body)
- **No readable text** on documents · signs · vehicles
- **Australian context** explicitly stated (eucalyptus · suburban Aus · Colorbond)
- **No weird hands** · no hands holding tools awkwardly · no extra fingers
- **Photo-real** · documentary or architectural photography style · NOT "AI rendered"
- **Specific lens / lighting** specified (35mm wide-angle · golden hour · etc) to reduce generic AI aesthetic

If your generator adds weird artifacts · regenerate with seed variation.

---

## Phase MVP · 5 images · ship template #1 (industrial-trade)

These 5 are blocking the very first template ship. **Generate these first.**

### MVP-1 · Hero · Restored aerial roof

**Path**: `templates/roofing/stock-library/_inbox/hero-golden-aerial-restored.png`
**Dimensions**: 1920×1080 PNG
**Target subfolder**: `hero/`
**Used in**: T1 industrial-trade hero background

```
Wide aerial drone shot of fully restored Australian suburban tile roof at golden hour,
fresh terracotta color with crisp white ridge capping, taken from 30-degree angle,
suburban Brisbane or Melbourne neighborhood visible in soft focus background with
eucalyptus trees, late afternoon warm golden light raking across roof, deep shadows
in valleys, sharp focus on completed work, sense of "expensive job done right",
professional architectural photography, no people, no logos, photo-real, 35mm
wide-angle lens aesthetic, Fuji medium-format clarity, rich color depth, natural
saturation, no HDR look
```

### MVP-2 · Service · Roof replacement in progress

**Path**: `templates/roofing/stock-library/_inbox/service-replacement-in-progress.png`
**Dimensions**: 1200×900 PNG
**Target subfolder**: `service/`
**Used in**: services grid · "Roof replacement" card

```
Wide angle shot of Australian residential roof mid-replacement, half showing exposed
timber trusses and battens, half showing fresh Colorbond metal sheets in surfmist
color installed, clear before/after contrast in single frame, professional roofer's
back visible working on sheet placement (NO face), ladder in foreground, suburban
Australian backdrop with eucalyptus, midday clear light, photo-real, documentary
photography, no faces, no logos, no readable brand names on clothing
```

### MVP-3 · Service · Storm damage closeup

**Path**: `templates/roofing/stock-library/_inbox/service-storm-damage-closeup.png`
**Dimensions**: 1200×900 PNG
**Target subfolder**: `service/`
**Used in**: services grid · "Storm damage" card · T5 hero option

```
Close-up detail of storm-damaged Australian tile roof, broken and shifted terracotta
tiles, exposed sarking underlay visible, hailstone impact marks on multiple tiles,
dramatic post-storm lighting with one shaft of sun breaking through grey clouds,
wet roof surface, sense of "this needs urgent fixing", photo-real, no people,
no logos, shallow depth of field with foreground tiles in sharp focus, professional
photojournalism style, 50mm lens aesthetic
```

### MVP-4 · About · Worker surveying completed work

**Path**: `templates/roofing/stock-library/_inbox/about-worker-surveying.png`
**Dimensions**: 1600×1000 PNG
**Target subfolder**: `about/`
**Used in**: T1 about section · "we own the work" feeling

```
Australian roofer (back to camera, NO face visible) standing on completed metal
roof at golden hour, hands on hips, surveying completed installation, safety
harness clearly visible, hard hat, high-vis vest (plain orange, no logos),
suburban Australian context behind, sense of "we own the work", warm golden
rim light from low sun, photo-real, professional documentary photography,
no brand names on clothing or equipment, dramatic but natural color grading
```

### MVP-5 · Trust · Australian roof variety

**Path**: `templates/roofing/stock-library/_inbox/about-roof-variety-aerial.png`
**Dimensions**: 1600×1000 PNG
**Target subfolder**: `about/`
**Used in**: T1 about section · materials expertise · trust chip area

```
Aerial drone composite showing variety of Australian residential roof types
in single shot: terracotta tile roof (right side), Colorbond metal in surfmist
gray (center), slate roof (left), all in good condition on adjacent suburban
homes, demonstrating material expertise, taken at 200ft altitude, midday clear
light, sharp focus across all three roofs, no people, no logos, professional
architectural photography style, natural color balance
```

---

## Phase V1 · 30 images · full 5-template library

After MVP ships · these expand to all 5 templates.

### V1 Heroes (4 images · one per remaining template)

#### V1-H1 · T2 heritage-premium hero

**Path**: `templates/roofing/stock-library/_inbox/hero-heritage-slate-detail.png`
**Dimensions**: 1920×1080 PNG
**Target subfolder**: `hero/`

```
Close-up cinematic detail of heritage Australian slate roof, individual dark slate
tiles with weathered patina, ornate copper flashing visible, Victorian-era brick
chimney detail in upper third, late afternoon golden hour, deep shadows, shallow
depth of field with single slate tile in sharp focus, editorial magazine
photography style (Dwell magazine aesthetic), muted blue-grey palette with copper
accent, no people, no logos, 85mm portrait lens aesthetic, fine grain
```

#### V1-H2 · T3 warm-family hero

**Path**: `templates/roofing/stock-library/_inbox/hero-warm-suburban-home.png`
**Dimensions**: 1920×1080 PNG
**Target subfolder**: `hero/`

```
Australian residential street view with single-story brick home in foreground,
freshly restored red terracotta tile roof, family-friendly suburban Brisbane or
Adelaide context, low white timber fence or trimmed hedge, eucalyptus trees
framing left and right, warm late afternoon golden sunlight, sense of "home",
photo-real, no people visible, no logos, no readable street signs, photo
composition suggests "we work in YOUR neighborhood", colors slightly warm-shifted
```

#### V1-H3 · T4 bold-conversion hero

**Path**: `templates/roofing/stock-library/_inbox/hero-dynamic-worker-action.png`
**Dimensions**: 1920×1080 PNG
**Target subfolder**: `hero/`

```
Dynamic dramatic shot of Australian roofer mid-work on residential roof, viewed
from low angle below, dramatic upward perspective, worker silhouetted against
dramatic Australian sky with cloud breaks, holding drill aloft at peak motion,
high-vis vest catches golden hour light, dust particles in air, sense of expert
urgency and competence, photo-real, NO face visible (back-lit silhouette),
no logos on clothing, cinematic color grading with high contrast, 24mm
wide-angle lens aesthetic
```

#### V1-H4 · T5 storm-emergency hero

**Path**: `templates/roofing/stock-library/_inbox/hero-storm-emergency-response.png`
**Dimensions**: 1920×1080 PNG
**Target subfolder**: `hero/`

```
Dramatic post-cyclone Australian residential street scene, multiple homes visible
with storm-damaged roofs (missing tiles, blue tarps), but center home shows
roofer's white ute truck and ladder set up with active emergency repair underway,
storm clouds clearing in background with golden rays breaking through, sense of
"help arrived first to this house", photojournalism style, wide angle 24mm,
high dynamic range but natural, no faces, no readable text on truck, no logos,
sense of urgency mixed with relief
```

### V1 Service grid (12 images · cover all common AU roofing services)

#### V1-S1 · Metal Colorbond install

**Path**: `templates/roofing/stock-library/_inbox/service-colorbond-install.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Close-up detail of Colorbond metal roof sheet being installed by Australian
roofer, single sheet being placed with overlapping seam visible, screwdriver
driving Tek screw, surfmist or monument color, sharp focus on installation
point, worker hands and tool visible (NO face), tool belt edge visible,
natural midday daylight, photo-real, no logos, professional construction
photography
```

#### V1-S2 · Slate heritage detail

**Path**: `templates/roofing/stock-library/_inbox/service-slate-heritage.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Close detail of heritage Australian Victorian-era slate roof, individual slate
tiles in deep grey-blue, ornate copper flashing at ridge, lichen patina on
older tiles contrasted with fresh replacement slates, late afternoon side
light revealing texture, sense of craftsmanship, photo-real, no people, no
logos, 100mm macro aesthetic
```

#### V1-S3 · Gutter installation

**Path**: `templates/roofing/stock-library/_inbox/service-gutter-install.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Fresh seamless aluminum gutter being installed along Australian suburban home
fascia, roofer's gloved hands holding gutter section in place (NO face visible),
clips and brackets visible, eucalyptus tree partially visible behind, midday
clear daylight, photo-real, no logos, documentary style
```

#### V1-S4 · Gutter cleaning

**Path**: `templates/roofing/stock-library/_inbox/service-gutter-cleaning.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Gloved hand removing handful of decomposed eucalyptus leaves and debris from
Australian residential gutter, ladder visible in background blurred, autumn
context, natural daylight, sense of "this house needed it", photo-real, no
face, no logos
```

#### V1-S5 · Re-pointing ridge

**Path**: `templates/roofing/stock-library/_inbox/service-ridge-pointing.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Fresh flexible white pointing being applied along Australian terracotta tile
ridge capping, roofer's gloved hand with caulking gun visible (NO face), bright
white fresh pointing contrast with old weathered terracotta tiles, sharp focus
on application point, midday daylight, photo-real, no logos
```

#### V1-S6 · Re-bedding ridge

**Path**: `templates/roofing/stock-library/_inbox/service-ridge-rebedding.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Fresh grey mortar being applied beneath terracotta ridge tile during re-bedding
work, trowel visible mid-action with gloved hand (NO face), old failed mortar
visible to side, sense of careful traditional craft work, midday daylight,
photo-real, no logos, documentary construction photography
```

#### V1-S7 · Whirlybird vent

**Path**: `templates/roofing/stock-library/_inbox/service-whirlybird-vent.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Close-up of installed silver aluminum whirlybird roof ventilator on Australian
terracotta tile roof, slight motion blur on spinning blades suggesting active
ventilation, clear blue sky background, sharp focus on whirlybird, midday
sunlight, photo-real, no logos
```

#### V1-S8 · Skylight install

**Path**: `templates/roofing/stock-library/_inbox/service-skylight-install.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Velux-style skylight installed on Australian terracotta tile roof, fresh flashing
visible around skylight frame, clear blue sky reflected in glass, taken from
roof level at 45-degree angle, sharp focus on skylight edge, midday clear light,
photo-real, no people, no logos
```

#### V1-S9 · Solar prep

**Path**: `templates/roofing/stock-library/_inbox/service-solar-prep.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Australian Colorbond metal roof prepared for solar panel installation, solar
mounting brackets visible attached to standing seam, no panels yet installed,
fresh installation showing care, taken at 30-degree angle, midday clear light,
sharp focus on brackets, photo-real, no people, no logos
```

#### V1-S10 · Heritage restoration

**Path**: `templates/roofing/stock-library/_inbox/service-heritage-restoration.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Careful replacement of single damaged slate tile on heritage Australian Victorian
roof, gloved hand placing fresh slate alongside aged weathered slates, copper
flashing visible, sense of "respect for the original", overcast soft light,
shallow depth of field, photo-real, no face, no logos, editorial craft style
```

#### V1-S11 · Commercial flat roof torch-on

**Path**: `templates/roofing/stock-library/_inbox/service-commercial-torchon.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Industrial torch-on membrane being applied to flat commercial roof, blue propane
torch flame visible heating membrane, worker's boots and gloved hands visible
(NO face), rolled membrane in background, sense of professional commercial
work, midday clear light, photo-real, no logos, industrial documentary style
```

#### V1-S12 · Asbestos removal

**Path**: `templates/roofing/stock-library/_inbox/service-asbestos-removal.png`
**Dimensions**: 1200×900 PNG · target `service/`

```
Hazmat-suited worker (full white suit · respirator · gloves · NO face visible
behind respirator) carefully removing old asbestos cement roof sheets from
Australian shed or carport, plastic containment sheets in background, sense of
safe professional handling, overcast daylight, photo-real, no logos, documentary
photography
```

### V1 Gallery before/after (12 images = 6 NEW pairs)

> Each pair MUST be same camera angle · same framing · same lighting time-of-day.
> Generators that can't produce consistent pairs · use img2img with the "before" as base.

#### V1-G07 · Severe moss tile (before/after pair)

**Paths**:
- `templates/roofing/stock-library/_inbox/gallery-07-moss-before.jpg`
- `templates/roofing/stock-library/_inbox/gallery-07-moss-after.jpg`
- Dimensions: 1600×1200 JPG each · target `gallery/`

**Before prompt**:
```
Severely moss-grown Australian terracotta tile roof, viewed from ground level
at 30-degree upward angle, multiple tiles covered in dark green moss and lichen
patches, faded original color, exposed sarking visible in two spots, suburban
Australian housing context, overcast morning light, photo-real, no people,
no logos, sense of neglect
```

**After prompt** (use "before" as img2img reference for consistent framing):
```
Same Australian terracotta tile roof from previous shot at identical camera
angle and framing, now freshly pressure-cleaned and recoated, vibrant terracotta
color restored, all moss removed, ridge capping freshly pointed in white,
same suburban context, slightly brighter midday light, photo-real, no people,
no logos, sense of complete transformation
```

#### V1-G08 · Rusted metal → new Colorbond (before/after pair)

**Paths**:
- `gallery-08-rusted-metal-before.jpg`
- `gallery-08-new-colorbond-after.jpg`
- Dimensions: 1600×1200 JPG each · target `gallery/`

**Before**:
```
Old rusted galvanized metal roof on Australian rural shed or industrial building,
patches of red-orange rust on multiple sheets, some sheets bent or loose, taken
from ground level at 40-degree angle, eucalyptus visible in background, overcast
light, photo-real, no people, no logos
```

**After**:
```
Same building from previous shot at identical angle and framing, now with fresh
Colorbond metal roof in monument or basalt color, clean panel lines, new ridge
capping, same rural Australian context, brighter midday light, photo-real, no
people, no logos
```

#### V1-G09 · Cracked slate → restored slate (before/after pair)

**Paths**:
- `gallery-09-cracked-slate-before.jpg`
- `gallery-09-restored-slate-after.jpg`

**Before**:
```
Heritage Australian Victorian-era slate roof with multiple cracked and missing
tiles, exposed underlay visible, deteriorated copper flashing, viewed from
ground at 30-degree angle, ornate brick chimney visible, overcast soft light,
photo-real, no people, no logos
```

**After**:
```
Same heritage Australian Victorian slate roof at identical framing, now
restored with replacement slates carefully matched, fresh copper flashing
gleaming, ornate chimney visible and pointed, same overcast soft light,
photo-real, no people, no logos, sense of heritage preservation
```

#### V1-G10 · Storm tarped → fully repaired (before/after pair)

**Paths**:
- `gallery-10-storm-tarped-before.jpg`
- `gallery-10-storm-repaired-after.jpg`

**Before**:
```
Australian suburban tile roof with blue emergency tarp covering damaged section,
missing tiles visible at tarp edge, storm clouds clearing in background, post-
event documentation feel, photo-real, no people, no logos
```

**After**:
```
Same Australian suburban roof at identical framing, now fully repaired with new
matching tiles installed where damage was, no tarp, ridge capping clean and
pointed, clear blue sky, photo-real, no people, no logos
```

#### V1-G11 · Commercial flat leak → torchon (before/after pair)

**Paths**:
- `gallery-11-flat-leak-before.jpg`
- `gallery-11-flat-torchon-after.jpg`

**Before**:
```
Old commercial flat roof with water ponding, visible cracking and blistering
of old membrane, dirt and debris accumulated, taken from rooftop level looking
across at 30-degree angle, industrial Australian context, overcast daylight,
photo-real, no people, no logos
```

**After**:
```
Same commercial flat roof at identical framing, now with fresh black torch-on
membrane installed, smooth uninterrupted surface, clean edges, no ponding,
same industrial context, slightly brighter daylight, photo-real, no people,
no logos
```

#### V1-G12 · Asbestos → modern metal (before/after pair)

**Paths**:
- `gallery-12-asbestos-before.jpg`
- `gallery-12-modern-metal-after.jpg`

**Before**:
```
Old corrugated asbestos cement roof on Australian shed or workshop, weathered
grey-white color, lichen patches, slightly degraded edges, taken at 40-degree
angle, photo-real, no people, no logos
```

**After**:
```
Same shed at identical framing, now with fresh Colorbond metal corrugated roof
in monument color, clean lines, new ridge capping, modern professional finish,
photo-real, no people, no logos
```

### V1 Process explainer (6 images · "how we work" sequence)

#### V1-P1 · Step 1 · Inspection

**Path**: `templates/roofing/stock-library/_inbox/process-step1-inspection.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Australian roofer with clipboard on roof inspecting tiles (back to camera ·
NO face), drone visible flying overhead in background, sense of methodical
inspection, photo-real, midday clear light, no logos, no readable text on
clipboard
```

#### V1-P2 · Step 2 · Quote consultation

**Path**: `templates/roofing/stock-library/_inbox/process-step2-quote.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Roofer standing on residential driveway pointing up at home's roof while talking
to homeowner (both backs to camera · NO faces), sense of professional
consultation, suburban Australian context, mid-morning soft light, photo-real,
no logos
```

#### V1-P3 · Step 3 · Materials delivery

**Path**: `templates/roofing/stock-library/_inbox/process-step3-materials.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Stack of fresh Colorbond metal roof sheets being unloaded from truck onto
residential driveway, worker visible (back · NO face), neat organized delivery,
sense of "the job is starting", midday clear light, photo-real, no logos,
no readable text
```

#### V1-P4 · Step 4 · Old roof removal

**Path**: `templates/roofing/stock-library/_inbox/process-step4-removal.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Old tile roof being carefully removed by worker (back · NO face), exposed timber
trusses visible underneath, neat removal with tiles being stacked carefully,
sense of "controlled demolition", midday clear light, photo-real, no logos
```

#### V1-P5 · Step 5 · New install

**Path**: `templates/roofing/stock-library/_inbox/process-step5-install.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Fresh Colorbond metal sheets being installed on Australian residential roof,
worker visible mid-install (back · NO face), tool belt and drill visible,
sense of "building it right", late afternoon golden hour, photo-real, no
logos
```

#### V1-P6 · Step 6 · Cleanup + handover

**Path**: `templates/roofing/stock-library/_inbox/process-step6-handover.png`
**Dimensions**: 1200×900 PNG · target `process/`

```
Clean completed roof viewed from driveway level, all tools removed, no debris,
homeowner and roofer shaking hands in foreground (both visible backs only ·
NO faces · just hands and partial bodies), sense of "job done well", warm
late afternoon golden hour, photo-real, no logos, no brand names
```

### V1 Material detail textures (6 images · 1:1 square crops)

> These are used in "Materials we work with" grid · trust signal sections.

| Path | Subject |
|---|---|
| `_inbox/detail-terracotta-tile.png` | Close macro of weathered + new terracotta tile texture side-by-side · 1200×1200 PNG |
| `_inbox/detail-colorbond-metal.png` | Close macro of Colorbond standing seam in surfmist with crisp shadow lines · 1200×1200 PNG |
| `_inbox/detail-slate.png` | Close macro of heritage slate tile texture with copper flashing edge · 1200×1200 PNG |
| `_inbox/detail-asphalt.png` | Close macro of asphalt shingle texture with granular surface · 1200×1200 PNG |
| `_inbox/detail-copper.png` | Close macro of patinated copper flashing edge against terracotta · 1200×1200 PNG |
| `_inbox/detail-zincalume.png` | Close macro of fresh zincalume corrugated sheet showing characteristic spangle pattern · 1200×1200 PNG |

(Prompts: "Close-up macro photograph of <material> showing natural texture · sharp focus · natural daylight · no people · no logos · photo-real · 1:1 square crop")

### V1 Equipment/trust (3 images)

#### V1-E1 · Roofer's ute truck

**Path**: `templates/roofing/stock-library/_inbox/equipment-ute-truck.png`
**Dimensions**: 1600×1000 PNG · target `equipment/`

```
Professional Australian roofing service ute (white or red) parked in front of
suburban home, ladder visible on roof rack, tool boxes in tray, NO logos on
the ute, NO readable license plate, eucalyptus and brick home in background,
late afternoon golden hour, photo-real, no people, sense of "we showed up
ready to work"
```

#### V1-E2 · Drone inspection scene

**Path**: `templates/roofing/stock-library/_inbox/equipment-drone-inspection.png`
**Dimensions**: 1600×1000 PNG · target `equipment/`

```
DJI-style commercial drone hovering above Australian suburban tile roof, sense
of "modern inspection methods", clear midday sky, sharp focus on drone, soft
focus on roof below showing inspection context, photo-real, no people, no
logos
```

#### V1-E3 · Insurance documentation

**Path**: `templates/roofing/stock-library/_inbox/equipment-insurance-doc.png`
**Dimensions**: 1600×1000 PNG · target `equipment/`

```
Storm-damaged Australian tile roof with chalk marks and blue tape indicating
areas for insurance assessment, clipboard with paper visible in lower corner
showing inspection notes (NO readable text), gloved hand pointing at damage
(NO face), sense of "we document for insurance claims", overcast daylight,
photo-real, no logos
```

---

## Summary count

| Phase | Images | Status |
|---|---:|---|
| Existing stock | 55 | ✅ usable now |
| MVP (must) | 5 | 🟡 you generate |
| V1 heroes | 4 | 🟡 you generate |
| V1 services | 12 | 🟡 you generate |
| V1 gallery (6 pairs) | 12 | 🟡 you generate |
| V1 process | 6 | 🟡 you generate |
| V1 materials | 6 | 🟡 you generate |
| V1 equipment | 3 | 🟡 you generate |
| **Total V1 new images** | **48** | |
| **Library after V1** | **103** | |

---

## Send protocol · how to give files back to me

### Option 1 · Drop into _inbox folder (recommended)

```bash
# Make sure _inbox exists (Claude will create it)
mkdir -p templates/roofing/stock-library/_inbox

# Drop your generated images with exact filenames
# (the filenames in this doc are the canonical ones)
mv ~/Downloads/hero-golden-aerial-restored.png templates/roofing/stock-library/_inbox/
mv ~/Downloads/service-replacement-in-progress.png templates/roofing/stock-library/_inbox/
# ...etc
```

Then say: **"图片好了 · 跑 import"**

I will:
1. Walk `_inbox/` directory
2. Verify each filename is in this manifest
3. Verify dimensions match (warn if off)
4. Verify aspect ratio
5. Move to correct subfolder (`hero/` `service/` `gallery/` `about/` `process/` `detail/` `equipment/`)
6. Update `templates/roofing/stock-library/_manifest.json`
7. Report what landed + what's still missing
8. Show you which templates are now ship-ready

### Option 2 · Direct drop (if you prefer)

If you'd rather skip the import dance:

```bash
mv ~/Downloads/hero-golden-aerial-restored.png templates/roofing/stock-library/hero/
# put each file in its target subfolder per the table above
```

Then commit + say "图片在 hero/service/gallery/about/process/detail/equipment 下了". I'll re-inventory and update manifest.

### Option 3 · Partial batch (most realistic)

You probably won't generate all 48 in one sitting. Drop what you have · I work with what's available · I tell you what's still blocking each template.

Suggested batches:
- **Batch A** (today/tomorrow): MVP-1 through MVP-5 · 5 images · unblocks T1 ship
- **Batch B** (next): V1-H1 through V1-H4 · 4 heroes · unblocks remaining 4 templates
- **Batch C** (later): service / gallery / process · fills out library

---

## Reject + regenerate criteria

If your generator produces an image with any of these · regenerate:

- ❌ Visible face (unless MVP-2 / V1-S series where worker's back is OK)
- ❌ Readable brand name / logo on truck / clothing / equipment
- ❌ Weird hands (6 fingers · misshapen)
- ❌ Text artifacts in image
- ❌ Wrong aspect ratio (file too tall · too wide)
- ❌ Obvious AI tells (over-smooth skin · plastic-y surfaces · impossible angles · floating objects)
- ❌ US-style suburban context (mailbox by curb · siding houses) — must be Australian
- ❌ Tropical / palm-tree context (must be temperate Aus · eucalyptus · brick homes)
- ❌ Branded color schemes on equipment (no red Stihl chainsaws · no DeWalt yellow)

---

## Notes on prompt tuning if your output is bad

- **Too generic / AI-slop look** → add "documentary photography · 35mm · Fuji medium-format · fine grain · no HDR"
- **Wrong country feel** → add "Australian suburban · eucalyptus · brick veneer home · Colorbond metal"
- **Wrong scale / too small** → add "wide angle 24mm · sense of scale · architectural photography"
- **People look fake** → add "back to camera · NO face visible · silhouette · just hands and partial body"
- **Boring composition** → add "low angle dramatic upward perspective · 30-degree angle · golden hour rim light"

---

## File-naming contract (locked)

The slot-filler CLI looks for filenames matching these regex patterns. **Do not rename.**

| Pattern | Use |
|---|---|
| `hero/<style>-<subject>.png` | Hero backgrounds |
| `service/<service-id>-<scene>.png` | Service grid card |
| `gallery/<seq>-<state>.jpg` (e.g. `07-moss-before.jpg`) | Before/after pairs |
| `about/<scene>.png` | About section |
| `process/step<n>-<name>.png` | Process explainer |
| `detail/<material>.png` | Material textures |
| `equipment/<item>.png` | Trust/equipment |

If you generate something not in this manifest but you think it's useful · drop in `_inbox/` with a name following the pattern · I'll add to manifest.
