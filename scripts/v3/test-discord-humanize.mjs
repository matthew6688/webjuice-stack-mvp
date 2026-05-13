#!/usr/bin/env node
// Contract test · core/discord-tasks/humanize.js
import { makeRunner } from './_test-helpers.mjs';

const r = makeRunner('discord-humanize');
const h = await import('../../core/discord-tasks/humanize.js');

await r.assert('kindLabel returns label for known kinds', () => {
  for (const k of ['scrape', 'places-intake', 'single-enrich', 'audit', 'image-extract', 'ops']) {
    const lbl = h.kindLabel(k);
    if (!lbl.label || !lbl.emoji || !lbl.verb) throw new Error(`incomplete label for ${k}`);
  }
  return true;
});

await r.assert('kindLabel fallback for unknown kind', () => {
  const lbl = h.kindLabel('unknown_kind_xyz');
  if (lbl.label !== '后台任务') throw new Error('expected fallback label');
  return true;
});

await r.assert('cliHuman returns human label', () => {
  const s = h.cliHuman('pl:scrape-docker');
  if (!s.includes('gosom')) throw new Error(`cliHuman wrong: ${s}`);
  return true;
});

await r.assert('explainFailure recognizes docker not running', () => {
  const e = h.explainFailure('ECONNREFUSED 127.0.0.1:8080 (docker container)', 1);
  if (!e.includes('Docker') && !e.includes('docker')) throw new Error(`fail explain wrong: ${e}`);
  return true;
});

await r.assert('explainFailure recognizes quota cap', () => {
  const e = h.explainFailure('PlacesQuotaCapExceeded: all keys exhausted', 1);
  if (!e.includes('Places') && !e.includes('额度')) throw new Error(`fail explain wrong: ${e}`);
  return true;
});

await r.assert('explainFailure fallback shows exit code + stderr tail', () => {
  const e = h.explainFailure('random unexpected error', 42);
  if (!e.includes('42')) throw new Error('expected exit code in fallback');
  return true;
});

await r.assert('adminUrls.task returns valid URL', () => {
  const url = h.adminUrls.task('abc123');
  if (!url.startsWith('http') || !url.includes('abc123')) throw new Error(`bad URL: ${url}`);
  return true;
});

await r.assert('renderTaskCreatedMessage has emoji + label + admin link', () => {
  const msg = h.renderTaskCreatedMessage({
    task: { task_id: 'abc' },
    route: { kind: 'scrape', target_cli: 'pl:scrape-docker', args: ['--niche', 'roofer'], target_entity_key: null, provider: 'regex' },
  });
  if (!msg.includes('🔎')) throw new Error('emoji missing');
  if (!msg.includes('批量抓客户')) throw new Error('label missing');
  if (!msg.includes('abc')) throw new Error('task_id missing');
  if (msg.includes('kind: scrape')) throw new Error('jargon \"kind: scrape\" leaked');
  return true;
});

await r.assert('renderDoneMessage includes business summary + technical fold', () => {
  const msg = h.renderDoneMessage({
    task: { kind: 'scrape', task_id: 'abc' },
    durationMs: 4800,
    tail: 'gosom scraped 12 rows · lead_count=12',
    xref: null,
  });
  if (!msg.includes('完成')) throw new Error('done indicator missing');
  if (!msg.includes('12')) throw new Error('result count missing');
  if (!msg.includes('<details>')) throw new Error('technical details should be folded');
  return true;
});

await r.assert('renderFailedMessage explains failure in human terms', () => {
  const msg = h.renderFailedMessage({
    task: { kind: 'scrape', task_id: 'abc' },
    exitCode: 1,
    stderr: 'ECONNREFUSED 127.0.0.1:8080',
    tail: 'docker connect failed',
  });
  if (!msg.includes('失败')) throw new Error('failure indicator missing');
  if (!msg.match(/[Dd]ocker/)) throw new Error('docker explanation missing');
  if (!msg.includes('<details>')) throw new Error('tech fold missing');
  if (msg.match(/exit=1/) && !msg.match(/[Dd]ocker/)) throw new Error('raw exit code shown without explanation');
  return true;
});

await r.assert('renderTimeoutMessage gives retry action', () => {
  const msg = h.renderTimeoutMessage({
    task: { kind: 'audit', task_id: 'abc' },
    timeoutMs: 60_000,
    tail: '...',
  });
  if (!msg.includes('超时')) throw new Error('timeout indicator missing');
  if (!msg.includes('60')) throw new Error('time missing');
  if (!msg.match(/[✅|重试|放弃]/)) throw new Error('action prompt missing');
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
