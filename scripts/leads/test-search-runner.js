#!/usr/bin/env node

import assert from 'assert/strict';
import { buildLeadSearchRun } from '../../core/leads/search-runner.js';

const run = buildLeadSearchRun({
  query: 'restaurants in Brisbane',
  niche: 'restaurant',
  city: 'Brisbane',
  leads: [
    {
      place_id: 'no_site_1',
      name: 'No Site Bistro',
      address: '1 Test St, Brisbane',
      phone: '+61 7 3000 0000',
      website: '',
      google_maps_url: 'https://maps.google.com/?cid=1',
      rating: 4.8,
      review_count: 900,
      hours: ['Monday: 9 AM - 5 PM', 'Tuesday: 9 AM - 5 PM', 'Wednesday: 9 AM - 5 PM', 'Thursday: 9 AM - 5 PM', 'Friday: 9 AM - 5 PM'],
      photo_references: Array.from({ length: 8 }, (_, index) => `photo_${index}`),
    },
    {
      place_id: 'bad_site_1',
      name: 'Old Site Grill',
      address: '2 Test St, Brisbane',
      phone: '+61 7 3000 1111',
      website: 'https://oldsite.example',
      google_maps_url: 'https://maps.google.com/?cid=2',
      rating: 4.8,
      review_count: 1200,
      photo_references: ['photo_1', 'photo_2'],
    },
    {
      place_id: 'good_site_1',
      name: 'Good Site Dining',
      address: '3 Test St, Brisbane',
      phone: '+61 7 3000 2222',
      website: 'https://goodsite.example',
      google_maps_url: 'https://maps.google.com/?cid=3',
      rating: 4.4,
      review_count: 400,
      photo_references: ['photo_1'],
    },
    {
      place_id: 'no_contact_1',
      name: 'No Contact Cafe',
      address: '4 Test St, Brisbane',
      phone: '',
      website: '',
      google_maps_url: '',
      rating: 4.8,
      review_count: 900,
      photo_references: ['photo_1'],
    },
  ],
  websiteScansByPlaceId: {
    bad_site_1: {
      markdown: '# Old Site Grill\nCall us. Menu. Reserve now.',
      html: '<html><body>Powered by Squarespace <img src="/food.jpg"></body></html>',
      links: ['/menu', '/reserve'],
    },
    good_site_1: {
      markdown: '# Good Site Dining\n' + 'Modern dining. '.repeat(500) + 'Reserve. Menu. Contact.',
      html: '<html><body><img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg"> font-family: Inter;</body></html>',
      links: ['/menu', '/reserve', '/contact'],
    },
  },
});

assert.equal(run.totals.leads, 4);
assert.equal(run.totals.selected, 2);
assert.deepEqual(run.collectionQueue.map((item) => item.businessName), ['No Site Bistro', 'Old Site Grill']);
assert.ok(run.collectionQueue.every((item) => item.collectCommand.includes('extract:google-places')));
assert.ok(run.skipped.some((item) => item.businessName === 'Good Site Dining'));
assert.ok(run.skipped.some((item) => item.businessName === 'No Contact Cafe'));

console.log(JSON.stringify({
  ok: true,
  totals: run.totals,
  selected: run.collectionQueue.map((item) => ({
    businessName: item.businessName,
    qualification: item.qualification,
    recommendedAction: item.recommendedAction,
  })),
}, null, 2));
