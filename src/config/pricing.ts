export interface PricingTier {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
}

export interface NichePricing {
  niche: string;
  label: string;
  tiers: PricingTier[];
}

export const nichePricing: Record<string, NichePricing> = {
  roofing: {
    niche: 'roofing',
    label: 'Roofing Contractor',
    tiers: [
      {
        id: 'starter',
        name: 'Starter',
        price: 499,
        description: 'Perfect for new roofing companies',
        features: ['Template customization', 'Logo & brand colors', '3 service pages', 'Contact form', 'Mobile responsive'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 799,
        description: 'Complete website for established roofers',
        features: ['Everything in Starter', '5 service pages', 'Project gallery', 'Testimonials section', 'SEO optimization', 'Google Maps integration'],
      },
    ],
  },
  restaurant: {
    niche: 'restaurant',
    label: 'Restaurant & Cafe',
    tiers: [
      {
        id: 'starter',
        name: 'Starter',
        price: 199,
        description: 'Simple menu and contact site',
        features: ['Template customization', 'Logo & brand colors', 'Digital menu', 'Contact form', 'Mobile responsive'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 399,
        description: 'Full restaurant website with reservations',
        features: ['Everything in Starter', 'Photo gallery', 'Reservation integration', 'Reviews section', 'Social media links', 'Hours & location'],
      },
    ],
  },
  saas: {
    niche: 'saas',
    label: 'SaaS & Technology',
    tiers: [
      {
        id: 'starter',
        name: 'Starter',
        price: 499,
        description: 'Landing page for your product',
        features: ['Template customization', 'Logo & brand colors', 'Feature highlights', 'Pricing table', 'Contact form'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 799,
        description: 'Full SaaS marketing site',
        features: ['Everything in Starter', 'Blog setup', 'Case studies', 'Integrations section', 'SEO optimization', 'Analytics setup'],
      },
    ],
  },
};

export function getPricing(niche: string): NichePricing {
  return nichePricing[niche] || nichePricing.saas;
}
