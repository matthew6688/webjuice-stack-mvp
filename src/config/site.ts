export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  email: string;
  domain: string;
  fromName: string;
  navLinks: { label: string; href: string }[];
  socialLinks: { label: string; href: string }[];
  footer: {
    text: string;
  };
}

export const siteConfig: SiteConfig = {
  name: 'profitslocal',
  tagline: 'See your local-business website before you pay',
  description: 'profitslocal builds a free website preview for local businesses. Review the page first, then pay only if you want revisions, launch help, or ongoing updates.',
  email: 'support@profitslocal.com',
  domain: 'profitslocal.com',
  fromName: 'profitslocal',
  navLinks: [
    { label: 'How it works', href: '/#process' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/#contact' },
  ],
  socialLinks: [
    { label: 'YouTube', href: 'https://www.youtube.com/@profitslocal' },
    { label: 'X', href: 'https://x.com/profitslocal' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/profitslocal' },
    { label: 'Facebook', href: 'https://www.facebook.com/profitslocal' },
    { label: 'Instagram', href: 'https://www.instagram.com/profitslocal' },
  ],
  footer: {
    text: 'Free website previews for local businesses.',
  },
};
