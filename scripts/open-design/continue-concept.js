#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { exportProjectFilesFromDisk, streamRun } from './run-concept.js';

const DEFAULT_OPEN_DESIGN_ROOT = '/Users/matthew/Developer/open-design';
const DEFAULT_NODE24 = '/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node';

const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || '';

if (!clientSlug || !args.prompt) {
  console.error('Usage: node scripts/open-design/continue-concept.js --client slug --prompt "change request" [--manifest file]');
  process.exit(1);
}

const manifestPath = path.resolve(args.manifest || path.join('clients', clientSlug, 'concept', 'open-design', 'concept-manifest.json'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const openDesignRoot = path.resolve(args['open-design-root'] || manifest.openDesignRoot || process.env.OPEN_DESIGN_ROOT || DEFAULT_OPEN_DESIGN_ROOT);
const nodeBin = args.node || process.env.OPEN_DESIGN_NODE || DEFAULT_NODE24;
const port = Number(args.port || process.env.OPEN_DESIGN_PORT || 7466);
const daemonUrl = (args['daemon-url'] || manifest.daemonUrl || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const dataDir = path.resolve(args['data-dir'] || manifest.dataDir || process.env.OPEN_DESIGN_DATA_DIR || path.join('/tmp', `profitslocal-open-design-${clientSlug}`));
const outDir = path.resolve(args.out || manifest.outDir || path.dirname(manifestPath));
const timeoutMs = Number(args['timeout-ms'] || args.timeout || 12 * 60 * 1000);
const artifactQuietMs = Number(args['artifact-quiet-ms'] || 20_000);
const keepDaemon = Boolean(args['keep-daemon'] || args['daemon-url']);
const dryRun = Boolean(args['dry-run']);

let daemonProcess = null;

try {
  assertOpenDesignReady(openDesignRoot, nodeBin);
  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      clientSlug,
      manifestPath,
      openDesignRoot,
      daemonUrl,
      dataDir,
      outDir,
      projectId: manifest.projectId,
      conversationId: manifest.conversationId || null,
      prompt: buildContinuationPrompt(args.prompt),
      artifactQuietMs,
    }, null, 2));
    process.exit(0);
  }

  daemonProcess = await ensureDaemon({ openDesignRoot, nodeBin, port, dataDir, daemonUrl });

  const project = await getJson(`${daemonUrl}/api/projects/${encodeURIComponent(manifest.projectId)}`).catch((error) => {
    throw new Error(`Open Design project is not visible at ${daemonUrl}. The daemon may be using a different OD_DATA_DIR. Expected project "${manifest.projectId}" in ${dataDir}. ${error.message}`);
  });

  const conversationId = manifest.conversationId || project.conversationId;
  if (!conversationId) throw new Error('Missing conversationId; cannot continue the Open Design project.');

  const run = await postJson(`${daemonUrl}/api/runs`, {
    agentId: args.agent || manifest.agentId || 'codex',
    projectId: manifest.projectId,
    conversationId,
    assistantMessageId: `assistant-${Date.now()}`,
    clientRequestId: `client-${Date.now()}`,
    skillId: args.skill || manifest.skillId || 'web-prototype',
    designSystemId: args['design-system'] || manifest.designSystemId || null,
    model: args.model || manifest.model || 'default',
    reasoning: args.reasoning || manifest.reasoning || null,
    message: buildContinuationPrompt(args.prompt),
  });

  const eventsPath = path.join(outDir, `run-events-${run.runId}.sse`);
  const finalStatus = await streamRun({
    daemonUrl,
    runId: run.runId,
    eventsPath,
    timeoutMs,
    artifactWatch: {
      projectDir: path.join(dataDir, 'projects', manifest.projectId),
      quietMs: artifactQuietMs,
    },
  });
  if (finalStatus.status !== 'succeeded') {
    throw new Error(`Open Design continuation failed: ${JSON.stringify(finalStatus)}`);
  }

  const files = finalStatus.completionMode === 'artifact_quiet_fallback'
    ? exportProjectFilesFromDisk({ projectDir: path.join(dataDir, 'projects', manifest.projectId), outDir })
    : await exportProjectFiles({ daemonUrl, projectId: manifest.projectId, outDir });
  const updatedManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    lastRunId: run.runId,
    previousRunId: manifest.lastRunId || manifest.runId,
    status: finalStatus,
    files,
    continuationRuns: [
      ...(manifest.continuationRuns || []),
      {
        runId: run.runId,
        createdAt: new Date().toISOString(),
        prompt: args.prompt,
        status: finalStatus,
        eventsPath: path.relative(outDir, eventsPath),
      },
    ],
  };
  writeJson(manifestPath, updatedManifest);
  writeJson(path.join(outDir, 'run-status.json'), finalStatus);
  writeProjectSyncFile({ dataDir, projectId: manifest.projectId, manifest: updatedManifest });

  console.log(JSON.stringify({
    ok: true,
    clientSlug,
    projectId: manifest.projectId,
    runId: run.runId,
    outDir,
    files: files.length,
  }, null, 2));
} catch (error) {
  console.error(error?.message || String(error));
  process.exitCode = 1;
} finally {
  if (daemonProcess && !keepDaemon) daemonProcess.kill('SIGTERM');
}

