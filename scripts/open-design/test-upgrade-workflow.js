#!/usr/bin/env node

import assert from 'assert/strict';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(process.cwd());
const openDesignRoot = '/Users/matthew/Developer/open-design';

const upgrade = runNode([
  'scripts/open-design/upgrade-smoke.js',
  '--open-design-root',
  openDesignRoot,
]);

const upgradePlan = JSON.parse(upgrade.stdout.trim());
assert.equal(upgradePlan.remoteRef, 'upstream/main');
assert.ok(upgradePlan.remotes.origin?.includes('matthew6688/open-design'));
assert.ok(upgradePlan.remotes.upstream?.includes('nexu-io/open-design'));
assert.equal(typeof upgradePlan.forkContainsUpstream, 'boolean');
assert.ok(upgradePlan.suggestedCommands.rollback.includes('open-design:rollback'));

const rollback = runNode([
  'scripts/open-design/rollback-open-design.js',
  '--open-design-root',
  openDesignRoot,
  '--commit',
  'd0431a1',
]);

const rollbackPlan = JSON.parse(rollback.stdout.trim());
assert.equal(rollbackPlan.commit, 'd0431a1');
assert.ok(rollbackPlan.remotes.origin?.includes('matthew6688/open-design'));
assert.ok(rollbackPlan.steps.some((step) => step.includes('Detach HEAD')));

console.log(JSON.stringify({
  ok: true,
  upgradeRemoteRef: upgradePlan.remoteRef,
  forkContainsUpstream: upgradePlan.forkContainsUpstream,
  rollbackCommit: rollbackPlan.commit,
}, null, 2));

function runNode(args) {
  const result = spawnSync('node', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`node ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}
