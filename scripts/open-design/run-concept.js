#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DEFAULT_OPEN_DESIGN_ROOT = '/Users/matthew/Developer/open-design';
const DEFAULT_NODE24 = '/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node';

if (isMain()) {
  await main();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.client) {
    console.error('Usage: npm run open-design:run-concept -- --client slug [--source-url URL] [--prompt text] [--agent codex|claude|opencode|hermes] [--out path]');
    process.exit(1);
  }

  const clientSlug = String(args.client);
  const openDesignRoot = path.resolve(argValue(args, 'openDesignRoot', 'open-design-root') || process.env.OPEN_DESIGN_ROOT || DEFAULT_OPEN_DESIGN_ROOT);
  const nodeBin = args.node || process.env.OPEN_DESIGN_NODE || DEFAULT_NODE24;
  const port = Number(args.port || process.env.OPEN_DESIGN_PORT || 7466);
  const daemonUrl = (argValue(args, 'daemonUrl', 'daemon-url') || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const mode = argValue(args, 'mode') || process.env.PROFITSLOCAL_OPEN_DESIGN_MODE || 'isolated';
  const dataDir = path.resolve(argValue(args, 'dataDir', 'data-dir') || process.env.OPEN_DESIGN_DATA_DIR || defaultDataDir({ mode, openDesignRoot, clientSlug }));
  const outDir = path.resolve(args.out || path.join('clients', clientSlug, 'concept', 'open-design'));
  const agentId = args.agent || 'codex';
  const skillId = args.skill || 'web-prototype';
  const designSystemId = argValue(args, 'designSystem', 'design-system') || null;
  const model = args.model || 'default';
  const reasoning = args.reasoning || (agentId === 'codex' ? 'low' : null);
  const sourceUrl = argValue(args, 'sourceUrl', 'source-url') || args.url || '';
  const scope = args.scope || 'multi-page';
  const businessType = argValue(args, 'businessType', 'business-type') || 'local business';
  const tone = args.tone || 'high-fidelity, brand-matched, polished';
  const projectId = sanitizeId(argValue(args, 'projectId', 'project-id') || `${clientSlug}-open-design-${Date.now()}`);
  const projectName = args.name || `${clientSlug} Open Design concept`;
  const dryRun = Boolean(argValue(args, 'dryRun', 'dry-run'));
  const keepDaemon = Boolean(argValue(args, 'keepDaemon', 'keep-daemon') || argValue(args, 'daemonUrl', 'daemon-url'));
  const timeoutMs = Number(argValue(args, 'timeoutMs', 'timeout-ms') || args.timeout || 12 * 60 * 1000);
  const artifactQuietMs = Number(argValue(args, 'artifactQuietMs', 'artifact-quiet-ms') || 20_000);

  const prompt = args.prompt || buildPrompt({ sourceUrl, businessType, tone, scope, clientSlug });

  let daemonProcess = null;

  try {
    assertOpenDesignReady(openDesignRoot, nodeBin);
    fs.mkdirSync(outDir, { recursive: true });

    if (dryRun) {
      const preview = {
        clientSlug,
        openDesignRoot,
        nodeBin,
        port,
        daemonUrl,
        dataDir,
        mode,
        outDir,
        agentId,
        skillId,
        designSystemId,
        model,
        reasoning,
        projectId,
        projectName,
        prompt,
      };
      console.log(JSON.stringify(preview, null, 2));
      process.exit(0);
    }

    daemonProcess = await ensureDaemon({ openDesignRoot, nodeBin, port, dataDir, daemonUrl });
    const agents = await getJson(`${daemonUrl}/api/agents`);
    const agent = (agents.agents || []).find((item) => item.id === agentId);
    if (!agent?.available) {
      throw new Error(`Open Design agent "${agentId}" is not available. Check ${daemonUrl}/api/agents.`);
    }

    const created = await postJson(`${daemonUrl}/api/projects`, {
      id: projectId,
      name: projectName,
      skillId,
      designSystemId,
      pendingPrompt: null,
      metadata: {
        kind: 'prototype',
        fidelity: 'high',
        source: 'profitslocal-open-design-runner',
        sourceUrl: sourceUrl || null,
        scope,
        businessType,
        profitsLocal: {
          clientSlug,
          mode,
          outDir,
          createdBy: 'profitslocal-open-design-runner',
        },
      },
    });

    const assistantMessageId = `assistant-${Date.now()}`;
    const clientRequestId = `client-${Date.now()}`;
    const run = await postJson(`${daemonUrl}/api/runs`, {
      agentId,
      projectId,
      conversationId: created.conversationId,
      assistantMessageId,
      clientRequestId,
      skillId,
      designSystemId,
      model,
      reasoning,
      message: prompt,
    });

    const eventsPath = path.join(outDir, 'run-events.sse');
    const finalStatus = await streamRun({
      daemonUrl,
      runId: run.runId,
      eventsPath,
      timeoutMs,
      artifactWatch: {
        projectDir: path.join(dataDir, 'projects', projectId),
        quietMs: artifactQuietMs,
      },
    });

    if (finalStatus.status !== 'succeeded') {
      throw new Error(`Open Design run failed: ${JSON.stringify(finalStatus)}`);
    }

    const files = finalStatus.completionMode === 'artifact_quiet_fallback'
      ? exportProjectFilesFromDisk({ projectDir: path.join(dataDir, 'projects', projectId), outDir })
      : await exportProjectFiles({ daemonUrl, projectId, outDir });
    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      clientSlug,
      projectId,
      conversationId: created.conversationId,
      runId: run.runId,
      agentId,
      agentName: agent.name,
      agentVersion: agent.version || null,
      skillId,
      designSystemId,
      model,
      reasoning,
      sourceUrl: sourceUrl || null,
      businessType,
      tone,
      scope,
      prompt,
      daemonUrl,
      openDesignRoot,
      mode,
      dataDir,
      outDir,
      status: finalStatus,
      files,
    };
    writeJson(path.join(outDir, 'concept-manifest.json'), manifest);
    writeJson(path.join(outDir, 'run-status.json'), finalStatus);
    writeProjectSyncFile({ dataDir, projectId, manifest });
    fs.writeFileSync(path.join(outDir, 'prompt.txt'), `${prompt.trim()}\n`);

    console.log(`Open Design concept complete: ${clientSlug}`);
    console.log(`Project:  ${projectId}`);
    console.log(`Run:      ${run.runId}`);
    console.log(`Output:   ${outDir}`);
    console.log(`Files:    ${files.length}`);
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  } finally {
    if (daemonProcess && !keepDaemon) {
      daemonProcess.kill('SIGTERM');
    }
  }
}

