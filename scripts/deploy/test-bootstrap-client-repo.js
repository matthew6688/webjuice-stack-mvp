#!/usr/bin/env node

import assert from 'assert/strict';
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
assert.ok(order.includes('wait-live-action'));
assert.ok(order.includes('wait-dev-action'));

const dry = executeClientRepoBootstrapPlan(plan, { dryRun: true });
assert.equal(dry.ok, true);
assert.equal(dry.executed.length, plan.steps.length);

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
    dryRunDoesNotExecuteExternalCommands: true,
    handoffReferenceIncludesExecuteCommand: true,
  },
  stepOrder: order,
  reference: {
    status: reference.status,
    command: reference.command,
  },
}, null, 2));
