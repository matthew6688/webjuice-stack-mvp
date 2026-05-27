/**
 * Buyer-segment persona · planned-upgrade (Mike)
 *
 * Persona DATA only. Consumed as INPUT by audit T5 dim + voice + page-spec.
 * See core/audit/personas/urgent-repair.js header for the full boundary rule
 * (codex Round 8): no audit weights · no copy tables · niche concerns live in
 * trust-signals/*.js, segment concerns live here · they are orthogonal.
 *
 * Source: codex Round 13 spec (2026-05-28) · verbatim.
 */

export const segment = {
  id: 'planned-upgrade',
  display_name: 'Planned upgrade',
  job_to_be_done: 'Get the roof replaced / restored properly · the right way',

  demographic: {
    age_range: '40-70',
    household_income_aud: '120-300k+',
    home_value_aud: '700k-2m+',
    location_type: 'established suburbs / growth corridors / acreage',
    device_profile: 'desktop evening + mobile follow-up',
  },

  trigger_events: [
    'pre-sale prep',
    'roof visibly aged',
    'solar install blocked by roof condition',
    'repeated minor leaks',
    'faded tile / Colorbond lowering street appeal',
  ],

  search_timing: 'evenings · weekends · pre-listing windows',

  information_state: {
    literacy_level: 'medium',
    knows: ['roof restoration / replacement', 'Colorbond / tile', 'warranty', 'quote comparison'],
    does_not_know: ['ventilation', 'battens', 'compliance specifics'],
    description: 'Medium literacy · researches before committing',
  },

  critical_signals_5_second: [
    {
      id: 'completed_work_photos',
      priority: 1,
      deterministic_check: 'hero or near-fold image is genuine completed-roof photo · NOT lifestyle stock',
    },
    {
      id: 'restoration_replacement_expertise_named',
      priority: 2,
      deterministic_check: 'fold text contains "restoration" OR "replacement" OR "re-roof"',
    },
    {
      id: 'credibility_block_present',
      priority: 3,
      deterministic_check: 'licence + warranty + years OR reviews chip visible in fold',
    },
  ],

  signals_30_second: [
    'clear process: inspection → quote',
    'material options + brands named',
    'value / resale / energy / durability framing',
  ],

  decision_triggers: [
    'detailed inspection booked',
    'itemised quote',
    'warranty explained',
    'before/after matching their roof type',
    'confident but not pushy',
  ],

  bounce_triggers: [
    'cheap patch-repair positioning',
    'amateur photos',
    'no warranty detail',
    'no licence / insurance',
    'too emergency-focused',
    'generic "all trades" vibe',
  ],

  time_to_decide: '3 days to 3 weeks · pre-sale can compress to 48 hours',
  comparison_set_size: '3-5 quotes · 3+ serious tabs',
  job_value_aud: {
    typical_min: 8000,
    typical_max: 35000,
    extended_min: 40000,
    extended_max: null, // open-ended for large / acreage / premium metal
    note: 'AU$40k+ for large / complex / acreage / premium metal',
  },

  information_sources: [
    'Google organic / GBP',
    'real estate agent',
    'neighbour roofs',
    'Facebook community',
    'product manufacturer sites',
    'renovation forums',
  ],

  risk_concerns: [
    'overpaying',
    'wrong scope',
    'poor workmanship',
    'warranty not honoured',
    'hidden extras',
    'delays before listing',
  ],

  trust_levers_top_3: [
    'project gallery with suburbs',
    'itemised written quote + warranty',
    'named materials / brands + workmanship explanation',
  ],

  forbidden_signals: [
    'bargain-basement copy',
    'no project photos',
    'no formal quote process',
    'no warranty language',
    '"cashie" tone',
    'messy branding',
  ],

  au_specific_quirks: [
    'Colorbond vs tile preference',
    'bushfire / coastal / cyclone material implications',
    'ABN / GST tax invoices + written contracts matter for big jobs',
  ],

  required_sections: [
    'sticky-header',
    'hero',
    'trust-bar',
    'service-list',
    'about-story',
    'reviews',
    'before-after',
    'service-area',
    'process',
    'cta-band',
    'footer',
  ],
  optional_sections: ['faq', 'sticky-mobile-bar'],

  signal_weights: {
    completed_work_photos: 25,
    warranty_visible: 15,
    licence_visible: 15,
    years_in_business: 10,
    itemised_quote_promise: 10,
    materials_brands_named: 10,
    before_after_gallery: 10,
    reviews_with_location: 5,
  },

  voice_modifiers: {
    tone: 'confident · craft-focused · evidence-led · no hype',
    forbidden_phrases_extra: [
      'cheap',
      'budget',
      'cashie',
      'starting from $',
      'unbeatable price',
    ],
  },

  secondary_representation: {
    fold_chip: 'Re-roof and restoration quotes',
    mobile_sticky: 'Get a quote',
    below_fold_band: 'Roof restoration and replacement · written quotes with warranty',
  },
};

export default segment;
