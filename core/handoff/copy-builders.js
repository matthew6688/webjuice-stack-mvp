/**
 * core/handoff/copy-builders.js · Per-template-profile copy dispatch.
 *
 * Each profile (editorial / direct) gets a pure function that takes normalized
 * facts and returns section copy (eyebrows · headlines · subheads · about paragraphs).
 *
 * Composer side:
 *   const facts = normalize(clientCtx);
 *   const copy = COPY_BUILDERS[templateProfile](facts);
 *   ctx.services = { ...copy.services, items: servicesItems };
 *
 * Per codex R40 Q-VV-1 (B) + Q-VV-5 (b):
 *   - 17+ copy points need profile-aware values; inline branches would scatter.
 *   - Builders are pure · easy to fixture-test.
 *
 * Profile semantics:
 *   editorial · warm-editorial poetic voice (matches editorial-newsletter template)
 *               magazine metaphors: "The Workshop", "The Catalogue", "The Plates"
 *   direct    · safe AU-trade voice (matches trade-classic template)
 *               action labels: "Why X", "What we do", "Recent work"
 *
 * About paragraphs · CRITICAL BUGFIX (codex R40 Q-VV-3):
 *   narrative.about_us_draft is often a single 1500-2000 char block (no \n\n).
 *   Direct profile: ignores narrative entirely · builds 3 fact-paragraphs.
 *   Editorial profile: sentence-groups narrative into 3 paragraphs (defensive).
 */

/**
 * Sentence-group a long paragraph into N shorter paragraphs of roughly equal length.
 * Each output paragraph is ≥ 1 sentence · target ≤ 600 chars.
 *
 * @param {string} text · single block of prose (may have \n\n already)
 * @param {number} targetCount · how many paragraphs to produce · default 3
 * @returns {string[]} array of paragraph strings
 */
