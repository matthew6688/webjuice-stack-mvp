#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import {
  isSourceCaptureHtml,
  listFilesRecursive,
  buildArtifactWatchConfig,
  buildQuestionFormAnswerPrompt,
  extractQuestionForms,
  inspectOpenDesignCheckpoint,
  normalizeOpenDesignHardTimeoutMs,
  normalizeOpenDesignTimeoutMs,
  scanArtifactQuietSnapshot,
  scanOpenDesignProjectSnapshot,
  streamRun,
  summarizeOpenDesignEvents,
} from './run-concept.js';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'od-artifact-fallback-'));

try {
  const hiddenSkillDir = path.join(root, '.od-skills', 'web-prototype');
  fs.mkdirSync(hiddenSkillDir, { recursive: true });
  fs.writeFileSync(path.join(hiddenSkillDir, 'example.html'), '<html><body>seed</body></html>');

  let snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'required_artifacts_missing');

  const sourceCapturePath = path.join(root, 'source-homepage.html');
  fs.writeFileSync(sourceCapturePath, '<!doctype html><title>Captured source</title>');
  const nestedSourceDir = path.join(root, 'source');
  fs.mkdirSync(nestedSourceDir, { recursive: true });
  const nestedSourcePath = path.join(nestedSourceDir, 'home.html');
  fs.writeFileSync(nestedSourcePath, '<!doctype html><title>Nested captured source</title>');

  snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'generated_artifacts_missing');
  assert.equal(snapshot.htmlCount, 2);
  assert.equal(snapshot.generatedHtmlCount, 0);
  assert.equal(isSourceCaptureHtml(sourceCapturePath), true);
  assert.equal(isSourceCaptureHtml(nestedSourcePath), true);

  const visibleAssetDir = path.join(root, 'assets');
  fs.mkdirSync(visibleAssetDir, { recursive: true });
  const heroPath = path.join(visibleAssetDir, 'hero.jpg');
  fs.writeFileSync(heroPath, 'binary');

  snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'generated_artifacts_missing');

  const indexPath = path.join(root, 'index.html');
  fs.writeFileSync(indexPath, '<!doctype html><title>Smoke</title>');
  const oldTime = new Date(Date.now() - 60_000);
  fs.utimesSync(heroPath, oldTime, oldTime);
  fs.utimesSync(indexPath, oldTime, oldTime);
  fs.utimesSync(sourceCapturePath, oldTime, oldTime);
  fs.utimesSync(nestedSourcePath, oldTime, oldTime);

  snapshot = scanArtifactQuietSnapshot(root, 1);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.htmlCount, 3);
  assert.equal(snapshot.generatedHtmlCount, 1);
  assert.equal(snapshot.fileCount, 4);

  snapshot = scanArtifactQuietSnapshot(root, 1, { minArtifactMtimeMs: Date.now() });
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.reason, 'stale_artifacts');

  const projectSnapshot = scanOpenDesignProjectSnapshot(root, { minArtifactMtimeMs: Date.now() - 120_000 });
  assert.equal(projectSnapshot.ready, true);
  assert.equal(projectSnapshot.freshGeneratedHtmlCount, 1);

  const clamped = normalizeOpenDesignTimeoutMs({
    agentId: 'codex',
    skillId: 'web-prototype',
    mode: 'app-visible',
    requestedTimeoutMs: 180000,
    allowShortTimeout: false,
  });
  assert.equal(clamped.timeoutMs, 600000);
  assert.equal(clamped.clamped, true);

  const unclamped = normalizeOpenDesignTimeoutMs({
    agentId: 'codex',
    skillId: 'web-prototype',
    mode: 'app-visible',
    requestedTimeoutMs: 180000,
    allowShortTimeout: true,
  });
  assert.equal(unclamped.timeoutMs, 180000);
  assert.equal(unclamped.clamped, false);

  const hardTimeout = normalizeOpenDesignHardTimeoutMs({
    checkpointMs: 600000,
    requestedHardTimeoutMs: 0,
  });
  assert.equal(hardTimeout.checkpointIsHardKill, false);
  assert.equal(hardTimeout.hardTimeoutMs, 1800000);

  const hardTimeoutMinimum = normalizeOpenDesignHardTimeoutMs({
    checkpointMs: 600000,
    requestedHardTimeoutMs: 700000,
  });
  assert.equal(hardTimeoutMinimum.hardTimeoutMs, 1200000);

  assert.equal(buildArtifactWatchConfig({
    allowArtifactFallback: false,
    projectDir: root,
    quietMs: 20_000,
  }), null);
  assert.deepEqual(buildArtifactWatchConfig({
    allowArtifactFallback: true,
    projectDir: root,
    quietMs: 20_000,
  }), {
    projectDir: root,
    quietMs: 20_000,
  });

  const eventsPath = path.join(root, 'run-events.sse');
  fs.writeFileSync(eventsPath, [
    'event: message',
    'data: {"type":"message","content":"<question-form id=\\"discovery\\" title=\\"Quick brief\\"></question-form>"}',
    '',
    'event: message',
    'data: {"type":"tool_use","name":"Bash","input":{"command":"touch index.html"}}',
    '',
    'event: message',
    'data: {"type":"raw","line":"{\\"type\\":\\"item.started\\",\\"item\\":{\\"type\\":\\"file_change\\",\\"changes\\":[{\\"path\\":\\"index.html\\",\\"kind\\":\\"update\\"}],\\"status\\":\\"in_progress\\"}}"}',
    '',
    'event: end',
    'data: {"status":"succeeded"}',
    '',
  ].join('\n'));
  const eventSummary = summarizeOpenDesignEvents(eventsPath);
  assert.equal(eventSummary.nativeCleanFinish, true);
  assert.equal(eventSummary.questionForms.length, 1);
  assert.equal(eventSummary.questionForms[0].id, 'discovery');
  assert.equal(eventSummary.toolUses.length, 1);
  assert.equal(eventSummary.fileChanges.length, 1);
  assert.equal(eventSummary.fileChanges[0].path, 'index.html');
  assert.equal(extractQuestionForms('<question-form id="direction" title="Pick"></question-form>').length, 1);
  const autoAnswerPrompt = buildQuestionFormAnswerPrompt({
    clientSlug: 'question-form-smoke',
    sourceUrl: '',
    businessType: 'roofer',
    tone: 'practical',
    scope: 'one-page',
    originalPrompt: 'Build a roofer page.',
    questionForms: eventSummary.questionForms,
  });
  assert.ok(autoAnswerPrompt.includes('Do not wait for human input'));
  assert.ok(autoAnswerPrompt.includes('never invent exact email, phone, address'));
  assert.ok(autoAnswerPrompt.includes('Treat those as the primary approved imagery'));
  assert.ok(autoAnswerPrompt.includes('Do not replace seeded raster assets with newly drawn SVG illustrations'));
  assert.ok(autoAnswerPrompt.includes('do not ship an image-free text-only page'));

  const nativeCheckpoint = await inspectOpenDesignCheckpoint({
    daemonUrl: 'http://127.0.0.1:1',
    runId: 'native-smoke',
    eventsPath,
    projectDir: root,
    startedAt: Date.now() - 120_000,
    checkpointCount: 1,
    checkpointMs: 600000,
    lastEventAt: Date.now() - 60_000,
  });
  assert.equal(nativeCheckpoint.action, 'return');
  assert.equal(nativeCheckpoint.status.status, 'succeeded');

  const hangingEndEventsPath = path.join(root, 'run-events-native-end-open-stream.sse');
  const hangingEndSockets = new Set();
  const hangingEndServer = http.createServer((request, response) => {
    if (!request.url?.includes('/events')) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write([
      'event: end',
      'data: {"status":"succeeded","code":0,"signal":null}',
      '',
      '',
    ].join('\n'));
  });
  hangingEndServer.on('connection', (socket) => {
    hangingEndSockets.add(socket);
    socket.on('close', () => hangingEndSockets.delete(socket));
  });
  await new Promise((resolve) => hangingEndServer.listen(0, '127.0.0.1', resolve));
  const hangingEndPort = hangingEndServer.address().port;
  const nativeEndStartedAt = Date.now();
  const nativeEndStatus = await streamRun({
    daemonUrl: `http://127.0.0.1:${hangingEndPort}`,
    runId: 'native-end-open-stream',
    eventsPath: hangingEndEventsPath,
    timeoutMs: 600000,
    hardTimeoutMs: 1200000,
  });
  for (const socket of hangingEndSockets) socket.destroy();
  hangingEndServer.closeAllConnections?.();
  await new Promise((resolve) => hangingEndServer.close(resolve));
  assert.equal(nativeEndStatus.status, 'succeeded');
  assert.ok(Date.now() - nativeEndStartedAt < 2000, 'native end must not wait for the SSE connection to close or checkpoint');

  const questionEventsPath = path.join(root, 'run-events-question-only.sse');
  fs.writeFileSync(questionEventsPath, [
    'event: message',
    'data: {"type":"message","content":"<question-form id=\\"scope\\" title=\\"Pick scope\\"></question-form>"}',
    '',
  ].join('\n'));
  const questionCheckpoint = await inspectOpenDesignCheckpoint({
    daemonUrl: 'http://127.0.0.1:1',
    runId: 'question-smoke',
    eventsPath: questionEventsPath,
    projectDir: root,
    startedAt: Date.now() - 120_000,
    checkpointCount: 1,
    checkpointMs: 600000,
    lastEventAt: Date.now() - 60_000,
  });
  assert.equal(questionCheckpoint.action, 'return');
  assert.equal(questionCheckpoint.status.completionMode, 'question_form_checkpoint');

  const stuckRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'od-stuck-'));
  const stuckProjectRoot = path.join(stuckRoot, 'project');
  const stuckEventsRoot = path.join(stuckRoot, 'events');
  fs.mkdirSync(stuckProjectRoot, { recursive: true });
  fs.mkdirSync(stuckEventsRoot, { recursive: true });
  const stuckEventsPath = path.join(stuckEventsRoot, 'run-events.sse');
  fs.writeFileSync(stuckEventsPath, '');
  const stuckCheckpoint = await inspectOpenDesignCheckpoint({
    daemonUrl: 'http://127.0.0.1:1',
    runId: 'stuck-smoke',
    eventsPath: stuckEventsPath,
    projectDir: stuckProjectRoot,
    startedAt: Date.now() - 1_200_000,
    checkpointCount: 1,
    checkpointMs: 600000,
    lastEventAt: Date.now() - 1_200_000,
  });
  assert.equal(stuckCheckpoint.action, 'fail');
  assert.match(stuckCheckpoint.message, /no fresh generated HTML/);
  fs.rmSync(stuckRoot, { recursive: true, force: true });

  const runnerSource = fs.readFileSync(path.join(repoRoot, 'scripts/open-design/run-concept.js'), 'utf8');
  const questionFormBranch = runnerSource.indexOf('if (runSummary.questionForms.length > 0)');
  const noFilesBranch = runnerSource.indexOf("if (!files.length)");
  assert.ok(questionFormBranch > -1, 'question form auto-answer branch must exist');
  assert.ok(noFilesBranch > -1, 'no-files guard must exist');
  assert.ok(questionFormBranch < noFilesBranch, 'question forms must be auto-answered before treating no files as failure');
  assert.ok(runnerSource.includes('findAvailablePort(port + 1)'), 'isolated runs must avoid silently reusing the default daemon port');
  assert.ok(runnerSource.includes('OD_DATA_DIR and seeded assets stay aligned'), 'daemon reuse error must explain seed/data-dir alignment risk');
  assert.ok(runnerSource.includes('checkpointIsHardKill: false'), 'timeout must be a watcher checkpoint, not the hard stop');
  assert.ok(runnerSource.includes('generated_artifacts_exist_waiting_for_native_end'), 'fresh artifacts must wait for native finish instead of being accepted silently');
  assert.ok(runnerSource.includes("parsed?.event === 'end'"), 'streamRun must explicitly detect native end events');
  assert.ok(runnerSource.includes('break streamLoop'), 'native end must break the stream loop immediately');

  const files = listFilesRecursive(root).map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
  assert.deepEqual(files, ['assets/hero.jpg', 'index.html', 'run-events-native-end-open-stream.sse', 'run-events-question-only.sse', 'run-events.sse', 'source-homepage.html', 'source/home.html']);

  console.log(JSON.stringify({
    ok: true,
    ignoresDotDirectories: true,
    requiresGeneratedHtmlArtifacts: true,
    ignoresSourceCaptureHtml: true,
    rejectsStaleArtifactsForContinuation: true,
    checkpointIsNotHardKill: true,
    checkpointStuckFailure: true,
    artifactFallbackDefaultOff: true,
    eventSummaryCapturesNativeEndAndQuestionForms: true,
    eventSummaryCapturesFileChanges: true,
    questionFormAutoAnswerPrompt: true,
    questionFormBeforeNoFilesGuard: true,
    shortTimeoutClampForCodexWebPrototype: clamped,
    visibleFiles: files,
    freshSnapshot: scanArtifactQuietSnapshot(root, 1),
  }, null, 2));
  setImmediate(() => process.exit(0));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
