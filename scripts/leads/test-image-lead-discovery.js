#!/usr/bin/env node

import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'leads', 'image-lead-discovery.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-lead-discovery-'));

try {
  const enriched = runScenario('enriched-no-website', {
    clientSlug: 'image-lead-enriched-no-website',
    discord: { workspace: 'website-leads', channelId: 'forum-leads', messageId: 'image-001' },
    image: { name: 'roofing-sign.jpg' },
    ocrText: 'Roofing & Restoration Free quotes Call Greg 0424 371 622 Roof restorations repairs gutters',
    businessName: 'Roofing & Restoration',
    businessNameNote: 'Generic sign text.',
    industry: 'roofing and restoration',
    phone: '0424 371 622',
    services: ['roof restorations', 'roof repairs', 'gutters'],
    search: {
      noDedicatedWebsiteFound: true,
      queries: ['"0424 371 622" roofing'],
      results: [{
        title: 'M&B Roofing',
        url: 'https://betterpages.example/mb-roofing',
        summary: 'Phone matched listing; no dedicated website found.',
        businessName: 'M&B Roofing',
        city: 'Jamison Town / Greater Western Sydney',
        address: 'Jamison Town, NSW 2750',
        email: 'ghilton@example.com',
        facebookUrl: 'https://facebook.example/mb-roofing',
        confidence: 0.88,
      }],
    },
  }, { withTask: true });
  assert.equal(enriched.pipelineStage, 'ready_for_mockup');
  assert.equal(enriched.aiAssessment.result, 'ready_for_mockup');
  assert.ok(enriched.workTrace.some((entry) => /no dedicated website|独立官网/i.test(entry.action)));
  const taskLogPath = path.join(root, 'data', 'discord-tasks', 'image-lead-enriched-no-website', 'task-log.jsonl');
  assert.ok(fs.existsSync(taskLogPath), 'task log should be written when --task is supplied');
  const taskLogText = fs.readFileSync(taskLogPath, 'utf8');
  assert.match(taskLogText, /web_search_query/);
  assert.match(taskLogText, /lead-ops/);

  const phoneOnly = runScenario('phone-only', {
    clientSlug: 'image-lead-phone-only',
    discord: { workspace: 'website-leads', channelId: 'forum-leads', messageId: 'image-002' },
    image: { name: 'roofing-phone-only.jpg' },
    ocrText: 'Roofing repairs gutters pressure cleaning call 0400 111 222',
    businessName: 'Roofing Repairs',
    businessNameNote: 'Generic service text.',
    industry: 'roofing',
    phone: '0400 111 222',
    services: ['roof repairs', 'gutters', 'pressure cleaning'],
    search: { queries: ['"0400 111 222" roofing'], results: [] },
  });
  assert.equal(phoneOnly.pipelineStage, 'needs_human');
  assert.match(phoneOnly.aiAssessment.reason, /只有 OCR|继续搜索/);
  assert.ok(phoneOnly.workTrace.some((entry) => entry.tool === 'web search'));

  const websiteFound = runScenario('website-found-needs-audit', {
    clientSlug: 'image-lead-website-found',
    discord: { workspace: 'website-leads', channelId: 'forum-leads', messageId: 'image-003' },
    image: { name: 'roofing-website.jpg' },
    ocrText: 'Example Roofing Call 0400 222 333 roof restoration',
    businessName: 'Example Roofing',
    industry: 'roofing',
    phone: '0400 222 333',
    services: ['roof restoration'],
    search: {
      queries: ['"0400 222 333" "Example Roofing"'],
      results: [{
        title: 'Example Roofing',
        url: 'https://example-roofing.test',
        summary: 'Phone matched official website.',
        businessName: 'Example Roofing',
        city: 'Brisbane',
        address: 'Brisbane QLD',
        websiteUrl: 'https://example-roofing.test',
        confidence: 0.88,
      }],
    },
  });
  assert.equal(websiteFound.pipelineStage, 'needs_human');
  assert.match(websiteFound.aiAssessment.reason, /site-audit|官网/);

  console.log(JSON.stringify({
    ok: true,
    scenarios: [
      summarize(enriched),
      summarize(phoneOnly),
      summarize(websiteFound),
    ],
  }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function runScenario(id, input, options = {}) {
  const inputPath = path.join(root, `${id}.json`);
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  const args = [scriptPath, '--input', inputPath];
  if (options.withTask) {
    const taskPath = path.join(root, 'data', 'discord-tasks', input.clientSlug, 'task.json');
    fs.mkdirSync(path.dirname(taskPath), { recursive: true });
    fs.writeFileSync(taskPath, `${JSON.stringify({
      taskId: input.clientSlug,
      thread: { id: 'thread-image-test' },
      artifacts: {
        taskPath: path.relative(root, taskPath),
        logPath: path.relative(root, path.join(path.dirname(taskPath), 'task-log.jsonl')),
      },
    }, null, 2)}\n`, 'utf8');
    args.push('--task', taskPath);
  }
  execFileSync('node', args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const index = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });
  const record = index.records.find((item) => item.clientSlug === input.clientSlug);
  assert.ok(record, `missing record for ${input.clientSlug}`);
  return record;
}

function summarize(record) {
  return {
    clientSlug: record.clientSlug,
    pipelineStage: record.pipelineStage,
    aiAssessment: record.aiAssessment,
    profileCompleteness: record.profileCompleteness,
  };
}
