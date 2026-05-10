#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import { runLeadOps, saveLeadOpsArtifacts } from '../../core/leads/lead-ops.js';
import { createEvidencePack, addEvidenceItem, saveEvidencePack } from '../../core/evidence/evidence.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-ops-low-info-'));
const previousCwd = process.cwd();
process.chdir(tmp);

try {
  const scenarios = [
    {
      id: 'google-places-only-dental',
      description: 'A sparse Google Maps-style lead becomes contactable after Google Places enrichment.',
      input: {
        clientSlug: 'low-info-dental-google',
        sourceType: 'google_places',
        businessName: 'Low Info Dental',
        industry: 'dental practice',
        city: 'Brisbane',
        phone: '+61 7 3000 2001',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Low%20Info%20Dental',
        observations: ['Google listing has reviews but the website path is thin.'],
        services: ['general dentistry'],
      },
      evidence: [
        item('identity.name', 'Low Info Dental', 'google_places', 0.95),
        item('business.niche', 'dental practice', 'google_places', 0.85),
        item('business.city', 'Brisbane', 'google_places', 0.85),
        item('contact.phone', '+61 7 3000 2001', 'google_places', 0.9),
        item('contact.address', '20 Queen St, Brisbane QLD', 'google_places', 0.9),
        item('cta.map', 'https://www.google.com/maps/search/?api=1&query=Low%20Info%20Dental', 'google_places', 0.9),
      ],
      expect: {
        sources: ['google_places'],
        familyId: 'clinic',
        contactability: 'reachable',
        blocked: false,
      },
    },
    {
      id: 'official-site-redesign-roofer',
      description: 'A website URL plus official-site scrape/search text creates a redesign preservation packet.',
      input: {
        clientSlug: 'low-info-roofer-site',
        sourceType: 'manual',
        businessName: 'Low Info Roofing',
        industry: 'roofing',
        city: 'Brisbane',
        websiteUrl: 'https://lowinforoofing.example',
        contactPageUrl: 'https://lowinforoofing.example/contact',
        email: 'quotes@lowinforoofing.example',
        observations: ['The current website hides the quote path and has weak service hierarchy.'],
        services: ['roof repairs', 'roof replacement'],
        googleSearchPath: path.join('clients', 'low-info-roofer-site', 'redesign', 'search.txt'),
      },
      files: {
        [path.join('clients', 'low-info-roofer-site', 'redesign', 'search.txt')]: [
          'Low Info Roofing',
          'Address: Brisbane service area',
          'Phone: +61 7 3000 2002',
          'quotes@lowinforoofing.example',
          '> Services [1]',
          '> https://lowinforoofing.example/services',
          '> Contact [2]',
          '> https://lowinforoofing.example/contact',
          '[1] https://lowinforoofing.example/services',
          '[2] https://lowinforoofing.example/contact',
        ].join('\n'),
        [path.join('clients', 'low-info-roofer-site', 'redesign', 'pages.json')]: JSON.stringify([
          { url: 'https://lowinforoofing.example', title: 'Low Info Roofing', pageType: 'home', importance: 'must_keep', favicon: 'https://lowinforoofing.example/favicon.ico' },
          { url: 'https://lowinforoofing.example/services', title: 'Roof Repairs and Replacement', pageType: 'service', importance: 'must_keep' },
          { url: 'https://lowinforoofing.example/contact', title: 'Contact', pageType: 'contact', importance: 'must_keep' },
        ], null, 2),
      },
      evidence: [
        item('identity.name', 'Low Info Roofing', 'official_site', 0.95, 'https://lowinforoofing.example'),
        item('business.niche', 'roofing', 'official_site', 0.9, 'https://lowinforoofing.example/services'),
        item('contact.email', 'quotes@lowinforoofing.example', 'official_site', 0.9, 'https://lowinforoofing.example/contact'),
        item('contact.phoneFromWebsite', '+61 7 3000 2002', 'official_site', 0.85, 'https://lowinforoofing.example/contact'),
      ],
      expect: {
        sources: ['official_site'],
        familyId: 'field_service',
        buildMode: 'redesign',
        contactability: 'reachable',
        currentPageMin: 3,
        readyToBuildStatus: 'ready_for_open_design',
        blocked: false,
      },
    },
    {
      id: 'pdf-image-ocr-event-venue',
      description: 'A venue with PDF and image OCR evidence can become a teaser/preview candidate with filled placeholders.',
      input: {
        clientSlug: 'low-info-venue-ocr',
        sourceType: 'manual',
        businessName: 'Light Hall Events',
        industry: 'event venue',
        city: 'Brisbane',
        phone: '+61 7 3000 2003',
        instagramUrl: 'https://instagram.com/lighthallevents',
        observations: ['A function-pack PDF and a flyer image mention weddings and corporate events.'],
        services: ['weddings', 'corporate events'],
      },
      evidence: [
        item('identity.name', 'Light Hall Events', 'pdf', 0.88, 'fixture://light-hall-functions.pdf'),
        item('business.niche', 'event venue', 'pdf', 0.82, 'fixture://light-hall-functions.pdf'),
        item('contact.phone', '+61 7 3000 2003', 'image_ocr', 0.82, 'fixture://light-hall-flyer.png'),
        item('business.city', 'Brisbane', 'image_ocr', 0.78, 'fixture://light-hall-flyer.png'),
      ],
      expect: {
        sources: ['pdf', 'image_ocr'],
        familyId: 'venue',
        contactability: 'reachable',
        blocked: false,
      },
    },
    {
      id: 'generated-placeholder-contact-blocked',
      description: 'AI/dummy placeholder contact facts must not make an otherwise unreachable lead contactable.',
      input: {
        clientSlug: 'low-info-generated-only',
        sourceType: 'manual',
        businessName: 'Generated Only Plumbing',
        industry: 'plumber',
        observations: ['Only the business name and industry were found.'],
      },
      evidence: [
        item('identity.name', 'Generated Only Plumbing', 'generated', 0.55),
        item('business.niche', 'plumber', 'generated', 0.55),
        item('contact.email', 'hello@generatedonly.example', 'generated', 0.55),
        item('contact.phone', '+61 7 3000 9999', 'generated', 0.55),
      ],
      expect: {
        sources: ['generated'],
        familyId: 'field_service',
        contactability: 'unreachable',
        readyToBuildStatus: 'blocked_unreachable',
        blocked: true,
      },
    },
    {
      id: 'manual-name-only-blocked',
      description: 'A business-name-only manual lead remains blocked until a real contact path is found.',
      input: {
        clientSlug: 'low-info-name-only',
        sourceType: 'manual',
        businessName: 'Name Only Landscapes',
        industry: 'landscaper',
      },
      evidence: [],
      expect: {
        sources: [],
        familyId: 'field_service',
        contactability: 'unreachable',
        readyToBuildStatus: 'blocked_unreachable',
        blocked: true,
      },
    },
  ];

  const outputs = [];
  for (const scenario of scenarios) {
    writeFiles(scenario.files || {});
    writeEvidence(scenario.input.clientSlug, scenario.input.industry, scenario.input.businessName, scenario.evidence);

    const result = runLeadOps(scenario.input);
    const paths = saveLeadOpsArtifacts(result, {
      intake: path.join('low-info-output', scenario.id, 'lead-intake.json'),
      research: path.join('low-info-output', scenario.id, 'lead-research.json'),
      redesignCheck: path.join('low-info-output', scenario.id, 'redesign-check.json'),
      readyToBuild: path.join('low-info-output', scenario.id, 'ready-to-build.json'),
      outreachBrief: path.join('low-info-output', scenario.id, 'outreach-brief.json'),
      leadOps: path.join('low-info-output', scenario.id, 'lead-ops.json'),
    });

    assert.equal(result.summary.familyId, scenario.expect.familyId, scenario.id);
    assert.equal(result.research.contactability.status, scenario.expect.contactability, scenario.id);
    if (scenario.expect.buildMode) assert.equal(result.buildMode, scenario.expect.buildMode, scenario.id);
    if (scenario.expect.readyToBuildStatus) assert.equal(result.readyToBuild.status, scenario.expect.readyToBuildStatus, scenario.id);
    if (scenario.expect.currentPageMin) {
      assert.ok(result.research.redesign.currentPageCount >= scenario.expect.currentPageMin, scenario.id);
    }
    for (const source of scenario.expect.sources) {
      assert.ok(result.research.researchSummary.evidenceSources.includes(source), `${scenario.id}: missing ${source}`);
    }
    if (scenario.expect.blocked) {
      assert.equal(result.research.previewability.status, 'blocked_unreachable', scenario.id);
      assert.equal(result.outreachBrief.outreachReady, false, scenario.id);
      assert.equal(result.readyToBuild.aiConclusion.result, 'skip', `${scenario.id}: blocked low-info lead should skip`);
    } else {
      assert.notEqual(result.research.previewability.status, 'blocked_unreachable', scenario.id);
      assert.equal(result.outreachBrief.outreachReady, true, scenario.id);
      assert.equal(result.readyToBuild.aiConclusion.result, 'ready_for_mockup', `${scenario.id}: reachable low-info lead should produce mockup-ready conclusion`);
      assert.ok(result.readyToBuild.websiteBuildHandoff.openDesignPayload.prompt.includes('Resend transactional email flow'), `${scenario.id}: expected contact form/Resend handoff`);
      assert.ok(result.readyToBuild.websiteBuildHandoff.openDesignPayload.prompt.includes('Do not ask follow-up questions'), `${scenario.id}: expected no-question Open Design handoff`);
      assert.ok(result.readyToBuild.websiteBuildHandoff.openDesignPayload.prompt.includes('Questionnaire answers'), `${scenario.id}: expected AI-filled questionnaire handoff`);
      assert.ok(result.readyToBuild.websiteBuildHandoff.content.services.length >= 3, `${scenario.id}: expected AI-completed service content`);
    }

    outputs.push({
      id: scenario.id,
      description: scenario.description,
      summary: result.summary,
      contactability: result.research.contactability,
      previewability: result.research.previewability,
      productionReadiness: result.research.productionReadiness,
      evidenceSources: result.research.researchSummary.evidenceSources,
      redesign: result.research.redesign,
      paths,
      aiConclusion: result.readyToBuild.aiConclusion,
      websitePlanType: result.readyToBuild.websiteBuildHandoff.websitePlan.type,
    });
  }

  const summaryDir = path.join(repoRoot, 'data', 'qa', 'lead-ops-low-info');
  fs.mkdirSync(summaryDir, { recursive: true });
  fs.writeFileSync(
    path.join(summaryDir, 'summary.json'),
    `${JSON.stringify({ ok: true, scenarioCount: outputs.length, scenarios: outputs }, null, 2)}\n`
  );

  console.log(JSON.stringify({
    ok: true,
    scenarioCount: outputs.length,
    summaryPath: 'data/qa/lead-ops-low-info/summary.json',
    scenarios: outputs.map((output) => ({
      id: output.id,
      previewability: output.previewability.status,
      contactability: output.contactability.status,
      evidenceSources: output.evidenceSources,
    })),
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function item(key, value, sourceType, confidence, sourceUrl = `fixture://${sourceType}`) {
  return { key, value, sourceType, confidence, sourceUrl, extractor: `${sourceType}_fixture` };
}

function writeEvidence(clientSlug, niche, businessName, evidenceItems) {
  const pack = createEvidencePack({ clientSlug, niche, businessName });
  for (const evidenceItem of evidenceItems) addEvidenceItem(pack, evidenceItem);
  saveEvidencePack(pack, path.join('clients', clientSlug, 'evidence', 'evidence.json'));
}

function writeFiles(files) {
  for (const [filePath, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${content}\n`);
  }
}
