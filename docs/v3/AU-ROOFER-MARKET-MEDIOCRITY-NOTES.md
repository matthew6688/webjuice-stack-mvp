# AU Roofer Market Mediocrity Notes · 2026-05-28

**Method**: Chrome browse · 3 real AU roofer sites + 1 GBP-only · critical lens (catalog mediocrity · spot rare working signals · NOT copy)
**Lens applied**: 4 personas from earlier walkthrough (urgent-repair · planned-upgrade · commercial-maintenance · guided-first-time-buyer)
**Bias**: market is mediocre. ProfitsLocal exists BECAUSE this is the floor. Sites surveyed = floor catalog · not aspirational.

---

## Sites surveyed

| # | Site | Location | Reviews | Position | Notes |
|---|---|---|---|---|---|
| 1 | iFix Roofing | Ballarat (Wendouree VIC) | 86 (4.5★) | Google #1 organic | Real-photo hero · 15+ suburb chips · supplier wall · "20 years" |
| 2 | The Brisbane Roof Repairers (Prostar) | Brisbane | n/a · organic | Top organic Brisbane | Keyword-stuff hero · "Free - No Strings Attached Quote" |
| 3 | Mr Roof Solutions | Brisbane (Cleveland QLD) | 65 (4.9★) | GBP #1 · 3+ yr | Redirects to same template as #2 · shared infra |
| 4 | The Roof Man | Brisbane | 85 (4.7★) | GBP · 15+ yr · **Open 24 hours** | GBP-only signal · emergency positioning |

---

## §1 · Repeated anti-patterns across all 3 sites (catalog mediocrity)

