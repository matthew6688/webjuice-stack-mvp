# Vicwest Roofing — v3 · Kenya Hara 東方極簡

> Designed under the Kenya Hara / MUJI lineage. Information Architecture flow, Eastern Minimal philosophy. The opposite of bold trade marketing — trust through restraint, not through volume.

---

## Design choices

### Typography
- **Display**: Noto Serif JP at weight **200** (`extralight`). Hara's body of work consistently uses thin serif/Mincho-family display. No bold weight is used anywhere on the page.
- **Body**: Inter at weights 300–400 only. Body copy sits at `rgba(26,26,26,0.82)` rather than pure black — a paper-ink relationship, never spec-ink.
- **Scale**: Narrow type ramp (11 / 13 / 15 / 17 / 24 / 34 / 68). No more than 6 distinct sizes on the page.
- **Letter-spacing**: Eyebrow labels at **0.22em uppercase**, tracking generous. Display tracking negative (`-0.012em`) to keep large serif tight. Numbers in trust strip get a tiny superscript unit (years, ★, +, /) — almost like a footnote.
- **Italic display em**: The single subordinate line in the H1 (*"quietly built to last."*) uses italic light serif — Hara's "whispered subtitle" treatment.

### Color palette
- `--paper: #FAFAF8` — warm near-white. Not `#FFFFFF`. This single decision separates the page from every other roofing site instantly.
- `--paper-2: #F4F2EC` — secondary panel. The shift between sections is barely perceptible (≈ 2% luminance).
- `--ink: #1A1A1A` used **only via opacity** (0.92, 0.82, 0.62, 0.38, 0.10). Never as solid.
- `--ash: #8B8780` — a stone grey, reserved for the rare moments where colour-stronger-than-ink is needed. Used sparingly.
- `--terracotta: #A8553E` — a single warm accent **used in exactly one location** on the page: the asterisk on required form fields. That is the only chromatic moment. Everything else is greyscale.
- **No gradients. No drop shadows. No coloured cards.**

### Spacing & rhythm
- Section gap: `clamp(120px, 16vw, 200px)` — comically generous by trade-site standards. This is the page's signature.
- Service grid row-gap: `clamp(72px, 9vw, 112px)`. Two-column grid is mostly air.
- Hero left column has 80px of internal padding-top above the eyebrow — letting the page "breathe in" before speaking.
- Trust strip is bounded by hairlines (1px @ 8% opacity), not by background fill.

### Component treatment
- **Buttons**: Only one button style — a ghost button with 1px hairline border. Primary CTA fills on hover (ink colour) but stays neutral at rest. No solid colour buttons anywhere.
- **Secondary CTA**: A `btn-text` — underlined inline link. "Or call 0403 554 592" looks like a footnote, not a competitor.
- **Form fields**: Bottom-border only. No box, no fill, no rounded corners. Labels are tiny uppercase 10px tracked at 0.18em — they look like archive metadata.
- **Service cards**: Not cards. Just numbered entries (01, 02 ...) with a thin column of breathing room.
- **Reviews**: Used Japanese 「」brackets rendered in `var(--ink-trace)` (10% opacity) framing each quote. A direct Hara reference.
- **Gallery images**: All photographs have `filter: saturate(0.85) contrast(0.95)` — a small global desaturation that gives them the printed-monograph feel rather than the digital-stock-photo feel.
- **Numbers in trust strip**: Set in Noto Serif JP extralight at 56px — they look like page numbers in an architecture book, not like stat-chips on a SaaS page.

---

## Anti-default choices (3-line rationale each)

### 1. No filled buttons. No "GET FREE QUOTE NOW".
The default for any trade site is a high-contrast filled CTA with imperative shouting copy. I chose a single ghost button with a hairline border and the phrase "Request a quote" in tracked uppercase 12px. Trust here is communicated by restraint — a confident trade does not need to yell.

### 2. Warm paper background `#FAFAF8`, not white.
Almost every roofing competitor uses pure white. The 2% warm shift sets the page in a different visual world before a single word is read — closer to a Kinfolk spread than a service site. This is Hara's washi-paper instinct translated to CSS.

