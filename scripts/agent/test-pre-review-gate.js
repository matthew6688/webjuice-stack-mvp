#!/usr/bin/env node

import { validatePreReviewGate } from '../../core/agents/review-gate.js';

const passing = validatePreReviewGate({
  audit: {
    contextRead: {
      case: true,
      caseContext: true,
      evidence: true,
      content: true,
      design: true,
      brandSpec: true,
    },
    designProtocolUsed: {
      requiredSkill: 'huashu-design',
      openDesignSkills: ['web-prototype'],
    },
    qaScreenshots: ['artifacts/mobile.png'],
    devDeployUrl: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  },
});
const missingScreenshots = validatePreReviewGate({
  audit: {
    contextRead: {
      case: true,
      caseContext: true,
      evidence: true,
      content: true,
      design: true,
      brandSpec: true,
    },
    designProtocolUsed: {
      requiredSkill: 'huashu-design',
      openDesignSkills: ['web-prototype'],
    },
    qaScreenshots: [],
    devDeployUrl: 'https://opa-bar-mezze-restaurant-dev.pages.dev/',
  },
});
const missingContextAndDesign = validatePreReviewGate({
  audit: {
    contextRead: { case: true },
    designProtocolUsed: {},
    qaScreenshots: ['artifacts/mobile.png'],
  },
});

const assertions = {
  passingOk: passing.ok === true && passing.missing.length === 0,
  missingScreenshotsFails: missingScreenshots.ok === false && missingScreenshots.missing.includes('qaScreenshots'),
  missingContextFails: missingContextAndDesign.ok === false
    && missingContextAndDesign.missing.includes('contextRead.caseContext')
    && missingContextAndDesign.missing.includes('contextRead.evidence')
    && missingContextAndDesign.missing.includes('designProtocolUsed.requiredSkill')
    && missingContextAndDesign.missing.includes('devDeployUrl'),
};
const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  assertions,
  failed,
  examples: {
    passing,
    missingScreenshots,
    missingContextAndDesign,
  },
}, null, 2));

if (failed.length) process.exit(1);