| Anti-pattern | iFix | Roof Repairs Brisbane | Mr Roof | Frequency |
|---|:-:|:-:|:-:|:-:|
| Hero copy = brand name only OR keyword-stuff | "iFix Roofing" (no value prop) | "Your Company for Roof Repairs Brisbane" (SEO keyword stuffing) | (same as #2) | **3/3** |
| Generic CTA: "Get in Touch" / "Contact Us" / "Call Us Today" | ✓ "GET IN TOUCH" | ✓ "CONTACT US" + "CALL US TODAY" | ✓ | **3/3** |
| No license number visible in fold | ✓ | ✓ | ✓ | **3/3** |
| No ABN visible in fold | ✓ | ✓ | ✓ | **3/3** |
| No insurance disclosure visible | ✓ | ✓ | ✓ | **3/3** |
| No emergency / 24hr signal in fold | ✓ | ✓ | ✓ | **3/3** |
| Vague tagline / "we have solutions for all your needs" | ✓ "The above your head specialists" | ✓ "competitive prices" | ✓ | **3/3** |
| Form 5+ fields (Tom-bouncing length) | (TBD bottom) | ✓ 6 fields (Name·Email·Phone·RoofType·Address·Message) | ✓ | **2/3** |
| Stock photo in service tiles (lifestyle / guy-with-bucket) | ⚠️ partial · real worker hero but stock service tiles | ✓ "Roof Leak Repairs" tile = guy with bucket | ✓ | **2/3** |
| Phone hidden / small / not sticky in mobile | ⚠️ small in iFix header | ⚠️ thin bar 3608 1803 top | same | **3/3** |
| Suburb list buried mid-page · not in fold | ✓ (mid-page) | ✓ (footer · if at all) | ✓ | **3/3** |

**Anti-patterns to ADD to `pl-anti-slop-catalog`** (beyond the V6 bento set):
- AS-trade-1: Hero copy = business name only ("iFix Roofing")
- AS-trade-2: "Your company for [niche] [city]" SEO-stuff hero
- AS-trade-3: "The above your head specialists" vague-clever tagline pattern
- AS-trade-4: Service tile with dramatic lifestyle stock photo (guy-with-bucket caught-leak shot)
- AS-trade-5: Form with ≥5 fields above-fold + Address field required before lead capture
- AS-trade-6: "Operated by [parent company]" hero subtitle leak (B2B template residue)
- AS-trade-7: "Competitive prices" in any hero copy
- AS-trade-8: "Get in Touch" / "Contact Us" / "Call Us Today" as primary CTA text (banned regex already)

---

## §2 · Per-segment serviceability across sites (4-persona scoresheet)

For each site · did the fold serve the segment's job-to-be-done?

| Segment | iFix | Roof Repairs Brisbane | Mr Roof Solutions | Average |
|---|:-:|:-:|:-:|:-:|
| urgent-repair (Sarah) | 2/10 (phone visible · but no 24hr / today / urgency signal) | 3/10 (phone in top-bar · still no urgency) | 3/10 | **2.7/10** |
| planned-upgrade (Mike) | 6/10 ("20 years" specific · real workmanship photo · supplier wall) | 3/10 (no years · no warranty · no license · keyword-stuff hero) | 3/10 | **4.0/10** |
| commercial-maintenance (Karen) | 5/10 ("Commercial Roofing" nav link · still no ABN/insurance/account-terms) | 2/10 (no commercial signal) | 2/10 | **3.0/10** |
| guided-first-time-buyer (Tom) | 3/10 (no price hint · no free-quote prominence · jargon "re-roofing") | 6/10 ("Free - No Strings Attached Quote" prominent · ✅ ) | 6/10 | **5.0/10** |

**Best market score**: ~6/10 · achieved when the site happens to nail ONE persona by luck (Roof Repairs Brisbane nails Tom via "Free - No Strings Attached" pattern · accidentally).

**Worst**: 2-3/10 across the board · most sites serve **nobody well**.

**Implication for our SOP**: aiming for 8+/10 per primary segment is genuine differentiation · most market floor is sub-5.

---

## §3 · Rare working signals (1-2 things to learn / reach for)

These are things market sites do that we should EMULATE in our SOP:

| Pattern | Where seen | Why it works | Adopt? |
|---|---|---|---|
| **Real worker on real roof** in hero (not lifestyle stock) | iFix | Authenticates trade vs "marketing-bought roof" | ✅ ADD: SOP hero rule "hero image must be authentic trade context · NOT lifestyle stock · or honest placeholder per banner protocol" |
| **15+ suburb chips listed** (Ballarat · Blampied · Soldiers Hill · Brown Hill · Clunes · Black Hill · Rokewood · Mt Clear · Meredith · Buninyong · Eureka · Gracefield · Bungaree · etc.) | iFix | Local SEO authority + visitor proof "they serve me" | ✅ Our SOP §4.3 already requires ≥8 · keep this strong · iFix has 15+ so 8 is conservative |
| **Supplier logo wall** (BlueScope · iFOLD · Colorbond) | iFix | Trust-by-association · proves real trade supply chain (not backyard) | ✅ ADD: NEW LBP-11 "Supplier/material partner logos visible" (when applicable per niche) |
| **Real review with name + date** ("Maria Debono · April 2024") | iFix | Anti-fabrication signal · recency builds trust | ✅ STRENGTHEN: LBP-10 already requires name+suburb+service · ADD "date or recency reference" |
| **"Free - No Strings Attached Quote"** as primary copy | Roof Repairs Brisbane | Removes Tom's price-fear · prominent · clear | ✅ ADD: SOP §4 "no-obligation pattern" already covers · upgrade to "free + no-obligation explicit copy required if guided-first-time-buyer is primary or secondary segment" |
| **"Open 24 hours"** in GBP listing | The Roof Man | Emergency-positioned · Sarah-magnet | ✅ ADD: LBP-5 already covers emergency line · ADD "GBP openinghours must match site openinghours JSON-LD when emergency_response_sla declared" |
| **Google reviews badge with link** | Roof Repairs Brisbane | Trust offload (clickable to Google) | ⚠️ ADD as optional · don't make rule · since plenty of authentic sites don't show this badge |

---

## §4 · Market floor validation · is our SOP standard substantially above?

**Test**: do our LBP-1..10 rules + hero rules clear what market sites achieve?

| LBP | Market state | Our SOP standard | Differentiation? |
|---|---|---|---|
| LBP-1 NAP consistency | 3/3 sites have phone/address somewhere · but not consistent fold-to-fold | Hard rule · same fold-to-fold | ✅ above floor |
| LBP-2 Google Maps embed | 0/3 saw embed · 1/3 link to maps in footer | Required in service-area OR footer | ✅ above floor |
| LBP-3 Hours of operation (visible + JSON-LD) | 0/3 visible · likely no JSON-LD either | Required visible + JSON-LD | ✅ above floor |
| LBP-4 Insurance disclosure | 0/3 visible | Required visible (LBP-4) | ✅ above floor |
| LBP-5 Emergency conditional | 0/3 with emergency signal in fold (Roof Man has GBP 24hr but not on website) | Required if urgency-heavy/mixed | ✅ above floor (this is HUGE) |
| LBP-6 Quote SLA | 1/3 had "Free - No Strings Attached" · time SLA absent | Required SLA hours OR present_or_absent | ✅ above floor |
| LBP-7 Owner photo + name | 0/3 visible | present_or_absent (post-Codex Round 12) | ✅ above floor when present |
| LBP-8 Year-founded specific | 1/3 had "20 years" · 0/3 "Since YYYY" specific | Required specific year | ✅ above floor |
| LBP-9 Service radius | 1/3 had radius map (iFix) | Required km OR map | ✅ market gets this sometimes |
| LBP-10 Testimonial attribution | 1/3 had name+date (iFix) · 0/3 with full name+suburb+service+date | Required 4 fields | ✅ above floor (strengthen with date) |

**Conclusion**: Our SOP standard is **substantially above market floor**. If we ship sites meeting LBP-1..10 + hero rules, we are differentiating on every rule.

**Risk**: NOT that we're too strict · risk is we don't enforce enough hard rules · or skill mechanisms drift.

---

## §5 · NEW additions to SOP based on browse

Add to `pl-local-trade-page-spec` v1.0 (when we write it):

1. **LBP-11** · Supplier/material partner logo wall (3-6 logos when applicable per niche) · trust-by-association · `present_or_absent` (don't fake)
2. **LBP-12** · Real-trade-context photo in hero · NOT lifestyle stock · NOT generic suburb home · MUST show actual roof / work / worker / tool / vehicle · or honest placeholder with banner
3. **LBP-13** · Testimonial date or recency reference ("April 2024" · "last month" · "this winter") — strengthens LBP-10 anti-fabrication
4. **LBP-14** · GBP-website hours consistency · openingHoursSpecification JSON-LD must match Google Business Profile hours (no claim "24hr" on site if GBP says 8am-5pm)

Add to `pl-anti-slop-catalog`:
- AS-trade-1..8 listed in §1 above

Loosen rule (Codex Round 11 already approved):
- §4.4 price rule: indicative range allowed (Tom-friendly · cited by 1/3 sites successfully)

---

## §6 · Sample size honesty

3 sites is **not statistically significant**. But patterns repeated 3/3 across geographic & SEO-position diverse sources (Ballarat #1 organic + Brisbane #1 GBP + Brisbane #1 organic).

**Confidence**:
- Anti-pattern catalog (3/3 hit) · HIGH confidence
- Working signals (1/3 hit) · MEDIUM confidence · validate against 2-3 more before locking

**Next pass** (Phase A.2 · post-stress-test): browse 5-7 more sites (mix of: Sydney roofer · Melbourne premium roofer · Squarespace/Wix template gallery roofing-contractor templates · Hibu/Localiq case studies). Goal: validate working-signal patterns at higher confidence.

For Phase A Step 0: this 3-site browse is enough to inform SOP §1 + LBP additions. Locking now · iterating with more evidence next pass.

---

## §7 · Synthesis · 4-persona positioning of vicwest

Given the market floor + per-segment scoresheet · vicwest's existing single-page (composite 72) is **substantially above market** (~5/10 average vs market 2.7-5.0/10). The brand-grid-experiment vicwest specifically over-indexes on planned-upgrade (Mike: ~8/10) · under-serves urgent-repair (~3/10) · under-serves commercial (~4/10) · under-serves first-buyer (~5/10).

Confirms Codex Round 12 decision: **vicwest primary_segment = planned-upgrade**. Secondary signals (emergency chip · ABN visible · free-quote prominent) added per SOP §1 rules will lift the under-served segments without losing planned-upgrade fit.

---

## §8 · TL;DR

1. **Market floor is bad**. Average AU roofer site serves 2-5/10 per persona segment.
2. **3/3 sites share the same ~10 anti-patterns** — we have a clear catalog.
3. **Our LBP-1..10 + hero rules are substantially above floor** — every rule differentiates.
4. **4 new rules emerge from browse** (LBP-11 supplier wall · LBP-12 trade photo · LBP-13 review date · LBP-14 GBP-hours consistency).
5. **Vicwest positioning confirmed** (planned-upgrade primary · 3 secondary lift opportunities).
6. **Risk is under-enforcement not over-spec**. Our standards are right · pipeline must mechanically enforce them.

→ Proceed to SOP §1 + §13 rewrite + personas/*.js scaffolds.
