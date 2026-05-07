#!/usr/bin/env node

import { execFileSync } from 'child_process';

const root = process.cwd();
const templateDir = process.env.WEBJUICE_RESTAURANT_DIR || '/Users/matthew/Developer/webjuice-restaurant';
const opaEnv = {
  ...process.env,
  WEBJUICE_CHECKOUT_PATH: `${root}/clients/opa-bar-mezze-restaurant/funnel/checkout.json`,
  WEBJUICE_CONTENT_PATH: `${root}/clients/opa-bar-mezze-restaurant/content.restaurant.json`,
  WEBJUICE_DESIGN_PATH: `${root}/clients/opa-bar-mezze-restaurant/design.restaurant.json`,
};

const steps = [
  {
    id: 'central-closure-fixture',
    cwd: root,
    command: 'npm',
    args: ['run', 'hermes:test-website-agent-closure'],
  },
  {
    id: 'approval-resolution',
    cwd: root,
    command: 'npm',
    args: ['run', 'agent:test-approval-resolution'],
  },
  {
    id: 'pre-review-gate',
    cwd: root,
    command: 'npm',
    args: ['run', 'agent:test-pre-review-gate'],
  },
  {
    id: 'template-build-opa-artifacts',
    cwd: templateDir,
    command: 'npm',
    args: ['run', 'build'],
    env: opaEnv,
  },
  {
    id: 'template-prepurchase-funnel-qa',
    cwd: root,
    command: 'npm',
    args: ['run', 'qa:funnel-pages', '--', '--dist-dir', `${templateDir}/dist`, '--client', 'Opa Bar & Mezze'],
  },
  {
    id: 'template-postpurchase-footer-qa',
    cwd: root,
    command: 'npm',
    args: ['run', 'qa:preview-sales-bar', '--', '--dist-dir', `${templateDir}/dist`],
  },
];

const results = [];
for (const step of steps) {
  const startedAt = new Date().toISOString();
  try {
    const output = execFileSync(step.command, step.args, {
      cwd: step.cwd,
      env: step.env || process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    results.push({
      id: step.id,
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      output: summarize(output),
    });
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`.trim();
    results.push({
      id: step.id,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      output: summarize(output),
    });
    break;
  }
}

const failed = results.filter((result) => !result.ok).map((result) => result.id);
console.log(JSON.stringify({
  ok: failed.length === 0,
  client: 'opa-bar-mezze-restaurant',
  mode: 'live-sim',
  writesRealCustomerData: false,
  writesRealRoiLedger: false,
  failed,
  results,
}, null, 2));

if (failed.length) process.exit(1);

function summarize(output) {
  const lines = String(output || '').trim().split('\n');
  return lines.slice(Math.max(lines.length - 24, 0)).join('\n');
}
