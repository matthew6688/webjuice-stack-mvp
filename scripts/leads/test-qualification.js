#!/usr/bin/env node

import assert from 'assert/strict';
import { qualifyLead } from '../../core/leads/qualification.js';

const noWebsite = qualifyLead({
  lead: {
    name: 'No Site Bistro',
    address: '1 Test St, Brisbane',
    phone: '+61 7 3000 0000',
    website: '',
    google_maps_url: 'https://maps.google.com/?cid=1',
    rating: 4.7,
    review_count: 900,
    hours: ['Monday: 9 AM - 5 PM', 'Tuesday: 9 AM - 5 PM', 'Wednesday: 9 AM - 5 PM', 'Thursday: 9 AM - 5 PM', 'Friday: 9 AM - 5 PM'],
    photo_references: Array.from({ length: 8 }, (_, index) => `photo_${index}`),
    niche: 'restaurant',
  },
});

const badWebsite = qualifyLead({
  lead: {
    name: 'Old Site Grill',
    address: '2 Test St, Brisbane',
    phone: '+61 7 3000 1111',
    website: 'https://oldsite.example',
    google_maps_url: 'https://maps.google.com/?cid=2',
    rating: 4.8,
    review_count: 1200,
    photo_references: ['photo_1', 'photo_2'],
    niche: 'restaurant',
  },
  websiteScan: {
    markdown: '# Old Site Grill\nCall us. Menu. Reserve now.',
    html: '<html><body>Powered by Squarespace <img src="/food.jpg"></body></html>',
    links: ['/menu', '/reserve'],
    metadata: { title: 'Old Site Grill' },
  },
});

const goodWebsite = qualifyLead({
  lead: {
    name: 'Good Site Dining',
    address: '3 Test St, Brisbane',
    phone: '+61 7 3000 2222',
    website: 'https://goodsite.example',
    google_maps_url: 'https://maps.google.com/?cid=3',
    rating: 4.4,
    review_count: 400,
    photo_references: ['photo_1'],
    niche: 'restaurant',
  },
  websiteScan: {
    markdown: '# Good Site Dining\n' + 'Modern dining. '.repeat(500) + 'Reserve. Menu. Contact.',
    html: '<html><body><img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg"> font-family: Inter;</body></html>',
    links: ['/menu', '/reserve', '/contact'],
    metadata: { title: 'Good Site Dining', description: 'Modern dining.' },
  },
});

assert.equal(noWebsite.leadType, 'no_website');
assert.equal(noWebsite.qualification, 'A');
assert.equal(noWebsite.recommendedAction, 'build_starter_preview');

assert.equal(badWebsite.leadType, 'bad_website');
assert.equal(badWebsite.qualification, 'A');
assert.equal(badWebsite.recommendedAction, 'build_redesign_preview');

assert.equal(goodWebsite.leadType, 'good_website');
assert.ok(['C', 'D'].includes(goodWebsite.qualification));
assert.ok(['outreach_only', 'skip'].includes(goodWebsite.recommendedAction));

const result = {
  ok: true,
  assertions: {
    noWebsiteBuildStarter: true,
    badWebsiteBuildRedesign: true,
    goodWebsiteNotAutoBuild: true,
  },
  examples: {
    noWebsite: pick(noWebsite),
    badWebsite: pick(badWebsite),
    goodWebsite: pick(goodWebsite),
  },
};

console.log(JSON.stringify(result, null, 2));

function pick(result) {
  return {
    leadType: result.leadType,
    qualification: result.qualification,
    recommendedAction: result.recommendedAction,
    weightedScore: result.weightedScore,
    scores: result.scores,
  };
}
