#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  buildClientRepoBootstrapReference,
  buildClientRepoBootstrapPlan,
  executeClientRepoBootstrapPlan,
} from '../../core/deploy/client-repo-bootstrap.js';

const plan = buildClientRepoBootstrapPlan({
  repo: 'matthew6688/test-client',
  repoDir: '/tmp/test-client',
  pagesProjectName: 'test-client',
  waitForActions: true,
});

const order = plan.steps.map((step) => step.id);
assert.deepEqual(order.slice(0, 6), [
  'create-github-repo',
  'set-pages-project-variable',
  'set-cloudflare-api-token-secret',
  'set-cloudflare-account-secret',
  'create-pages-dev-project',
  'create-pages-live-project',
]);
assert.ok(order.indexOf('set-pages-project-variable') < order.indexOf('push-main'));
assert.ok(order.indexOf('set-cloudflare-api-token-secret') < order.indexOf('push-main'));
assert.ok(order.indexOf('create-pages-live-project') < order.indexOf('push-main'));
assert.ok(order.indexOf('push-main') < order.indexOf('push-dev'));
assert.ok(order.indexOf('ensure-dev-branch') < order.indexOf('create-dev-bootstrap-commit'));
assert.ok(order.indexOf('create-dev-bootstrap-commit') < order.indexOf('push-dev'));
assert.ok(order.indexOf('push-dev') < order.indexOf('ensure-dev-action-trigger'));
assert.ok(order.includes('wait-live-action'));
assert.ok(order.includes('wait-dev-action'));

const dry = executeClientRepoBootstrapPlan(plan, { dryRun: true });
assert.equal(dry.ok, true);
assert.equal(dry.executed.length, plan.steps.length);

const remoteRewriteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-origin-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: remoteRewriteDir, stdio: 'ignore' });
execFileSync('git', ['remote', 'add', 'origin', '/tmp/template-remote'], { cwd: remoteRewriteDir, stdio: 'ignore' });
const ensureOriginOnly = {
  ...plan,
  repo: 'matthew6688/test-client',
  repoDir: remoteRewriteDir,
  steps: [{ id: 'ensure-origin', command: ['git', 'remote', 'add', 'origin', 'https://github.com/matthew6688/test-client.git'], allowFailure: true }],
};
executeClientRepoBootstrapPlan(ensureOriginOnly, {
  dryRun: false,
  env: process.env,
  stdio: 'ignore',
});
const rewrittenOrigin = execFileSync('git', ['remote', 'get-url', 'origin'], {
  cwd: remoteRewriteDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();
assert.equal(rewrittenOrigin, 'https://github.com/matthew6688/test-client.git');

const reference = buildClientRepoBootstrapReference({
  repo: 'matthew6688/test-client',
  pagesProjectName: 'test-client',
});
assert.equal(reference.status, 'ready');
assert.ok(reference.command.includes('deploy:bootstrap-client-repo'));
assert.ok(reference.command.includes('--repo matthew6688/test-client'));
assert.ok(reference.command.includes('--execute true'));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    secretsAndVariablesBeforeFirstPush: true,
    pagesProjectsBeforeFirstPush: true,
    devPushAfterMainPush: true,
    devBootstrapCommitBeforeDevPush: true,
    devActionTriggerCheckAfterDevPush: true,
    dryRunDoesNotExecuteExternalCommands: true,
    existingOriginIsRewrittenToGitHubRepo: true,
    handoffReferenceIncludesExecuteCommand: true,
  },
  stepOrder: order,
  reference: {
    status: reference.status,
    command: reference.command,
  },
}, null, 2));
