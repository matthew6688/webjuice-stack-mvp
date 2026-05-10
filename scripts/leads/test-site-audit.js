#!/usr/bin/env node

import assert from 'assert/strict';
import { createSiteAudit, renderSiteAuditMarkdown, sanitizeHtmlSnapshot } from '../../core/leads/site-audit.js';

const record = {
  clientSlug: 'fixture-roofer',
  company: 'Fixture Roof Repairs',
  websiteUrl: 'https://example.com',
  phone: '0480 855 390',
  email: 'hello@example.com',
  niche: 'roof repairs',
  city: 'Brisbane',
  leadCoreServices: ['roof repairs', 'roof replacement', 'guttering'],
};

const weakFacts = {
  title: 'Fixture Roof Repairs',
  text: 'Welcome. We do roofs. Contact us.',
  headings: ['Welcome'],
  links: [
    { text: 'Home', href: 'https://example.com/' },
    { text: 'Contact', href: 'https://example.com/contact' },
  ],
  contactPageCandidates: ['https://example.com/contact'],
  socialLinks: [],
  sameAs: [],
  images: [
    { src: 'https://example.com/roof.jpg' },
    { src: 'https://example.com/team.jpg', alt: '' },
  ],
  seo: {
    title: 'Fixture Roof Repairs',
    metaDescription: '',
    canonical: '',
    h1s: ['Welcome'],
    jsonLdTypes: [],
    og: {},
    twitter: {},
  },
};

const audit = createSiteAudit({
  record,
  facts: weakFacts,
  artifacts: {
    desktopPath: 'clients/fixture-roofer/audit/current-site-desktop.png',
    mobilePath: 'clients/fixture-roofer/audit/current-site-mobile.png',
    htmlPath: 'clients/fixture-roofer/audit/current-site.html',
    textPath: 'clients/fixture-roofer/audit/current-site-text.txt',
  },
});

assert.equal(audit.schemaVersion, 2);
assert.match(audit.verdict, /redesign_opportunity/);
assert.equal(audit.salesDecision, 'build_mockup');
assert.equal(audit.opportunityConfidence, 'high');
assert.ok(audit.findings.some((finding) => finding.category === 'seo' && finding.title === 'Meta description is missing'));
assert.ok(audit.findings.some((finding) => finding.category === 'conversion'));
assert.ok(audit.findings.some((finding) => finding.category === 'trust'));
assert.ok(audit.improvements.length >= 3);
assert.ok(audit.outreachHook.includes('I noticed'));
assert.ok(audit.openDesignDirection.includes('Fixture Roof Repairs'));

const markdown = renderSiteAuditMarkdown(audit);
assert.match(markdown, /## SEO Snapshot/);
assert.match(markdown, /## Outreach Hook/);
assert.match(markdown, /Meta description is missing/);
assert.match(markdown, /Sales decision: build_mockup/);

const strongFacts = {
  title: 'Fixture Roof Repairs | Brisbane Roof Repairs',
  text: [
    'Fixture Roof Repairs Brisbane roof repairs roof replacement guttering.',
    'Call 0480 855 390 or email hello@example.com for a roof inspection.',
    'Roof repairs roof replacement guttering service area Brisbane.',
    'Reviews, warranty, family local team, licensed and insured roofers.',
    ...Array.from({ length: 24 }, () => 'Our Brisbane roof repair team explains the issue, shows practical repair options, protects gutters and tiles, and keeps the quote path simple for homeowners.'),
  ].join(' '),
  headings: ['Brisbane Roof Repairs', 'Services', 'Reviews'],
  links: [
    { text: 'Contact', href: 'https://example.com/contact' },
    { text: 'Call', href: 'tel:0480855390' },
    { text: 'Services', href: 'https://example.com/services' },
    { text: 'Privacy', href: 'https://example.com/privacy' },
  ],
  contactPageCandidates: ['https://example.com/contact'],
  socialLinks: ['https://www.facebook.com/fixture'],
  sameAs: [],
  images: [
    { src: 'https://example.com/job.jpg', alt: 'Roof repair job in Brisbane' },
    { src: 'https://example.com/team.jpg', alt: 'Fixture Roof Repairs team' },
  ],
  seo: {
    title: 'Fixture Roof Repairs | Brisbane Roof Repairs',
    metaDescription: 'Fixture Roof Repairs handles roof repairs and guttering across Brisbane. Call for a roof inspection and practical quote.',
    canonical: 'https://example.com/',
    h1s: ['Brisbane Roof Repairs'],
    jsonLdTypes: ['RoofingContractor'],
    og: { title: 'Fixture Roof Repairs', description: 'Roof repairs in Brisbane', image: 'https://example.com/og.jpg' },
    twitter: { card: 'summary_large_image' },
  },
};

const lowOpportunityAudit = createSiteAudit({ record, facts: strongFacts });
assert.equal(lowOpportunityAudit.verdict, 'weak_redesign_opportunity');
assert.equal(lowOpportunityAudit.salesDecision, 'skip_or_monitor');
assert.equal(lowOpportunityAudit.opportunityConfidence, 'low');
assert.match(lowOpportunityAudit.outreachHook, /No strong outreach hook/);
assert.match(lowOpportunityAudit.openDesignDirection, /Do not create a redesign mockup/);

const middleFacts = {
  ...strongFacts,
  text: [
    'Fixture Roof Repairs Brisbane roof repairs.',
    'Call 0480 855 390 or email hello@example.com for a quote.',
    'Reviews, warranty, family local team, licensed and insured roofers.',
    ...Array.from({ length: 24 }, () => 'Our Brisbane roofing team keeps the quote path simple and explains practical repair options for homeowners.'),
  ].join(' '),
  headings: ['Brisbane Roof Repairs'],
  images: [
    { src: 'https://example.com/job.jpg' },
    { src: 'https://example.com/team.jpg', alt: '' },
  ],
};
const middleAudit = createSiteAudit({ record, facts: middleFacts });
assert.ok(middleAudit.score >= 60 && middleAudit.score <= 80);
assert.equal(middleAudit.verdict, 'moderate_redesign_opportunity');
assert.equal(middleAudit.salesDecision, 'human_review');

const dirtyHtml = `
<script>
rtCommonProps["common.mapbox.token"] = 'pk.eyJ1Ijoiabc.def';
rtCommonProps["common.here.appId"] = 'secret-id';
rtCommonProps["common.here.appCode"] = 'secret-code';
</script>`;
const cleanHtml = sanitizeHtmlSnapshot(dirtyHtml);
assert.doesNotMatch(cleanHtml, /pk\.eyJ/);
assert.doesNotMatch(cleanHtml, /secret-id|secret-code/);
assert.match(cleanHtml, /REDACTED_MAPBOX_PUBLIC_TOKEN/);

console.log(JSON.stringify({
  ok: true,
  verdict: audit.verdict,
  score: audit.score,
  findingCount: audit.findings.length,
  seoFindingCount: audit.findings.filter((finding) => finding.category === 'seo').length,
}, null, 2));