function buildPrompt({ sourceUrl, businessType, tone, scope, clientSlug }) {
  const sourceLine = sourceUrl
    ? `Source website: ${sourceUrl}`
    : `Source website: not provided; use the supplied brief and avoid inventing unsupported business facts.`;
  return [
    'Skip questions. Use Open Design\'s existing web-prototype/design workflow and produce a high-fidelity concept artifact.',
    sourceLine,
    `Client slug: ${clientSlug}`,
    `Business type: ${businessType}`,
    `Visual tone: ${tone}`,
    `Scope: ${scope}`,
    '',
    'If a source website is provided, inspect it and match the existing brand direction instead of inventing a new generic style.',
    'Preserve core business facts, logo/brand identity, existing navigation intent, contact details, booking/order/contact links, menu/service/product content, and old URL intent where visible.',
    'Create concept files in the project folder. Prefer index.html plus local assets and brand-spec.md when brand information is available.',
    'Do not deploy. Do not edit any ProfitsLocal production repo. This is concept generation only.',
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

function defaultDataDir({ mode, openDesignRoot, clientSlug }) {
  if (mode === 'app-visible' || mode === 'source-app-visible') {
    return path.join(openDesignRoot, '.od');
  }
  if (mode === 'isolated') {
    return path.join('/tmp', `profitslocal-open-design-${clientSlug}`);
  }
  throw new Error(`Unknown Open Design mode "${mode}". Use isolated or app-visible.`);
}

async function ensureDaemon({ openDesignRoot, nodeBin, port, dataDir, daemonUrl }) {
  if (await healthOk(daemonUrl)) return null;
  fs.mkdirSync(dataDir, { recursive: true });
  const cli = path.join(openDesignRoot, 'apps', 'daemon', 'dist', 'cli.js');
  const child = spawn(nodeBin, [cli, '--port', String(port), '--no-open'], {
    cwd: openDesignRoot,
    env: {
      ...process.env,
      OD_PORT: String(port),
      OD_DATA_DIR: dataDir,
    },
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

async function streamRun({ daemonUrl, runId, eventsPath, timeoutMs, artifactWatch }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let fallbackStatus = null;
  let artifactTimer = null;
  let response;
  try {
    response = await fetch(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}/events`, {
      signal: controller.signal,
    });
  } catch (error) {
    throw error;
  }
  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream Open Design run ${runId}: ${response.status}`);
  }
  const writer = fs.createWriteStream(eventsPath, { flags: 'w' });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalStatus = null;
  if (artifactWatch?.projectDir) {
    artifactTimer = setInterval(async () => {
      if (fallbackStatus || finalStatus) return;
      const snapshot = scanArtifactQuietSnapshot(artifactWatch.projectDir, artifactWatch.quietMs);
      if (!snapshot.ready) return;
      fallbackStatus = {
        status: 'succeeded',
        code: 0,
        signal: null,
        completionMode: 'artifact_quiet_fallback',
        artifactSnapshot: snapshot,
      };
      try {
        await postJson(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}/cancel`, {});
      } catch {}
      controller.abort();
    }, 2_000);
    artifactTimer.unref?.();
  }

  try {
    while (true) {
      if (Date.now() - startedAt > timeoutMs) {
        writer.end();
        throw new Error(`Open Design run timed out after ${timeoutMs}ms: ${runId}`);
      }
      let result;
      try {
        result = await reader.read();
      } catch (error) {
        if (fallbackStatus && error?.name === 'AbortError') break;
        throw error;
      }
      const { value, done } = result;
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      writer.write(chunk);
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const parsed = parseSseFrame(frame);
        if (parsed?.event === 'end') finalStatus = parsed.data;
      }
    }
  } finally {
    writer.end();
    if (artifactTimer) clearInterval(artifactTimer);
  }
  if (fallbackStatus) return fallbackStatus;
  return finalStatus || await getJson(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}`);
}

function parseSseFrame(frame) {
  const out = { event: 'message', data: null };
  const dataLines = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) out.event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return out;
  try {
    out.data = JSON.parse(dataLines.join('\n'));
  } catch {
    out.data = dataLines.join('\n');
  }
  return out;
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
    exported.push({
      path: file.path,
      size: bytes.length,
      kind: file.kind || null,
      mime: file.mime || null,
      artifactKind: file.artifactKind || null,
    });
  }
  return exported;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
    openDesignRunId: manifest.runId,
    mode: manifest.mode,
    dataDir: manifest.dataDir,
    rule: 'Open Design project is a concept workspace. Production changes must be ported to Webjuice/Astro, pushed to dev, and recorded in the ProfitsLocal case/Discord thread.',
  });
}

function exportProjectFilesFromDisk({ projectDir, outDir }) {
  const exported = [];
  for (const source of listFilesRecursive(projectDir)) {
    const rel = path.relative(projectDir, source);
    const target = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    exported.push({
      path: rel.split(path.sep).join('/'),
      size: fs.statSync(source).size,
      kind: null,
      mime: null,
      artifactKind: null,
    });
  }
  return exported;
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(target));
      continue;
    }
    if (entry.isFile()) out.push(target);
  }
  return out;
}

