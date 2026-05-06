#!/usr/bin/env node

import assert from 'assert/strict';
import { buildRedesignPreservationPacket } from '../../core/redesign/preservation.js';

const googleSearchText = `
Rich & Rare Restaurant
4.8 3,194 Google reviews
> Rich & Rare Restaurant Brisbane [11]
> https://www.richandrare.com.au [11]
Lunch & Dinner Menu [12]
[12] https://www.richandrare.com.au/lunch-dinner
Contact [15]
The R&R Experience [16]
Address: 97 Boundary St, West End QLD 4101
Phone:(07) 3638 8888
Reservations: sevenrooms.com
`;

const baseInput = {
  clientSlug: 'rich-and-rare-restaurant',
  niche: 'restaurant',
  websiteUrl: 'https://www.richandrare.com.au',
  googleSearchText,
  content: {
    hero: { name: 'Rich & Rare Restaurant' },
    contact: {
      phone: '(07) 3638 8888',
      address: '97 Boundary St, West End QLD 4101',
      website: 'https://www.richandrare.com.au',
    },
    cta: {
      reserveUrl: 'https://www.sevenrooms.com/reservations/richandrarerestaurant',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=97%20Boundary%20St',
    },
    brand: {
      logo: 'https://images.squarespace-cdn.com/logo.png',
      colors: ['#101820', '#c7a76c'],
    },
    gallery: [{ url: 'https://images.squarespace-cdn.com/hero.jpg' }],
    menu: {
      sourceUrl: 'https://www.richandrare.com.au/menu',
      sections: [{ name: 'Menu', items: [{ name: 'Steak', sourceUrl: 'https://www.richandrare.com.au/menu' }] }],
    },
  },
};

const packet = buildRedesignPreservationPacket(baseInput);
const packetWithFirecrawlFavicon = buildRedesignPreservationPacket({
  ...baseInput,
  pages: [
    {
      url: 'https://www.richandrare.com.au/lunch-dinner',
      title: 'Lunch & Dinner Menu',
      pageType: 'menu',
      importance: 'must_keep',
      source: 'firecrawl',
      favicon: 'https://images.squarespace-cdn.com/favicon.ico?format=100w',
    },
  ],
});

assert.equal(packet.coreBusinessFacts.businessName, 'Rich & Rare Restaurant');
assert.equal(packet.coreBusinessFacts.phone, '(07) 3638 8888');
assert.ok(packet.currentSitemap.some((page) => page.pageType === 'home'));
assert.ok(packet.proposedSitemap.some((page) => page.url === '/menu/'));
assert.ok(packet.seoPlan.required.includes('Generate sitemap.xml.'));
assert.ok(packet.urlPreservation.redirects301.some((item) => item.from.includes('/lunch-dinner') && item.to === '/menu/'));
assert.ok(!packet.urlPreservation.redirects301.some((item) => item.from.includes('sevenrooms.com')));
assert.equal(packet.readiness.status, 'needs_customer_confirmation');
assert.ok(packet.readiness.warnings.includes('favicon missing or unconfirmed'));
assert.equal(packetWithFirecrawlFavicon.readiness.status, 'ready_for_redesign');
assert.equal(packetWithFirecrawlFavicon.brandAssets.favicon, 'https://images.squarespace-cdn.com/favicon.ico?format=100w');
assert.ok(!packetWithFirecrawlFavicon.readiness.warnings.includes('favicon missing or unconfirmed'));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    coreFactsExtracted: true,
    sitemapCreated: true,
    menuPreserved: true,
    seoPlanIncludesSitemap: true,
    internalRedirectsPlanned: true,
    externalBookingNotRedirected: true,
    faviconWarningBlocksBlindBuild: true,
    firecrawlFaviconClearsReadinessWarning: true,
  },
  statusWithoutFavicon: packet.readiness.status,
  statusWithFirecrawlFavicon: packetWithFirecrawlFavicon.readiness.status,
}, null, 2));
