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
        id: 'one_time',
        name: 'One-time website',
        price: 399,
        description: 'For one-page local business websites with structured async intake and a clear revision boundary.',
        features: ['One-page website build and launch', '3 included revision requests', 'Hosting included', 'Free profitslocal subdomain', 'Simple contact form'],
      },
      {
        id: 'yearly_maintenance',
        name: 'Website + monthly maintenance',
        price: 799,
        description: 'For one-page sites with menus, hours, events, offers, or services that need changes during the year.',
        features: ['One-page website build and launch', '12 included revision requests per year', 'Monthly maintenance', 'Local SEO cleanup', 'Domain setup guidance'],
      },
      {
        id: 'extra_revision',
        name: 'Extra revision',
        price: 100,
        description: 'For one more in-scope change request after you have used the revisions included in your plan.',
        features: ['Adds 1 extra revision request', 'For the current one-page version', 'Tied to your original order'],
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