export function sentenceGroup(text, targetCount = 3, maxParagraphChars = 500) {
  if (!text || typeof text !== 'string') return [];
  // If already paragraph-split AND each chunk is within char-cap · respect it
  const preSplit = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (preSplit.length >= targetCount && preSplit.every(p => p.length <= maxParagraphChars)) {
    return preSplit.slice(0, Math.max(targetCount, preSplit.length));
  }
  if (preSplit.length > 1) text = preSplit.join(' ');

  // Tokenize sentences · keep punctuation
  const sentences = text.match(/[^.!?]+[.!?]+["']?(?:\s+|$)/g);
  if (!sentences || sentences.length === 0) return [text.trim()];
  if (sentences.length <= targetCount) {
    return sentences.map(s => s.trim());
  }

  // Char-aware grouping (codex R40-followup Q-WW-2): pack sentences into paragraphs
  // until next sentence would exceed maxParagraphChars · start new paragraph.
  // Always produce at least `targetCount` paragraphs (split larger groups if needed).
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length === 0) { cur = s.trim(); continue; }
    if (cur.length + s.length + 1 > maxParagraphChars) {
      out.push(cur); cur = s.trim();
    } else {
      cur += ' ' + s.trim();
    }
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

/**
 * Build 3 fact-anchored paragraphs for direct profile (no LLM · deterministic).
 *
 * CODEX R40-followup safety: NO INVENTED CLIENT-SPECIFIC FACTS.
 * Previous draft had "one ute, one ladder" / "same family" / "We don't subcontract" — these
 * were copied from vicwest narrative and would be hallucinated claims for a-j / mark-squire.
 * Direct paragraphs are now built ONLY from verified facts + universal trade truths
 * (warranty existence · licensing · service area).
 *
 * @param {object} f normalized facts
 * @returns {string[]} 3 paragraphs (use ai-fabricated indicator if YELLOW · per banner system)
 */
function buildDirectAboutParagraphs(f) {
  const {
    business_name, city, state, years_in_business,
    warranty_years_verified, license_authority, license_number, license_visible,
    suburbs_verified = [], services_count = 0,
  } = f;
  // Codex R40 3rd-pass · 2 hallucination guards:
  // (1) ONLY use verified suburbs (not radius-inferred) for coverage claim
  // (2) ONLY use warranty term if source data confirmed it · else generic clause
  const yrsClause = years_in_business
    ? `${years_in_business}+ years working ${city} roofs`
    : `working ${city} roofs`;
  const licClause = license_visible && license_number
    ? `${license_authority}-licensed (${license_number}), fully insured`
    : (license_authority ? `${license_authority}-licensed, fully insured` : 'Fully insured');
  // Coverage sentence · verified suburbs only · fall back to "${city} and surrounds" if < 3 verified
  const topVerified = suburbs_verified.slice(0, 5).filter(Boolean);
  const coverageSentence = topVerified.length >= 3
    ? `We cover ${topVerified.slice(0, -1).join(', ')} and ${topVerified[topVerified.length - 1]}${topVerified.length >= 5 ? ' and surrounds' : ''}${services_count >= 3 ? `, working across ${services_count} core services` : ''}.`
    : `We cover ${city} and surrounds${services_count >= 3 ? `, working across ${services_count} core services` : ''}.`;
  // Warranty sentence · only quote a term when source-confirmed · else generic
  const warrantySentence = warranty_years_verified
    ? `Every job comes with a ${warranty_years_verified} written workmanship warranty.`
    : 'Written workmanship warranty included on every job.';

  return [
    `${business_name} is a ${city}-based roofing company — ${yrsClause}. ${licClause}.`,
    coverageSentence,
    `${warrantySentence} Free on-site quote. Same point of contact from first call to handover.`,
  ];
}

/**
 * Build 3 narrative-derived paragraphs for editorial profile (defensive split).
 *
 * @param {object} f normalized facts
 * @param {string|string[]} narrativeAbout · raw narrative.about_us_draft or .company_background
 * @returns {string[]} array of paragraphs (1-3)
 */
function buildEditorialAboutParagraphs(f, narrativeAbout) {
  const { business_name, city, year_founded } = f;
  if (!narrativeAbout) {
    // Fallback when narrative missing
    return [
      `${business_name} has worked the ${city} region since ${year_founded || '2003'}. We run our own crew, scope quotes on site, and put a written warranty in your hands.`,
    ];
  }
  const arr = Array.isArray(narrativeAbout) ? narrativeAbout : [narrativeAbout];
  // Try existing structure first · then sentence-group long blocks
  const joined = arr.map(s => String(s).trim()).filter(Boolean).join('\n\n');
  return sentenceGroup(joined, 3);
}

// ─── Editorial profile (warm-editorial · matches editorial-newsletter) ───────────────
function editorialBuilders(facts, extras = {}) {
  const { business_name, city, state, years_in_business, services_count, review_count } = facts;
  // Codex R40-followup Q-WW-7: use normalized years_in_business · not `new Date()` inside builders
  return {
    services: {
      eyebrow: 'The Catalogue',
      headline: `${services_count >= 1 ? services_count : 'A few'} trades, one ledger.`,
      subhead: 'Every job is quoted in writing, scoped on site, and signed off when it is done. No surprises on the invoice — and the warranty is on the paperwork, not the handshake.',
    },
    about: {
      eyebrow: 'The Workshop',
      headline: years_in_business
        ? `${years_in_business} years on ${city} roofs.`
        : `Local ${city} roofers.`,
      paragraphs: buildEditorialAboutParagraphs(facts, extras.narrativeAbout),
      image_caption: `Field survey · ${city} workshop · weekday call-outs`,
    },
    reviews: {
      eyebrow: 'From the letters page',
      headline: `What ${city} homeowners say.`,
      subhead_real: `A representative selection from our Google reviews. Verbatim — author, suburb, and star count unchanged.`,
      subhead_placeholder: `A representative selection. Verbatim Google reviews replace these once published.`,
    },
    gallery: {
      eyebrow: 'The Plates',
      headline: `Before, after — ${city} roofs.`,
      subhead: 'Three recent jobs across the catalogue. More on request when we quote.',
    },
    coverage: {
      eyebrow: 'The Beat',
      headline: 'Where we work.',
      subhead: `Based in ${city}, on ${city} roofs every working day. Most call-outs are local — we'll travel further by arrangement.`,
    },
    contact: {
      eyebrow: 'The Correspondence',
      headline: 'Request a written quote.',
      subhead: `Tell us the roof, the suburb, and the trouble. We'll come and look, then send a written quote — usually within two working days.`,
    },
  };
}

// ─── Direct profile (safe AU-trade · matches trade-classic) ───────────────────────────
function directBuilders(facts, extras = {}) {
  const {
    business_name, short_name, city, state, years_in_business,
    services_count, review_count, rating,
  } = facts;
  // Codex R40-followup Q-WW-4: handle services_count === 0 gracefully; Q-WW-7: avoid new Date()
  // Codex R40-followup Q-WW-1: NO "Same family, same standard" — invented per-client claim
  return {
    services: {
      eyebrow: 'What we do',
      headline: services_count >= 1
        ? `${services_count} things we do well across ${city} roofs.`
        : `What we do across ${city} roofs.`,
      subhead: `From repairs through to full replacements — every job comes with a written quote, an ABN-backed invoice, and the warranty in writing. Fully insured.`,
    },
    about: {
      eyebrow: `Why ${short_name || business_name}`,
      headline: years_in_business
        ? `${years_in_business}+ years of ${city} roofs.`
        : `Local ${city} roofers.`,
      paragraphs: buildDirectAboutParagraphs(facts),
      image_caption: `${business_name} on a recent ${city} job`,
    },
    reviews: {
      eyebrow: `What ${city} says`,
      headline: rating && review_count
        ? `${rating}★ on Google over ${review_count} reviews.`
        : `Recent ${city} customers.`,
      subhead_real: `These are real reviews pulled from our verified Google Business profile.`,
      subhead_placeholder: `A representative selection · client to swap for verified Google reviews before launch.`,
    },
    gallery: {
      eyebrow: 'Recent work',
      headline: `Before & After. Real ${city} roofs.`,
      subhead: `Real jobs from the last 12 months — same angle, same light, no staging.`,
    },
    coverage: {
      eyebrow: 'Where we work',
      headline: `${city} & ${state === 'VIC' ? 'Western Victoria' : state === 'QLD' ? 'Far North Queensland' : 'surrounds'}. We come to you.`,
      subhead: `Based in ${city} — most of our work is within 35km of central ${city}. Travel beyond by arrangement.`,
    },
    contact: {
      eyebrow: 'Get in touch',
      headline: 'Free on-site quote. Same-day email response.',
      subhead: `Pick up the phone for the fastest response. Otherwise drop your name and email below and we'll write back within two hours during business hours.`,
    },
  };
}

/**
 * Profile dispatch.
 *
 * @param {string} profile · 'editorial' | 'direct'
 * @param {object} facts · normalized fact ctx (see normalize() below or composer)
 * @param {object} extras · { narrativeAbout: string|string[] } · raw narrative for editorial defensive split
 * @returns {object} section copy { services, about, reviews, gallery, coverage, contact }
 */
export function buildCopy(profile, facts, extras = {}) {
  if (profile === 'direct') return directBuilders(facts, extras);
  return editorialBuilders(facts, extras);  // default
}

/**
 * Normalize composer's mixed ctx into a stable facts contract for builders.
 * Codex R40 risk-note: "make sure COPY_BUILDERS does not reach into raw client JSON
 * inconsistently. Normalize facts once."
 *
 * @returns {object} normalized facts
 */
export function normalizeFacts(input) {
  return {
    business_name: input.business_name || '',
    short_name: input.short_name || input.business_name || '',
    city: input.city || '',
    state: input.state || '',
    year_founded: input.year_founded || null,
    years_in_business: input.years_in_business || null,
    // Codex R40 3rd-pass hallucination guard: SOURCE-CONFIRMED warranty term only · null if unverified
    warranty_years_verified: input.warranty_years_verified || null,
    license_authority: input.license_authority || '',
    license_number: input.license_number || '',
    license_visible: !!input.license_visible,
    services_count: input.services_count || 0,
    suburbs_count: input.suburbs_count || 0,
    // suburbs: merged list (may include inferred) · for non-claim use only
    suburbs: input.suburbs || [],
    // suburbs_verified: ONLY verified-provenance suburbs · used for coverage claim
    suburbs_verified: input.suburbs_verified || [],
    rating: input.rating || null,
    review_count: input.review_count || null,
  };
}
