/**
 * Buyer-segment persona · guided-first-time-buyer (Tom)
 *
 * Persona DATA only. Consumed as INPUT by audit T5 dim + voice + page-spec.
 * See core/audit/personas/urgent-repair.js header for the full boundary rule.
 *
 * Source: codex Round 13 spec (2026-05-28) · verbatim.
 */

export const segment = {
  id: 'guided-first-time-buyer',
  display_name: 'Guided first-time buyer',
  job_to_be_done: 'Figure out what is wrong · whether it is urgent · roughly what it costs',

  demographic: {
    age_range: '25-38',
    household_income_aud: '70-150k',
    home_value_aud: '450-850k',
    location_type: 'growth suburbs / older stock first homes',
    device_profile: 'mobile-heavy',
  },

  trigger_events: [
    'building inspection flagged something',
    'first leak after move-in',
    'scary quote from another tradie',
    'insurance / loan stress',
    'unsure if urgent',
  ],

  search_timing: 'evenings · weekends · after inspection report or rain',

  information_state: {
    literacy_level: 'low',
    knows: ['"roof problem"'],
    does_not_know: ['severity', 'urgency vs deferrable', 'realistic price'],
    description: 'Wants translation: what is urgent · what waits · roughly how much',
  },

  critical_signals_5_second: [
    {
      id: 'plain_language_help',
      priority: 1,
      deterministic_check:
        'fold reading level (Flesch) ≥70 AND no jargon: valley · sarking · ridge capping · pointing in headline/subhead',
    },
    {
      id: 'free_or_clear_quote_pathway',
      priority: 2,
      deterministic_check: 'fold contains "free" OR "no obligation" OR "no surprise" near a quote/inspection CTA',
    },
    {
      id: 'price_reassurance',
      priority: 3,
      deterministic_check:
        'indicative price range visible OR "no surprise costs" / "upfront pricing" copy present (pricing_disclosure_mode = indicative_range required for primary)',
    },
  ],

  signals_30_second: [
    'simple service explanations',
    'reviews from homeowners',
    'photos showing common problems',
    'friendly call / message option',
  ],

  decision_triggers: [
    '"send photos and we will guide you"',
    'upfront inspection / quote terms',
    'rough price bands',
    'no-pressure language',
    'repair-vs-replace explanation',
  ],

  bounce_triggers: [
    'long technical form',
    'no price anchor',
    'aggressive emergency tone',
    'prestige / luxury feel',
    'tradie slang exclusionary',
    '"call only" if anxious',
  ],

  time_to_decide: '1-5 days (unless active leak)',
  comparison_set_size: '3-6 tabs · low confidence',
  job_value_aud: {
    typical_min: 500,
    typical_max: 3500,
    extended_min: 5000,
    extended_max: 15000,
    note: 'extended range if inspection leads to major work',
  },

  information_sources: [
    'Google',
    'Reddit / AusRenovation',
    'first-home buyer groups',
    'parents',
    'building inspector',
    'local Facebook',
    'real estate agent',
  ],

  risk_concerns: [
    'ripped off',
    'paying for unnecessary replacement',
    'hidden costs',
    'wrong material',
    'work not fixing issue',
    'deposit disappearing',
  ],

  trust_levers_top_3: [
    'plain-English diagnosis',
    'rough cost ranges',
    'named person + local reviews with "explained everything" language',
  ],

  forbidden_signals: [
    '"Premium roof transformations" only',
    'dense jargon',
    'no cost hints',
    'no beginner pathway',
    'forms asking for specs they do not know',
  ],

  au_specific_quirks: [
    'building & pest reports trigger search',
    'sensitive to stamp duty / mortgage strain',
    'value GST-inclusive clarity (budgets tight)',
  ],

  required_sections: [
    'sticky-header',
    'hero',
    'trust-bar',
    'service-list',
    'about-story',
    'reviews',
    'faq',
    'cta-band',
    'sticky-mobile-bar',
    'footer',
  ],
  optional_sections: ['before-after', 'service-area', 'process'],

  signal_weights: {
    plain_language_help: 25,
    free_no_obligation_pathway: 20,
    price_reassurance: 20,
    named_person_friendly_tone: 10,
    homeowner_reviews_with_explanation_language: 10,
    repair_vs_replace_explanation: 10,
    no_specs_required_to_enquire: 5,
  },

  voice_modifiers: {
    tone: 'plain · friendly · reassuring · explanatory · no jargon',
    forbidden_phrases_extra: [
      'premium roof transformations',
      'bespoke',
      'luxury',
      'connoisseur',
      'pinnacle',
    ],
  },

  secondary_representation: {
    fold_chip: 'First-home help · no-surprise quotes',
    mobile_sticky: 'Ask a question',
    below_fold_band: 'New to home repairs? Send a photo · we will explain what we see',
  },
};

export default segment;
