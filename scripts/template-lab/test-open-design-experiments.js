#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const docsPath = path.join(repoRoot, 'docs', 'NICHE_TEMPLATE_SYSTEM.md');
const openDesignDocsPath = path.join(repoRoot, 'docs', 'OPEN_DESIGN_HEADLESS_ORCHESTRATION.md');
const coreSopPath = path.join(repoRoot, 'docs', 'CORE_BUSINESS_FLOW_SOP.md');
const runnerPath = path.join(repoRoot, 'scripts', 'template-lab', 'run-open-design-experiments.js');
const runId = `test-${Date.now()}`;
const result = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/template-lab/run-open-design-experiments.js'),
  '--root',
  repoRoot,
  '--niche',
  'roofing',
  '--family',
  'classic-premium-roftix',
  '--page',
  'home',
  '--run-id',
  runId,
  '--limit',
  '2',
], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    OLLAMA_URL: 'http://127.0.0.1:1',
    OLLAMA_MODEL: 'qwen3.5:9b',
  },
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const scoreboard = JSON.parse(result.stdout);
assert.equal(scoreboard.execute, false);
assert.equal(scoreboard.variants.length, 2);
assert.equal(scoreboard.variants[0].variant, 'strong-framework-no-llm');
assert.equal(scoreboard.variants[1].variant, 'medium-framework-no-llm');
assert.equal(scoreboard.variants[0].score, null);
assert.equal(scoreboard.best, null);

const experimentRoot = path.join(repoRoot, scoreboard.experimentRoot);
assert.equal(fs.existsSync(path.join(experimentRoot, 'scoreboard.json')), true);

for (const variant of scoreboard.variants) {
  const variantDir = path.join(experimentRoot, variant.variant);
  assert.equal(fs.existsSync(path.join(variantDir, 'prompt.md')), true);
  assert.equal(fs.existsSync(path.join(variantDir, 'experiment-config.json')), true);
  assert.equal(fs.existsSync(path.join(variantDir, 'experiment-score.json')), true);
  const prompt = fs.readFileSync(path.join(variantDir, 'prompt.md'), 'utf8');
  assert.match(prompt, /Fixed Home Page Experiment/);
  assert.match(prompt, /Seeded Approved Assets/);
  assert.match(prompt, /Framework Contract/);
  const config = JSON.parse(fs.readFileSync(path.join(variantDir, 'experiment-config.json'), 'utf8'));
  const score = JSON.parse(fs.readFileSync(path.join(variantDir, 'experiment-score.json'), 'utf8'));
  assert.ok(config.approvedAssets.length >= 3);
  assert.equal(score.score, null);
  assert.equal(score.localBusinessWebsite, null);
  assert.equal(score.experimentReliability, null);
  assert.equal(fs.existsSync(path.join(variantDir, 'seed', 'approved-assets.json')), true);
  for (const asset of config.seedAssets) {
    assert.equal(fs.existsSync(path.join(variantDir, 'seed', asset.seedPath)), true);
  }
}

const localRun = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/template-lab/run-open-design-experiments.js'),
  '--root',
  repoRoot,
  '--niche',
  'roofing',
  '--family',
  'classic-premium-roftix',
  '--page',
  'home',
  '--run-id',
  `${runId}-llm`,
  '--limit',
  '6',
], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    OLLAMA_URL: 'http://127.0.0.1:1',
    OLLAMA_MODEL: 'qwen3.5:9b',
  },
});
assert.equal(localRun.status, 0, localRun.stderr || localRun.stdout);
const localScoreboard = JSON.parse(localRun.stdout);
const localVariant = localScoreboard.variants.find((item) => item.variant === 'medium-framework-local-brief');
assert.equal(localVariant.copyMode, 'local-llm-brief-first');
assert.equal(localVariant.localLlmStatus, 'unavailable');
assert.equal(fs.existsSync(path.join(repoRoot, localScoreboard.experimentRoot, 'medium-framework-local-brief', 'seed', 'local-copy-brief.json')), true);

