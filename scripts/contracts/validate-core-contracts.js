#!/usr/bin/env node

import fs from 'fs';
import assert from 'assert/strict';

const survey = readJson('docs/samples/website-survey.sample.json');
const qa = readJson('docs/samples/delivery-qa.sample.json');
const skill = fs.readFileSync('skills/profitslocal-collect/SKILL.md', 'utf8');
const todo = fs.readFileSync('docs/P0_P1_TODO.md', 'utf8');
const qaContract = fs.readFileSync('references/qa/delivery-qa-contract.md', 'utf8');

assert.equal(survey.schemaVersion, 1);
assert.equal(survey.targetProduct, 'website');
assert.equal(survey.readyToBuild.status, 'ready_to_build');
assert.equal(survey.readyToBuild.canBuild, true);
assert.ok(Array.isArray(survey.qaContract.mustVerify) && survey.qaContract.mustVerify.length >= 4);
assert.ok(survey.qaContract.mustNotInvent.includes('menu prices'));
assert.ok(/restaurant-niche-specific and optional/i.test(skill));
assert.ok(/Google Places is excellent for lead identity but usually incomplete/i.test(skill));
assert.ok(/Ready-to-Build Gate/.test(todo));

assert.equal(qa.schemaVersion, 1);
assert.equal(qa.readyForCustomerReview, true);
assert.equal(qa.checks.businessData.status, 'pass');
assert.equal(qa.checks.technical.status, 'pass');
assert.ok(qa.checks.customerCommunication.requiredLinks.approveUrl.startsWith('https://profitslocal.com/approve?'));
assert.ok(qa.checks.customerCommunication.requiredLinks.reviseUrl.startsWith('https://profitslocal.com/revision?'));
assert.ok(qa.checks.customerCommunication.requiredLinks.domainSetupUrl.startsWith('https://profitslocal.com/domain-setup?'));
assert.ok(/Delivery QA .*dev preview.*客户 review/s.test(qaContract));

const result = {
  ok: true,
  assertions: {
    surveyParses: true,
    surveyReadyToBuild: true,
    surveyHasQaContract: true,
    skillKeepsMenuRestaurantSpecific: true,
    skillDocumentsGooglePlacesLimits: true,
    qaSampleParses: true,
    qaAllowsCustomerReview: true,
    qaHasCustomerLinks: true,
    todoNamesReadyToBuildGate: true,
  },
};

console.log(JSON.stringify(result, null, 2));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
