#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profitslocal-init-project-'));

const output = execFileSync('node', [
  'scripts/ops/init-project.js',
  '--client', 'smoke-bistro',
  '--business-name', 'Smoke Bistro',
  '--source-url', 'https://example.com',
  '--repo', 'matthew6688/smoke-bistro',
  '--email', 'owner@example.com',
  '--root', root,
  '--id', 'project_init_smoke_001',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

const result = JSON.parse(output);
const casePath = path.join(root, result.casePath);
const bootstrapPath = path.join(root, result.bootstrapPath);
const caseFile = JSON.parse(fs.readFileSync(casePath, 'utf8'));
const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));

assert.equal(result.ok, true);
assert.equal(caseFile.status, 'project_initialized');
assert.equal(caseFile.openDesign.required, true);
assert.equal(caseFile.openDesign.status, 'not_created');
assert.ok(bootstrap.commands.runConcept.includes('npm run open-design:run-concept'));
assert.ok(bootstrap.requiredMilestones.includes('delivery_qa_pass'));
assert.ok(fs.existsSync(path.join(root, 'clients', 'smoke-bistro', 'concept', 'open-design')));

console.log(JSON.stringify({
  ok: true,
  root,
  casePath: result.casePath,
  bootstrapPath: result.bootstrapPath,
  assertions: {
    projectInitialized: true,
    openDesignRequired: true,
    initCreatesConceptDir: true,
    bootstrapContainsRunConcept: true,
    milestonesIncludeDeliveryQa: true,
  },
}, null, 2));
