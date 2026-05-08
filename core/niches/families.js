export const NICHE_FAMILIES = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / hospitality',
    aliases: ['restaurant', 'cafe', 'bar', 'bistro', 'steakhouse', 'eatery'],
    primaryCtaType: 'book_or_visit',
    coreSections: {
      starter: ['hero', 'services', 'about', 'social-proof', 'cta'],
      redesign: ['hero', 'menu-or-offer', 'trust', 'about', 'cta'],
      teaser: ['hero', 'services', 'about', 'cta'],
    },
    defaultServices: ['Signature offer', 'Private bookings', 'Visit information'],
    audience: 'local customers comparing options on mobile before they call, book, or visit',
    tones: {
      default: 'warm, editorial, inviting',
      redesign: 'confident, refined, locally credible',
    },
    designDirection: ['editorial photography', 'atmospheric but clean', 'mobile-first menu flow'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'weak_website',
      weakSignal: 'missing_conversion_path',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode is enough when the restaurant is reachable but still thin on verified content.',
  },
  field_service: {
    id: 'field_service',
    label: 'Field service',
    aliases: ['roofing', 'roofer', 'roof restoration', 'roof repairs', 'roof repair', 'roof coating', 'roof coatings', 'roof painting', 'plumber', 'plumbing', 'hvac', 'chimney repair', 'chimney', 'fence installer', 'fence', 'landscaper', 'landscaping', 'contractor', 'trades'],
    primaryCtaType: 'quote_or_call',
    coreSections: {
      starter: ['hero', 'services', 'service-area', 'trust', 'cta'],
      redesign: ['hero', 'services', 'service-area', 'proof', 'cta'],
      teaser: ['hero', 'services', 'trust', 'cta'],
    },
    defaultServices: ['Core service', 'Emergency or fast response', 'Quote / inspection'],
    audience: 'property owners who need a reliable local operator they can contact quickly',
    tones: {
      default: 'practical, credible, conversion-focused',
      redesign: 'confident, practical, conversion-focused',
    },
    designDirection: ['high-contrast CTA', 'practical trust signals', 'service-area clarity'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'missing_conversion_path',
      weakSignal: 'missing_trust_signal',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode is useful when we can show service clarity and a fast quote path before deeper proof is collected.',
  },
  clinic: {
    id: 'clinic',
    label: 'Clinic',
    aliases: ['dental', 'dentist', 'dental clinic', 'medical clinic', 'clinic'],
    primaryCtaType: 'book_or_call',
    coreSections: {
      starter: ['hero', 'services', 'trust', 'team', 'cta'],
      redesign: ['hero', 'services', 'trust', 'team', 'cta'],
      teaser: ['hero', 'services', 'trust', 'cta'],
    },
    defaultServices: ['Primary treatment', 'Trust / expertise', 'Consultation booking'],
    audience: 'local patients comparing options on mobile before they call, book, or enquire',
    tones: {
      default: 'calm, trustworthy, direct',
      redesign: 'confident, refined, locally credible',
    },
    designDirection: ['calm hierarchy', 'trust-forward structure', 'easy booking path'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'weak_website',
      weakSignal: 'missing_trust_signal',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode works when the clinic is reachable but patient-facing proof still needs confirming.',
  },
  professional_service: {
    id: 'professional_service',
    label: 'Professional service',
    aliases: ['law', 'law firm', 'attorney', 'lawyer', 'real estate', 'real estate agent', 'financial service', 'finance'],
    primaryCtaType: 'consult_or_call',
    coreSections: {
      starter: ['hero', 'services', 'trust', 'about', 'cta'],
      redesign: ['hero', 'services', 'trust', 'credentials', 'cta'],
      teaser: ['hero', 'services', 'trust', 'cta'],
    },
    defaultServices: ['Primary service', 'Trust / expertise', 'Consultation booking'],
    audience: 'local clients comparing a few options and looking for the most credible next step',
    tones: {
      default: 'calm, trustworthy, direct',
      redesign: 'confident, refined, locally credible',
    },
    designDirection: ['quiet premium layout', 'clear hierarchy', 'trust-first messaging'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'weak_website',
      weakSignal: 'missing_trust_signal',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode should stay credibility-first and avoid overclaiming expertise or results.',
  },
  studio_or_visual: {
    id: 'studio_or_visual',
    label: 'Studio / visual business',
    aliases: ['salon', 'photographer', 'photography', 'beauty studio', 'stylist'],
    primaryCtaType: 'book_or_message',
    coreSections: {
      starter: ['hero', 'services', 'gallery', 'about', 'cta'],
      redesign: ['hero', 'services', 'gallery', 'trust', 'cta'],
      teaser: ['hero', 'services', 'gallery', 'cta'],
    },
    defaultServices: ['Core offer', 'Visual proof', 'Book or enquire'],
    audience: 'local customers comparing style, quality, and ease of booking',
    tones: {
      default: 'warm, aspirational, human',
      redesign: 'confident, refined, locally credible',
    },
    designDirection: ['visual first impression', 'clean booking path', 'social-proof rhythm'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'mismatch_website',
      weakSignal: 'missing_conversion_path',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode is still useful when visual businesses have enough presence to suggest a better booking flow.',
  },
  venue: {
    id: 'venue',
    label: 'Venue / events',
    aliases: ['event venue', 'venue', 'wedding venue', 'function venue'],
    primaryCtaType: 'enquiry',
    coreSections: {
      starter: ['hero', 'venue-highlights', 'event-types', 'gallery', 'cta'],
      redesign: ['hero', 'venue-highlights', 'event-types', 'gallery', 'cta'],
      teaser: ['hero', 'venue-highlights', 'gallery', 'cta'],
    },
    defaultServices: ['Venue highlight', 'Event type', 'Enquiry CTA'],
    audience: 'people comparing venues who need confidence in atmosphere, fit, and enquiry speed',
    tones: {
      default: 'premium, inviting, clear',
      redesign: 'confident, refined, locally credible',
    },
    designDirection: ['space-led imagery', 'premium restraint', 'clear enquiry path'],
    problemTypes: {
      noWebsite: 'no_website',
      redesign: 'weak_website',
      weakSignal: 'missing_trust_signal',
      default: 'outreach_probe',
    },
    teaserReason: 'Teaser mode can still sell a venue when the atmosphere and enquiry path are clearer than the current site.',
  },
};

export function inferNicheFamily(industry = '') {
  const normalized = String(industry || '').toLowerCase().trim();
  if (!normalized) return NICHE_FAMILIES.professional_service;
  for (const family of Object.values(NICHE_FAMILIES)) {
    if (family.aliases.some((alias) => normalized.includes(alias))) return family;
  }
  return NICHE_FAMILIES.professional_service;
}

export function familyCoreSections(family, mode) {
  return family.coreSections?.[mode] || family.coreSections?.starter || ['hero', 'services', 'about', 'cta'];
}
