/**
 * Buyer-segment persona · urgent-repair (Sarah)
 *
 * Persona DATA only. This file is consumed as INPUT by:
 *   - core/audit/* (T5 Per-Segment Serviceability dim · deterministic gates + vision LLM weighting)
 *   - skills/pl-au-trade-voice (voice modifiers · tone overrides)
 *   - skills/pl-local-trade-page-spec (which sections REQUIRED for this primary_segment)
 *   - core/handoff/single-page-brief-schema.js (validates primary_segment + secondary_segments fields)
 *
 * Boundary (codex Round 8 hard rule):
 *   - This file MUST NOT contain audit weight LOGIC (that lives in pl-audit-rubric).
 *   - This file MUST NOT contain copy replacement tables (that lives in pl-au-trade-voice).
 *   - personas/*.js = segment-orthogonal data (WHO the visitor is + WHAT they need in 5s).
 *   - trust-signals/*.js stays NICHE-specific (QBCC patterns · roofing supplier logos).
 *   - Both are read by the audit dims · neither imports the other.
 *
 * Source: codex Round 13 spec (2026-05-28) · verbatim · do not paraphrase.
 */

export const segment = {
  id: 'urgent-repair',
  display_name: 'Urgent repair',
  job_to_be_done: 'Stop this leak today',

  demographic: {
    age_range: '35-65',
    household_income_aud: '80-180k',
    home_value_aud: '450k-1.1m',
    location_type: 'outer-suburban / regional',
    device_profile: 'mobile-first',
  },

  trigger_events: [
    'water stain on ceiling',
    'active drip',
    'storm damage',
    'loose flashing',
    'gutter overflow causing internal damage',
  ],

  search_timing: 'lunch break · 4-9pm · immediately after rain/wind',

  information_state: {
    literacy_level: 'low jargon',
    knows: ['leak', 'gutter', 'tile', 'flashing'],
    does_not_know: ['valley', 'sarking', 'ridge capping', 'pointing'],
    description: 'Knows symptom not cause',
  },

  // Top-3 ranked critical signals · drive T5 deterministic gates.
  critical_signals_5_second: [
    {
      id: 'phone_visible',
      priority: 1,
      deterministic_check: 'tel: link in fold + button or large display',
    },
    {
      id: 'emergency_availability',
      priority: 2,
      deterministic_check: '24/7 OR same-day OR emergency_response_sla_hours visible in fold',
    },
    {
      id: 'local_suburb_proof',
      priority: 3,
      deterministic_check: 'city name OR suburb chip in fold',
    },
  ],

  signals_30_second: [
    'leak / storm repair specifically named',
    'proof of fast response',
    'reviews mentioning punctuality',
  ],

  decision_triggers: [
    '"Call now, we can inspect today"',
    'clear temporary make-safe option',
    'no-obligation quote',
    'photo upload / SMS accepted',
    'realistic arrival window',
  ],

  bounce_triggers: [
    'quote form required before phone',
    '"we respond within 48 hours"',
    'luxury renovation language',
    'no emergency mention',
    'vague service area',
  ],

  time_to_decide: 'minutes to same day',
  comparison_set_size: '2-4 tabs · first credible answer often wins',
  job_value_aud: {
    typical_min: 600,
    typical_max: 4500,
    extended_min: 5000,
    extended_max: 12000,
    note: 'extended range when leak reveals larger section',
  },

  information_sources: [
    'Google Maps / GBP',
    'local Facebook group',
    'neighbour text',
    'SES / storm chatter',
    'insurer helpline',
  ],

  risk_concerns: [
    'no-show',
    'price gouge',
    'temporary patch sold as permanent',
    'internal water damage',
    'contractor unavailable after deposit',
  ],

  trust_levers_top_3: [
    'answered phone',
    'real local reviews about urgent leaks',
    'licence / insurance · "make-safe first, quote before major work"',
  ],

  forbidden_signals: [
    'slow "send brief" process',
    'showroom / luxury-first design',
    'no mobile tap-to-call',
    'only new roofs / restorations',
    'cheap anonymous lead-gen feel',
  ],

  au_specific_quirks: [
    'storm / rain urgency seasonal',
    'insurance-compatible photos / invoices expected',
    'state licence thresholds differ',
    'ABN / licence / insurance must be obvious',
  ],

  // T5 audit dim · which of 11 page-spec sections MUST be present when this is primary_segment.
  required_sections: [
    'sticky-header',
    'hero',
    'trust-bar',
    'cta-band',
    'service-area',
    'sticky-mobile-bar',
    'footer',
  ],
  optional_sections: [
    'service-list',
    'about-story',
    'reviews',
    'before-after',
    'process',
    'faq',
  ],

  // Out of 100 · vision-LLM uses these to weight per-signal fold serviceability score.
  signal_weights: {
    phone_visible: 30,
    emergency_availability: 25,
    local_suburb_proof: 15,
    fast_response_proof: 10,
    licence_insurance_visible: 10,
    review_punctuality_mention: 5,
    realistic_arrival_window: 5,
  },

  // Voice layer modifiers · consumed by pl-au-trade-voice when this segment is primary.
  voice_modifiers: {
    tone: 'urgent · direct · empathetic',
    forbidden_phrases_extra: [
      'we respond within 48 hours',
      'luxury',
      'showroom',
      'transform your home',
    ],
  },

  // Mixed-mode secondary representation (Codex Q-P-5).
  // When this segment is a SECONDARY (not primary), use these restrained surfaces.
  secondary_representation: {
    fold_chip: 'Emergency leak repairs available',
    mobile_sticky: 'Call roofer', // neutral · not urgency-dominant
    below_fold_band: 'Storm and leak repairs · same day across <city>',
  },
};

export default segment;
