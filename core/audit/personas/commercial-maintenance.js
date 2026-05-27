/**
 * Buyer-segment persona · commercial-maintenance (Karen)
 *
 * Persona DATA only. Consumed as INPUT by audit T5 dim + voice + page-spec.
 * See core/audit/personas/urgent-repair.js header for the full boundary rule.
 *
 * Source: codex Round 13 spec (2026-05-28) · verbatim.
 */

export const segment = {
  id: 'commercial-maintenance',
  display_name: 'Commercial maintenance',
  job_to_be_done: 'Add a reliable roofer to an approved supplier list / dispatch a maintenance job',

  demographic: {
    age_range: '30-55',
    role: 'property mgr / facilities / strata / small business owner',
    device_profile: 'desktop · business hours',
  },

  trigger_events: [
    'tenant complaint',
    'gutter overflow across multiple units',
    'scheduled maintenance gap',
    'compliance audit',
    'owner request',
    'reactive repairs costing too much',
  ],

  search_timing: 'business hours · weekday daytime',

  information_state: {
    literacy_level: 'high procurement · medium roofing',
    knows: ['invoices', 'SWMS', 'PL insurance', 'access', 'tenant notice', 'photos'],
    does_not_know: ['exact roofing diagnosis'],
    description: 'Process-led buyer · evaluates suppliers like a vendor not a tradie',
  },

  critical_signals_5_second: [
    {
      id: 'commercial_work_named',
      priority: 1,
      deterministic_check:
        'fold or top-nav contains "commercial" OR "body corporate" OR "strata" OR "real estate" OR "property manager"',
    },
    {
      id: 'compliance_block_visible',
      priority: 2,
      deterministic_check: 'ABN + licence + insurance visible above-fold (text or chip)',
    },
    {
      id: 'quote_reporting_pathway',
      priority: 3,
      deterministic_check: 'email contact present OR "send report" / "site report" / "work order" copy present',
    },
  ],

  signals_30_second: [
    'maintenance plans',
    'photo reports',
    'invoicing / payment terms',
    'ability to coordinate tenants / access',
  ],

  decision_triggers: [
    'can send photos / report after inspection',
    'accepts work orders / POs',
    'clear response SLAs',
    'professional admin',
    'recurring maintenance option',
  ],

  bounce_triggers: [
    'residential-only emotional copy',
    'no ABN',
    'no insurance / compliance mention',
    'no email pathway',
    'no capacity signal',
    'only "call now mate" tone',
  ],

  time_to_decide: '1-7 business days (small) · 2-6 weeks (panels / strata approval)',
  comparison_set_size: '2-4 approved / candidates · constrained by agency preferred supplier',
  job_value_aud: {
    typical_min: 1000,
    typical_max: 8000,
    extended_min: 10000,
    extended_max: 100000,
    note: 'initial job small · annual LTV across portfolio AU$10k-100k+',
  },

  information_sources: [
    'existing supplier lists',
    'other property managers',
    'LinkedIn / network referrals',
    'Google',
    'strata recommendations',
    'Xero / MYOB vendor history',
  ],

  risk_concerns: [
    'tenant complaints',
    'poor documentation',
    'uninsured site incident',
    'delayed invoices',
    'unapproved work',
    'bypassed process',
  ],

  trust_levers_top_3: [
    'compliance pack (licence + ABN + PL insurance)',
    'sample photo report',
    '"real estate / property manager friendly" process',
  ],

  forbidden_signals: [
    'no company details',
    'no paperwork language',
    'no email contact',
    'no commercial page',
    'heavy residential hero only',
    'cash / deposit-first tone',
  ],

  au_specific_quirks: [
    'ABN + valid tax invoices essential',
    'GST registration matters for tax credits',
    'state building / licence / insurance documentation are procurement filters',
  ],

  required_sections: [
    'sticky-header',
    'hero',
    'trust-bar',
    'service-list',
    'service-area',
    'process',
    'cta-band',
    'footer',
  ],
  optional_sections: ['about-story', 'reviews', 'before-after', 'faq', 'sticky-mobile-bar'],

  signal_weights: {
    commercial_work_named: 25,
    abn_visible: 15,
    insurance_visible: 15,
    licence_visible: 10,
    email_contact_visible: 10,
    photo_report_promise: 10,
    work_order_accepted: 10,
    recurring_maintenance_option: 5,
  },

  voice_modifiers: {
    tone: 'professional · process-led · administrative-fluent · low emotion',
    forbidden_phrases_extra: [
      'mate',
      'cashie',
      'family',
      'we love',
      'we are passionate',
    ],
  },

  secondary_representation: {
    fold_chip: 'Commercial and strata work',
    mobile_sticky: 'Email enquiry',
    below_fold_band: 'For property managers, strata, real estate · ABN + PL insurance + photo reports',
  },
};

export default segment;
