import { artifactTimestamp } from '../../core/time.js';

export const RESTAURANT_FALLBACK_LEVELS = {
  A: 'official_site_menu',
  B: 'pdf_menu',
  C: 'google_places_with_ocr_or_candidates',
  D: 'starter_no_menu_claims',
};

export const RESTAURANT_REQUIRED_KEYS = [
  'hero.name',
  'contact.phone',
  'contact.address',
  'contact.googleMapsUrl',
  'cta.callUrl',
  'cta.mapUrl',
  'menu.sourceUrl',
  'menu.sections',
];

export function createEmptyRestaurantContent({ clientSlug, sourceEvidencePath }) {
  return {
    schemaVersion: 1,
    niche: 'restaurant',
    clientSlug,
    sourceEvidencePath,
    generatedAt: artifactTimestamp(),
    fallbackLevel: null,
    hero: {
      name: '',
      cuisine: '',
      rating: null,
      reviewCount: 0,
      tagline: '',
    },
    contact: {
      phone: '',
      email: '',
      address: '',
      website: '',
      googleMapsUrl: '',
    },
    cta: {
      callUrl: '',
      mapUrl: '',
      reserveUrl: '',
    },
    booking: null,
    menu: {
      sourceUrl: '',
      sections: [],
      sourceChain: [],
    },
    gallery: [],
    brand: {
      logo: '',
      colors: [],
      ogImage: '',
    },
    evidenceSummary: [],
  };
}
