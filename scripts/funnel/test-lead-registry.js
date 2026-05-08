#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadLeadRegistry, resolveLeadByEmail } from '../../core/funnel/lead-registry.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-registry-'));
const previousCwd = process.cwd();
process.chdir(root);

try {
  seedAlpha();
  seedBetaAmbiguous();
  seedDeltaContentOnly();

  const registry = loadLeadRegistry({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });

  const alpha = registry.records.find((record) => record.clientSlug === 'alpha-steakhouse');
  assert.ok(alpha, 'expected alpha lead record');
  assert.equal(alpha.businessName, 'Alpha Steakhouse');
  assert.equal(alpha.address, '123 River St, Brisbane QLD 4000');
  assert.equal(alpha.phone, '+61 7 3000 1111');
  assert.equal(alpha.email, 'owner@alpha.example');
  assert.equal(alpha.websiteUrl, 'https://alpha.example/');
  assert.equal(alpha.googlePlaceId, '1234567890');
  assert.equal(alpha.menuUrl, 'https://alpha.example/menu');
  assert.equal(alpha.outreachStatus, 'follow_up_due');
  assert.equal(alpha.provider, 'agentic-email');
  assert.equal(alpha.externalThreadUrl, 'https://mail.profitslocal.com/thread/alpha-1');
  assert.equal(alpha.notes.length, 1);

  const unique = resolveLeadByEmail(registry, 'owner@alpha.example');
  assert.equal(unique.ok, true);
  assert.equal(unique.match?.clientSlug, 'alpha-steakhouse');

  const ambiguous = resolveLeadByEmail(registry, 'shared@example.com');
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.reason, 'ambiguous_email');
  assert.equal(ambiguous.candidates.length, 2);

  const delta = resolveLeadByEmail(registry, 'contact@delta.example');
  assert.equal(delta.ok, true);
  assert.equal(delta.match?.clientSlug, 'delta-kitchen');
  assert.equal(delta.match?.websiteUrl, 'https://delta.example/');

  console.log(JSON.stringify({
    ok: true,
    assertions: {
      total: registry.records.length,
      alphaLeadId: alpha.leadId,
      alphaOutreachStatus: alpha.outreachStatus,
      uniqueMatch: unique.match?.clientSlug,
      contentEmailMatch: delta.match?.clientSlug,
      ambiguousCount: ambiguous.candidates.length,
    },
  }, null, 2));
} finally {
  process.chdir(previousCwd);
}

function seedAlpha() {
  const clientSlug = 'alpha-steakhouse';
  const outreachDir = path.join('clients', clientSlug, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  const intakeDir = path.join('clients', clientSlug, 'intake');
  const evidenceDir = path.join('clients', clientSlug, 'evidence');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.mkdirSync(intakeDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    generatedAt: '2026-05-08T08:00:00.000Z',
    previewUrl: 'https://alpha-dev.pages.dev/',
    business: {
      name: 'Alpha Steakhouse',
      address: '123 River St, Brisbane QLD 4000',
    },
    qa: {
      links: {
        checked: [
          { label: 'map', value: 'https://maps.google.com/?cid=1234567890' },
          { label: 'menuSource', value: 'https://alpha.example/menu' },
        ],
      },
    },
    assets: {
      screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' },
      video: 'demo.mp4',
    },
    emailBrief: {
      proofPoints: ['menu checked', 'map checked'],
    },
  }), 'utf8');

  fs.writeFileSync(path.join(intakeDir, 'website-survey.json'), JSON.stringify({
    schemaVersion: 1,
    clientSlug,
    niche: 'restaurant',
    generatedAt: '2026-05-08T07:00:00.000Z',
    readiness: 'website_ready_to_build',
    readyToBuild: true,
    customerConfirmed: true,
    businessName: 'Alpha Steakhouse',
    contact: {
      phone: '+61 7 3000 1111',
      email: 'owner@alpha.example',
      address: '123 River St, Brisbane QLD 4000',
      website: 'https://alpha.example/',
    },
    offer: {
      menuSource: 'https://alpha.example/menu',
    },
    assets: {
      logo: 'https://alpha.example/logo.png',
    },
  }), 'utf8');

  fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify({
    sources: [
      { sourceType: 'google_places', sourceUrl: 'https://maps.google.com/?cid=1234567890' },
      { sourceType: 'official_site', sourceUrl: 'https://alpha.example/' },
    ],
  }), 'utf8');

  fs.writeFileSync(path.join(emailDir, '01-alpha.json'), JSON.stringify({
    to: 'owner@alpha.example',
    subject: 'Alpha preview',
    generatedAt: '2026-05-08T08:30:00.000Z',
    dryRun: false,
    sendResult: {
      status: 'sent',
      provider: 'agentic-email',
      sentAt: '2026-05-08T08:31:00.000Z',
      externalThreadUrl: 'https://mail.profitslocal.com/thread/alpha-1',
      nextFollowUpDue: '2026-05-10',
      externalLeadId: 'owner@alpha.example',
    },
  }), 'utf8');

  fs.writeFileSync(path.join(outreachDir, 'lead-notes.jsonl'), `${JSON.stringify({
    id: 'note-alpha',
    type: 'lead_note',
    actor: 'tester',
    note: 'Owner asked for a Friday follow-up.',
    nextFollowUpDue: '2026-05-10',
    createdAt: '2026-05-08T09:00:00.000Z',
  })}\n`, 'utf8');
}

function seedBetaAmbiguous() {
  for (const clientSlug of ['beta-bistro', 'gamma-grill']) {
    const outreachDir = path.join('clients', clientSlug, 'outreach');
    const emailDir = path.join(outreachDir, 'email');
    fs.mkdirSync(emailDir, { recursive: true });
    fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
      clientSlug,
      generatedAt: '2026-05-08T08:00:00.000Z',
      previewUrl: `https://${clientSlug}.pages.dev/`,
      business: { name: clientSlug },
      assets: {
        screenshots: { desktop: 'desktop.png', mobile: 'mobile.png' },
        video: 'demo.mp4',
      },
    }), 'utf8');
    fs.writeFileSync(path.join(emailDir, '01.json'), JSON.stringify({
      to: 'shared@example.com',
      subject: 'Shared email case',
      generatedAt: '2026-05-08T08:30:00.000Z',
      dryRun: true,
    }), 'utf8');
  }
}

function seedDeltaContentOnly() {
  const clientSlug = 'delta-kitchen';
  const clientDir = path.join('clients', clientSlug);
  const outreachDir = path.join(clientDir, 'outreach');
  const emailDir = path.join(outreachDir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });

  fs.writeFileSync(path.join(clientDir, 'content.restaurant.json'), JSON.stringify({
    clientSlug,
    business: { name: 'Delta Kitchen' },
    contact: {
      email: 'contact@delta.example',
      phone: '+61 7 3222 3333',
      address: '77 Queen St, Brisbane QLD 4000',
      website: 'https://delta.example/',
    },
  }), 'utf8');

  fs.writeFileSync(path.join(outreachDir, 'outreach-pack.json'), JSON.stringify({
    clientSlug,
    generatedAt: '2026-05-08T08:00:00.000Z',
    previewUrl: 'https://delta.pages.dev/',
    business: { name: 'Delta Kitchen' },
  }), 'utf8');

  fs.writeFileSync(path.join(emailDir, '01-delta.json'), JSON.stringify({
    to: 'matthew6688@gmail.com',
    subject: 'Delta preview',
    generatedAt: '2026-05-08T08:30:00.000Z',
    dryRun: true,
  }), 'utf8');
}