### 3. Trust numbers as quiet typography, not as chips.
The brief asks for "4 number chips". A literal chip would have ruined the page. I rendered them as Noto Serif JP extralight at 56px with hairline-bounded blocks of vast whitespace between them — they read as poetry, not as a stat bar. The "22 / years", "4.1 / ★", "15 / +", "0 / /" pattern echoes book pagination.

### 4. Single muted accent — terracotta only on required asterisks.
Every other monochrome design ends up with a single coloured accent on CTAs (blue, orange, green). I pushed the accent down to just the form-required `*` glyph — the page only "blooms" colour when the user reaches the point of action. That is a deeply Hara move: colour as honest necessity, not decoration.

### 5. Vertical rhythm at 200px between sections.
Most trade pages run at 60–80px section gaps. The site at 200px feels structurally different on first scroll — the eye registers "this is not a trade page" before the brain reads any copy. The page is roughly 2× the vertical length of a typical roofing single-page; this is the cost of restraint.

### 6. Photographs treated with global desaturation.
Stock roofing photos are uniformly oversaturated for "punch". A global `saturate(0.85) contrast(0.95)` pulls them back to monograph tone — they sit in the page rather than fighting it.

### 7. Service entries numbered 01–06, no icons.
The default move on a services grid is one icon per entry. I removed all icons and replaced them with a thin serif numeral set in the faint ink colour. The reader is forced to read the service titles, not pattern-match icons.

### 8. Reviews framed in 「」brackets.
The CSS pseudo-elements use Japanese corner brackets rendered at 10% ink opacity. A direct visual reference to Hara's editorial work and to MUJI booklet typography. No competitor in the AU roofing space uses this.

---

## Where I pulled BACK on conversion noise (intentional)

### Mobile sticky CTA — present but muted
The brief mandates a sticky mobile phone CTA, and most trade sites render this as a bright orange/green thumb-bar shouting "CALL NOW". I built it as a slim 14px black bar at 94% opacity with the word "Call" set in 10px uppercase letter-tracked 0.22em — it functions identically (`tel:0403554592` link) but reads as a quiet utility, not an interruption. **Desktop has no sticky bottom CTA at all** — the header is the only persistent anchor.

### No urgency. No countdown. No "limited spots."
Default trade copy is built on artificial urgency. The page contains zero urgency triggers — no "book today", no "spots filling", no "5 customers in your area". The longest claim in the entire copy is "ten-year warranty paperwork in our hands the day they left" — said by the customer, not by us.

### The hero has one button, not two stacked CTAs.
The standard pattern is "Get Quote" + "Call Now" as paired primary buttons. I gave the hero one ghost button and demoted the phone number to a `btn-text` underlined link beside it — secondary, optional, present for those who want it.

### Trust strip uses words, not badges.
"VBA-licensed", "10-year warranty", "since 2003" are mentioned in body copy in soft tones rather than as colourful badges or rosettes in the trust strip. Authority through prose, not through iconography.

### Form labels are footnote-small.
Form labels at 10px tracked 0.18em uppercase look like archive metadata, not like assertive UI. The form invites without demanding. Submit button uses the same ghost treatment as the hero CTA — there is no "louder" element on the entire page than the H1.

### Hero index "No. 01 · Ballarat, Victoria"
A small bibliographic marker (No. 01) treats the page as if it were a printed monograph. This single phrase reframes the visitor's expectation away from a sales page.

---

## What this design is honestly trading away

This page **will convert worse than the v0 default** at the visual-trigger level — there are no fat CTAs, no warm-toned trust badges, no urgency. What it offers in return is **a different kind of buyer**: the heritage-home owner, the architect-client, the slow-decision-maker who will read carefully, trust restraint, and eventually call. For Vicwest's heritage-slate / Colorbond restoration business, that is precisely the buyer.

If conversion-rate is the only metric, do not ship this. If brand differentiation in a sea of identical roofing sites is the metric, this is the only one of the three that achieves it.
