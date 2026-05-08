#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-ops-scenarios-'));
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const previousCwd = process.cwd();
process.chdir(tmp);

try {
  const scenarios = [
    {
      id: 'starter-clinic-google',
      input: {
        clientSlug: 'riverfront-dental',
        sourceType: 'google_places',
        businessName: 'Riverfront Dental',
        industry: 'dental clinic',
        city: 'Brisbane',
        phone: '+61 7 3000 1111',
        googleMapsUrl: 'https://maps.google.com/?cid=riverfront',
        observations: ['Strong Google profile but no clear website path yet.'],
        services: ['checkups', 'cosmetic dentistry'],
      },
      expect: {
        familyId: 'clinic',
        buildMode: 'starter',
        gateStatus: 'ready_for_preview',
        outreachChannel: 'call',
      },
    },
    {
      id: 'redesign-field-service',
      input: {
        clientSlug: 'northside-roofing',
        sourceType: 'manual',
        businessName: 'Northside Roofing',
        industry: 'roofing',
        city: 'Brisbane',
        email: 'hello@northside.example',
        websiteUrl: 'https://northside.example',
        observations: ['The current site hides the quote path on mobile.'],
        services: ['roof repairs', 'roof replacement'],
      },
      expect: {
        familyId: 'field_service',
        buildMode: 'redesign',
        redesignDecision: 'redesign_preview',
        outreachChannel: 'email',
      },
    },
    {
      id: 'social-only-salon',
      input: {
        clientSlug: 'soft-signal-salon',
        sourceType: 'manual',
        businessName: 'Soft Signal Salon',
        industry: 'salon',
        instagramUrl: 'https://instagram.com/softsignal',
        observations: ['Only Instagram presence is visible.'],
        services: ['colour', 'cut'],
      },
      expect: {
        familyId: 'studio_or_visual',
        contactability: 'reachable',
        outreachChannel: 'instagram_dm',
      },
    },
    {
      id: 'professional-redesign',
      input: {
        clientSlug: 'crown-legal',
        sourceType: 'manual',
        businessName: 'Crown Legal',
        industry: 'law firm',
        city: 'Brisbane',
        email: 'hello@crownlegal.example',
        websiteUrl: 'https://crownlegal.example',
        observations: ['The practice areas are buried and the consultation step is weak.'],
        services: ['family law', 'property law'],
      },
      expect: {
        familyId: 'professional_service',
        redesignDecision: 'redesign_preview',
        outreachChannel: 'email',
      },
    },
    {
      id: 'venue-contact-form-only',
      input: {
        clientSlug: 'harbour-event-house',
        sourceType: 'manual',
        businessName: 'Harbour Event House',
        industry: 'event venue',
        city: 'Brisbane',
        websiteUrl: 'https://harbourevents.example',
        contactPageUrl: 'https://harbourevents.example/contact',
        observations: ['The venue is attractive but the enquiry path is buried.'],
        services: ['weddings', 'corporate events'],
      },
      expect: {
        familyId: 'venue',
        contactability: 'reachable',
        outreachChannel: 'manual_review',
      },
    },
    {
      id: 'imported-unreachable',
      input: {
        clientSlug: 'mystery-fence-co',
        sourceType: 'imported_list',
        businessName: 'Mystery Fence Co',
        industry: 'fence installer',
      },
      expect: {
        familyId: 'field_service',
        gateStatus: 'blocked_unreachable',
        readyToBuildStatus: 'blocked_unreachable',
      },
    },
    {
      id: 'provider-reply-teaser',
      input: {
        clientSlug: 'hello-plumber',
        sourceType: 'provider_reply',
        businessName: 'Hello Plumber',
        industry: 'plumber',
        email: 'owner@helloplumber.example',
        observations: ['The owner replied, but there is still no verified website or service area.'],
      },
      expect: {
        familyId: 'field_service',
        buildMode: 'teaser',
        outreachChannel: 'email',
      },
    },
  ];

  const outputs = [];
  for (const scenario of scenarios) {
    const result = runLeadOps(scenario.input);
    const outDir = path.join('scenario-output', scenario.id);
    const paths = saveLeadOpsArtifacts(result, {
      intake: path.join(outDir, 'lead-intake.json'),
      research: path.join(outDir, 'lead-research.json'),
      redesignCheck: path.join(outDir, 'redesign-check.json'),
      readyToBuild: path.join(outDir, 'ready-to-build.json'),
      outreachBrief: path.join(outDir, 'outreach-brief.json'),
      leadOps: path.join(outDir, 'lead-ops.json'),
    });

    if (scenario.expect.familyId) assert.equal(result.summary.familyId, scenario.expect.familyId, scenario.id);
    if (scenario.expect.buildMode) assert.equal(result.buildMode, scenario.expect.buildMode, scenario.id);
    if (scenario.expect.gateStatus) assert.equal(result.gateStatus, scenario.expect.gateStatus, scenario.id);
    if (scenario.expect.contactability) assert.equal(result.research.contactability.status, scenario.expect.contactability, scenario.id);
    if (scenario.expect.redesignDecision) assert.equal(result.redesignCheck.decision, scenario.expect.redesignDecision, scenario.id);
    if (scenario.expect.readyToBuildStatus) assert.equal(result.readyToBuild.status, scenario.expect.readyToBuildStatus, scenario.id);
    if (scenario.expect.outreachChannel) assert.equal(result.outreachBrief.channelRecommendation, scenario.expect.outreachChannel, scenario.id);

    outputs.push({
      id: scenario.id,
      summary: result.summary,
      paths,
    });
  }

  const summaryDir = path.join(repoRoot, 'data', 'qa', 'lead-ops-scenarios');
  fs.mkdirSync(summaryDir, { recursive: true });
  fs.writeFileSync(
    path.join(summaryDir, 'summary.json'),
    `${JSON.stringify({ ok: true, scenarios: outputs }, null, 2)}\n`
  );

  console.log(JSON.stringify({
    ok: true,
    scenarioCount: outputs.length,
    summaryPath: 'data/qa/lead-ops-scenarios/summary.json',
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