const filteredRun = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/template-lab/run-open-design-experiments.js'),
  '--root',
  repoRoot,
  '--niche',
  'roofing',
  '--family',
  'classic-premium-roftix',
  '--page',
  'home',
  '--run-id',
  `${runId}-filtered`,
  '--variant',
  'free-open-design-no-llm',
], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(filteredRun.status, 0, filteredRun.stderr || filteredRun.stdout);
const filteredScoreboard = JSON.parse(filteredRun.stdout);
assert.equal(filteredScoreboard.variants.length, 1);
assert.equal(filteredScoreboard.variants[0].variant, 'free-open-design-no-llm');

const docs = fs.readFileSync(docsPath, 'utf8');
assert.match(docs, /AI-generated review-style copy can fill the module as a reference placeholder/);
assert.match(docs, /real leads.*Google Maps \/ Place reviews/i);
assert.match(docs, /NAP consistency is strict for real leads/);
assert.match(docs, /review-provenance/);
assert.match(docs, /LocalBusiness.*RoofingContractor/);
assert.match(docs, /Plain text like “directions placeholder” does not count/);
assert.match(docs, /Open Design Stable Generation SOP/);
assert.match(docs, /approved image pack/i);
assert.match(docs, /medium-framework-no-llm/);
assert.match(docs, /completionMode: native/);

const openDesignDocs = fs.readFileSync(openDesignDocsPath, 'utf8');
assert.match(openDesignDocs, /Core Website Generation SOP/);
assert.match(openDesignDocs, /Stable Input Contract/);
assert.match(openDesignDocs, /OD_DATA_DIR and seeded assets stay aligned/);
assert.match(openDesignDocs, /artifact_quiet_fallback` is rescue-only/);
assert.match(openDesignDocs, /Quality Gate/);
assert.match(openDesignDocs, /horizontal strip/);
assert.match(openDesignDocs, /home-live-medium-v6-2026-05-09/);
assert.match(openDesignDocs, /runner-integrated watcher/);
assert.match(openDesignDocs, /SPECIAL_ALERTS_DISCORD_WEBHOOK_URL/);

const coreSop = fs.readFileSync(coreSopPath, 'utf8');
assert.match(coreSop, /Open Design 网站生成质量门禁/);
assert.match(coreSop, /native clean finish/);
assert.match(coreSop, /OD_DATA_DIR and seeded assets stay aligned/);
assert.match(coreSop, /approved image pack/);
assert.match(coreSop, /横条/);
assert.match(coreSop, /home-live-medium-v6-2026-05-09/);

const runnerSource = fs.readFileSync(runnerPath, 'utf8');
assert.match(runnerSource, /Template-stage scoring allows AI-generated demo\/reference reviews/);
assert.match(runnerSource, /maxBuffer: 64 \* 1024 \* 1024/);
assert.match(runnerSource, /--mode/);
assert.match(runnerSource, /process\.exit\(0\)/);
assert.match(runnerSource, /nativeCleanFinish: Boolean\(state\?\.nativeCleanFinish\)/);
assert.match(runnerSource, /completionMode: state\?\.completionMode \|\| null/);
assert.match(runnerSource, /openDesignDurationMs/);
assert.match(runnerSource, /AI-generated demo\/reference reviews/);
assert.match(runnerSource, /Real lead scoring should compare NAP against Google Place\/GMB/);
assert.match(runnerSource, /hasReviewProvenance/);
assert.match(runnerSource, /not critical blockers/);
assert.match(runnerSource, /ai-reference-placeholder/);
assert.match(runnerSource, /LocalBusiness\/RoofingContractor JSON-LD/);
assert.ok(runnerSource.includes('https://www.google.com/maps/search/?api=1&query=Brisbane+roofing+contractor'));
assert.doesNotMatch(runnerSource, /map link\|directions/);

console.log(JSON.stringify({
  ok: true,
  dryRunVariants: scoreboard.variants.length,
  llmVariantStatus: localVariant.localLlmStatus,
  experimentRoot: scoreboard.experimentRoot,
  reviewPolicyLocked: true,
}, null, 2));
