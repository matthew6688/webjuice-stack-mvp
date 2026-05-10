#!/usr/bin/env node

import assert from 'assert/strict';
import {
  buildDocumentGenerationPrompt,
  buildDocumentModelComparisonInput,
  evaluateDocumentOutput,
  parseModelJson,
} from '../../core/leads/document-model-comparison.js';

const input = buildDocumentModelComparisonInput();
const prompt = buildDocumentGenerationPrompt(input);
assert.match(prompt, /Return JSON only/);
assert.match(prompt, /Do not invent an email/);
assert.match(prompt, /0424 371 622/);

const good = {
  discoveryReport: {
    businessIdentity: 'Roofing & Restoration is a roofing lead from a sign/photo.',
    contactPaths: ['Call 0424 371 622'],
    services: ['roof restorations', 'repairs', 'gutters'],
    currentPresence: 'No verified website, email, address, or real review evidence is present.',
    opportunityDiagnosis: 'A phone-first page can make the quote path clear.',
    recommendedAngle: 'Free in-person inspection and quote.',
    evidenceUsed: ['operator image/text', 'verified phone', 'visible services'],
    missingEvidence: ['website', 'email', 'address', 'Google reviews'],
  },
  gapScore: {
    total: 74,
    conversion: 20,
    localSeo: 12,
    designTrust: 18,
    content: 24,
    rationale: 'Clear phone and services, weak online proof.',
  },
  websiteProductionSpec: {
    pageMode: 'one_page_preview',
    templateDirection: 'phone-first roofing page',
    blockPlan: [
      { id: 'hero' },
      { id: 'services' },
      { id: 'trust' },
      { id: 'process' },
      { id: 'faq' },
      { id: 'contact' },
    ],
    assetPlan: [
      { slot: 'hero' },
      { slot: 'service' },
      { slot: 'proof' },
    ],
    contactPlan: { primaryPhone: '0424 371 622' },
    seoPlan: { title: 'Roof restoration and repairs' },
    factLock: {
      mustKeep: ['Roofing & Restoration', '0424 371 622'],
      mustNotClaim: ['email', 'address', 'website URL', 'real reviews', 'licence', 'award', 'rating'],
    },
  },
  copyBrief: {
    heroHeadline: 'Roof restorations and repairs made easy to quote',
    heroSubcopy: 'Call Greg on 0424 371 622 for a free inspection.',
    primaryCta: 'Call 0424 371 622',
    serviceCopy: [
      { service: 'roof restorations', copy: 'Explain restoration clearly.' },
      { service: 'repairs', copy: 'Explain repairs clearly.' },
      { service: 'gutters', copy: 'Explain gutters clearly.' },
    ],
    faq: ['Can I request an inspection?', 'What should I send?', 'Can gutters be discussed?'],
    outreachHook: 'I saw the sign but could not verify a matching website.',
  },
  riskNotes: ['Do not fabricate email, address, reviews, licences, or warranty claims.'],
};

const goodResult = evaluateDocumentOutput(JSON.stringify(good), input);
assert.equal(goodResult.ok, true);
assert.equal(goodResult.grade, 'A');
assert.equal(goodResult.metrics.blockCount, 6);

const bad = JSON.stringify({
  ...good,
  websiteProductionSpec: {
    ...good.websiteProductionSpec,
    factLock: { mustKeep: ['Roofing & Restoration'], mustNotClaim: [] },
  },
  copyBrief: {
    ...good.copyBrief,
    primaryCta: 'Email hello@roofingrestoration.example',
  },
});
const badResult = evaluateDocumentOutput(`<think>Need to invent details</think>${bad}`, input);
assert.equal(badResult.ok, false);
assert.equal(badResult.grade, 'F');
assert.ok(badResult.findings.some((item) => item.code === 'reasoning_leak'));
assert.ok(badResult.findings.some((item) => item.code === 'invented_email'));

assert.equal(parseModelJson('```json\n{"ok":true}\n```').ok, true);
assert.equal(parseModelJson('prefix {"ok":true} suffix').ok, true);
assert.equal(parseModelJson('not json').ok, false);

console.log(JSON.stringify({
  ok: true,
  goodScore: goodResult.score,
  badScore: badResult.score,
  promptChars: prompt.length,
}, null, 2));