function isSourceCaptureHtml(filePath) {
  const normalized = String(filePath).split(path.sep).join('/');
  return /(^|\/)source-[^/]+\.html$/i.test(normalized);
}

function scanArtifactQuietSnapshot(projectDir, quietMs) {
  const files = listFilesRecursive(projectDir);
  const html = files.filter((file) => file.endsWith('.html'));
  const generatedHtml = html.filter((file) => !isSourceCaptureHtml(file));
  if (generatedHtml.length === 0) {
    return {
      ready: false,
      reason: html.length ? 'generated_artifacts_missing' : 'required_artifacts_missing',
      htmlCount: html.length,
      generatedHtmlCount: generatedHtml.length,
    };
  }
  let latestMtimeMs = 0;
  for (const file of files) {
    const stats = fs.statSync(file);
    latestMtimeMs = Math.max(latestMtimeMs, stats.mtimeMs);
  }
  const quietForMs = Date.now() - latestMtimeMs;
  if (quietForMs < quietMs) {
    return { ready: false, reason: 'still_changing', quietForMs, latestMtimeMs };
  }
  return {
    ready: true,
    htmlCount: html.length,
    generatedHtmlCount: generatedHtml.length,
    cssCount: files.filter((file) => file.endsWith('.css')).length,
    fileCount: files.length,
    quietForMs,
    latestMtimeMs,
  };
}

function sanitizeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128) || `open-design-${Date.now()}`;
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

function argValue(argsObject, ...keys) {
  for (const key of keys) {
    if (argsObject[key] !== undefined) return argsObject[key];
  }
  return undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMain() {
  try {
    return path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
}

export {
  streamRun,
  exportProjectFilesFromDisk,
  listFilesRecursive,
  isSourceCaptureHtml,
  scanArtifactQuietSnapshot,
};
