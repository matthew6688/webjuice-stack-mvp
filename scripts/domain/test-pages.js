#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const setupPath = path.join(root, 'dist', 'domain-setup', 'index.html');
const helpPath = path.join(root, 'dist', 'domain-help', 'index.html');

assert.ok(fs.existsSync(setupPath), 'dist/domain-setup/index.html is missing');
assert.ok(fs.existsSync(helpPath), 'dist/domain-help/index.html is missing');

const setup = fs.readFileSync(setupPath, 'utf8');
const help = fs.readFileSync(helpPath, 'utf8');

const assertions = {
  setupHasProfitsLocalRoute: setup.includes('Free ProfitsLocal subdomain'),
  setupHasCustomerSubdomainRoute: setup.includes('My own subdomain'),
  setupHasRootRoute: setup.includes('My root domain'),
  setupHasSubmitSteps: setup.includes('What happens after you submit'),
  setupMentionsDnsAudit: setup.includes('We review DNS and business email risk first'),
  helpHasSubdomainExample: help.includes('menu.yourbusiness.com'),
  helpHasRootDomainCaution: help.includes('Check old site and business email first.'),
  helpHasCnameExample: help.includes('Target: your-pages-project.pages.dev'),
};

const failed = Object.entries(assertions)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

console.log(JSON.stringify({
  ok: failed.length === 0,
  assertions,
  failed,
  files: {
    setupPath,
    helpPath,
  },
}, null, 2));

if (failed.length) process.exit(1);
