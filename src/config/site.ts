export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  email: string;
  domain: string;
  fromName: string;
  navLinks: { label: string; href: string }[];
  footer: {
    text: string;
  };
}

export const siteConfig: SiteConfig = {
  name: 'Profits Local',
  tagline: 'Preview Websites for Local Businesses',
  description: 'Fast restaurant and local business preview sites for outreach, review, and launch.',
  email: 'hello@fengtalk.ai',
  domain: 'profitslocal.com',
  fromName: 'Profits Local',
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
    { label: 'Cases', href: '/cases' },
    { label: 'Contact', href: '/contact' },
  ],
  footer: {
    text: 'Built with Astro + Cloudflare.',
  },
};
