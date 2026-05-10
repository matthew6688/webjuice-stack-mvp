#!/usr/bin/env node

import assert from 'assert/strict';
import { buildOpenDesignWorkspace } from '../../core/open-design/workspace.js';

const bound = buildOpenDesignWorkspace('mac-app-visible-smoke');
assert.equal(bound.status, 'bound');
assert.equal(bound.mode, 'app-visible');
assert.equal(bound.dataDir, '/Users/matthew/Developer/open-design/.od');
assert.equal(bound.projectId, 'mac-app-visible-smoke-open-design-1778108761460');
assert.ok(bound.continueCommand.includes('open-design:continue-concept'));
assert.ok(bound.syncCommand.includes('open-design:sync-from-app'));

const missing = buildOpenDesignWorkspace('missing-open-design-smoke');
assert.equal(missing.status, 'not_created');
assert.equal(missing.mode, 'app-visible');
assert.equal(missing.dataDir, '/Users/matthew/Developer/open-design/.od');
assert.equal(missing.projectId, '');
assert.ok(missing.createCommand.includes('open-design:run-concept'));

console.log(JSON.stringify({
  ok: true,
  bound: {
    client: 'mac-app-visible-smoke',
    status: bound.status,
    projectId: bound.projectId,
    dataDir: bound.dataDir,
  },
  missing: {
    client: 'missing-open-design-smoke',
    status: missing.status,
    createCommand: missing.createCommand,
  },
}, null, 2));