function buildContinuationPrompt(prompt) {
  return [
    'Continue this existing Open Design concept. Do not start over unless explicitly requested.',
    'Keep the existing brand extraction, source-site facts, screenshots, assets, and page intent.',
    'This remains concept work only: do not deploy and do not edit the ProfitsLocal production repo.',
    'If the requested change affects business facts, flag that production must verify against ProfitsLocal evidence/content artifacts.',
    '',
    'Change request:',
    prompt,
  ].join('\n');
}

function assertOpenDesignReady(root, node) {
  if (!fs.existsSync(root)) throw new Error(`Open Design root not found: ${root}`);
  if (!fs.existsSync(node)) throw new Error(`Node 24 binary not found: ${node}`);
  const cli = path.join(root, 'apps', 'daemon', 'dist', 'cli.js');
  if (!fs.existsSync(cli)) {
    throw new Error(`Open Design daemon is not built: ${cli}. Run: cd ${root} && pnpm --filter @open-design/daemon build`);
  }
}

async function ensureDaemon({ openDesignRoot, nodeBin, port, dataDir, daemonUrl }) {
  if (await healthOk(daemonUrl)) return null;
  fs.mkdirSync(dataDir, { recursive: true });
  const cli = path.join(openDesignRoot, 'apps', 'daemon', 'dist', 'cli.js');
  const child = spawn(nodeBin, [cli, '--port', String(port), '--no-open'], {
    cwd: openDesignRoot,
    env: { ...process.env, OD_PORT: String(port), OD_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stderr.write(`[od] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[od] ${chunk}`));
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (await healthOk(daemonUrl)) return child;
    await sleep(500);
  }
  child.kill('SIGTERM');
  throw new Error(`Open Design daemon did not become healthy: ${daemonUrl}`);
}

async function healthOk(url) {
  try {
    const response = await fetch(`${url}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function exportProjectFiles({ daemonUrl, projectId, outDir }) {
  const listing = await getJson(`${daemonUrl}/api/projects/${encodeURIComponent(projectId)}/files`);
  const files = listing.files || [];
  const exported = [];
  for (const file of files) {
    if (!file?.path || file.type === 'directory') continue;
    const rawUrl = `${daemonUrl}/api/projects/${encodeURIComponent(projectId)}/raw/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(rawUrl);
    if (!response.ok) throw new Error(`Failed to fetch Open Design file ${file.path}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const target = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    exported.push({ path: file.path, size: bytes.length, kind: file.kind || null, mime: file.mime || null, artifactKind: file.artifactKind || null });
  }
  return exported;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function writeProjectSyncFile({ dataDir, projectId, manifest }) {
  const projectDir = path.join(dataDir, 'projects', projectId);
  if (!fs.existsSync(projectDir)) return;
  writeJson(path.join(projectDir, '.profitslocal-sync.json'), {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    clientSlug: manifest.clientSlug,
    conceptManifestPath: path.join(manifest.outDir, 'concept-manifest.json'),
    productionHandoffPath: path.join(manifest.outDir, 'production-handoff.json'),
    openDesignProjectId: manifest.projectId,
    openDesignRunId: manifest.lastRunId || manifest.runId,
    mode: manifest.mode,
    dataDir: manifest.dataDir,
    rule: 'Open Design project is a concept workspace. Production changes must be ported to Webjuice/Astro, pushed to dev, and recorded in the ProfitsLocal case/Discord thread.',
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}
