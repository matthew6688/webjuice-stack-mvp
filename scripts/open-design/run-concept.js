#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

const DEFAULT_OPEN_DESIGN_ROOT = '/Users/matthew/Developer/open-design';
const DEFAULT_NODE24 = '/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node';
const DEFAULT_CODEX_WEB_PROTOTYPE_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_CODEX_WEB_PROTOTYPE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_OPEN_DESIGN_HARD_TIMEOUT_MULTIPLIER = 3;

if (isMain()) {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
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
  let port = Number(args.port || process.env.OPEN_DESIGN_PORT || 7466);
  const explicitPort = Boolean(args.port || process.env.OPEN_DESIGN_PORT);
  const explicitDaemonUrl = argValue(args, 'daemonUrl', 'daemon-url');
  let daemonUrl = (explicitDaemonUrl || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const mode = argValue(args, 'mode') || process.env.PROFITSLOCAL_OPEN_DESIGN_MODE || 'isolated';
  const dataDir = path.resolve(argValue(args, 'dataDir', 'data-dir') || process.env.OPEN_DESIGN_DATA_DIR || defaultDataDir({ mode, openDesignRoot, clientSlug }));
  const outDir = path.resolve(args.out || path.join('clients', clientSlug, 'concept', 'open-design'));
  const seedDir = argValue(args, 'seedDir', 'seed-dir')
    ? path.resolve(argValue(args, 'seedDir', 'seed-dir'))
    : null;
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
  const requestedTimeoutMs = Number(argValue(args, 'timeoutMs', 'timeout-ms') || args.timeout || DEFAULT_CODEX_WEB_PROTOTYPE_TIMEOUT_MS);
  const artifactQuietMs = Number(argValue(args, 'artifactQuietMs', 'artifact-quiet-ms') || 20_000);
  const allowArtifactFallback = Boolean(argValue(args, 'allowArtifactFallback', 'allow-artifact-fallback'));
  const allowShortTimeout = Boolean(argValue(args, 'allowShortTimeout', 'allow-short-timeout'));
  const maxQuestionFormRounds = Number(argValue(args, 'maxQuestionFormRounds', 'max-question-form-rounds') ?? 2);
  const timeoutPolicy = normalizeOpenDesignTimeoutMs({
    agentId,
    skillId,
    mode,
    requestedTimeoutMs,
    allowShortTimeout,
  });
  const timeoutMs = timeoutPolicy.timeoutMs;
  const hardTimeoutPolicy = normalizeOpenDesignHardTimeoutMs({
    checkpointMs: timeoutMs,
    requestedHardTimeoutMs: Number(argValue(args, 'hardTimeoutMs', 'hard-timeout-ms') || process.env.OPEN_DESIGN_HARD_TIMEOUT_MS || 0),
  });
  const hardTimeoutMs = hardTimeoutPolicy.hardTimeoutMs;

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
        seedDir,
        agentId,
        skillId,
        designSystemId,
        model,
        reasoning,
        projectId,
        projectName,
        prompt,
        timeoutPolicy,
        hardTimeoutPolicy,
        allowArtifactFallback,
        artifactQuietMs,
        maxQuestionFormRounds,
      };
      console.log(JSON.stringify(preview, null, 2));
      process.exit(0);
    }

    if (!keepDaemon && !explicitDaemonUrl && await healthOk(daemonUrl)) {
      if (explicitPort) {
        throw new Error(`Open Design daemon already exists at ${daemonUrl}; pass --keep-daemon to reuse it intentionally, or use a free --port so OD_DATA_DIR and seeded assets stay aligned.`);
      }
      port = await findAvailablePort(port + 1);
      daemonUrl = `http://127.0.0.1:${port}`;
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
    if (seedDir) {
      const projectDir = path.join(dataDir, 'projects', projectId);
      seedProjectFiles({ seedDir, projectDir });
    }

    const assistantMessageId = `assistant-${Date.now()}`;
    const clientRequestId = `client-${Date.now()}`;
    const assistantMessageContent = buildAutomationMessage({
      mode: 'run-concept',
      sourceUrl,
      businessType,
      tone,
      scope,
      prompt,
    });
    await upsertAutomationMessage({
      daemonUrl,
      projectId,
      conversationId: created.conversationId,
      messageId: assistantMessageId,
      role: 'assistant',
      content: assistantMessageContent,
      agentId,
      agentName: agent.name || agentId,
      runStatus: 'queued',
    });
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
    const runStartedAt = new Date();
    const lifecycleBase = {
      schemaVersion: 1,
      clientSlug,
      projectId,
      conversationId: created.conversationId,
      runId: run.runId,
      agentId,
      skillId,
      mode,
      status: 'running',
      nativeCleanFinish: false,
      allowArtifactFallback,
      timeoutPolicy,
      startedAt: runStartedAt.toISOString(),
      endedAt: null,
      durationMs: null,
      files: [],
      questionForms: [],
      questionFormRounds: [],
      toolUses: [],
      fileChanges: [],
      audit: null,
    };
    writeOpenDesignRunState({ outDir, state: lifecycleBase });
    await upsertAutomationMessage({
      daemonUrl,
      projectId,
      conversationId: created.conversationId,
      messageId: assistantMessageId,
      role: 'assistant',
      content: assistantMessageContent,
      agentId,
      agentName: agent.name || agentId,
      runId: run.runId,
      runStatus: 'running',
      startedAt: Date.now(),
    });

    const eventsPath = path.join(outDir, 'run-events.sse');
    let finalStatus = null;
    let files = [];
    let runSummary = null;
    let activeRun = run;
    let activeMessageId = assistantMessageId;
    let activeMessageContent = assistantMessageContent;
    const questionFormRounds = [];
    try {
      for (let questionRound = 0; ; questionRound += 1) {
        finalStatus = await streamRun({
          daemonUrl,
          runId: activeRun.runId,
          eventsPath,
          timeoutMs,
          hardTimeoutMs,
          projectDir: path.join(dataDir, 'projects', projectId),
          artifactWatch: buildArtifactWatchConfig({
            allowArtifactFallback,
            projectDir: path.join(dataDir, 'projects', projectId),
            quietMs: artifactQuietMs,
          }),
        });

        if (finalStatus.status !== 'succeeded') {
          throw new Error(`Open Design run failed: ${JSON.stringify(finalStatus)}`);
        }

        files = finalStatus.completionMode === 'artifact_quiet_fallback'
          ? exportProjectFilesFromDisk({ projectDir: path.join(dataDir, 'projects', projectId), outDir })
          : await exportProjectFiles({ daemonUrl, projectId, outDir });
        runSummary = summarizeOpenDesignEvents(eventsPath);

        if (runSummary.questionForms.length > 0) {
          if (questionRound >= maxQuestionFormRounds) {
            throw new Error(`Open Design emitted ${runSummary.questionForms.length} question form(s) after ${maxQuestionFormRounds} auto-answer round(s). Stop and inspect open-design-run-summary.md before accepting this concept.`);
          }
          const archivedEventsPath = path.join(outDir, `run-events-question-form-round-${questionRound}-${activeRun.runId}.sse`);
          fs.renameSync(eventsPath, archivedEventsPath);
          const answerPrompt = buildQuestionFormAnswerPrompt({
            clientSlug,
            sourceUrl,
            businessType,
            tone,
            scope,
            originalPrompt: prompt,
            questionForms: runSummary.questionForms,
          });
          questionFormRounds.push({
            round: questionRound + 1,
            sourceRunId: activeRun.runId,
            eventsPath: path.relative(outDir, archivedEventsPath),
            questionForms: runSummary.questionForms,
            answerPrompt,
            answeredAt: new Date().toISOString(),
          });
          writeOpenDesignRunState({
            outDir,
            state: {
              ...lifecycleBase,
              status: 'answering_question_form',
              runId: activeRun.runId,
              questionForms: runSummary.questionForms,
              questionFormRounds,
              toolUses: runSummary.toolUses,
              fileChanges: runSummary.fileChanges,
              eventCounts: runSummary.eventCounts,
            },
          });

          activeMessageId = `assistant-question-form-${Date.now()}`;
          activeMessageContent = buildAutomationMessage({
            mode: 'answer-question-form',
            sourceUrl,
            businessType,
            tone,
            scope,
            prompt: answerPrompt,
          });
          await upsertAutomationMessage({
            daemonUrl,
            projectId,
            conversationId: created.conversationId,
            messageId: activeMessageId,
            role: 'assistant',
            content: activeMessageContent,
            agentId,
            agentName: agent.name || agentId,
            runStatus: 'queued',
          });
          activeRun = await postJson(`${daemonUrl}/api/runs`, {
            agentId,
            projectId,
            conversationId: created.conversationId,
            assistantMessageId: activeMessageId,
            clientRequestId: `client-question-form-${Date.now()}`,
            skillId,
            designSystemId,
            model,
            reasoning,
            message: answerPrompt,
          });
          await upsertAutomationMessage({
            daemonUrl,
            projectId,
            conversationId: created.conversationId,
            messageId: activeMessageId,
            role: 'assistant',
            content: activeMessageContent,
            agentId,
            agentName: agent.name || agentId,
            runId: activeRun.runId,
            runStatus: 'running',
            startedAt: Date.now(),
          });
          continue;
        }
        if (!files.length) {
          throw new Error('Open Design run ended without exported files. The agent produced no artifact and no question form was available to auto-answer.');
        }
        break;
      }
      const runEndedAt = new Date();
      writeOpenDesignRunState({
        outDir,
        state: {
          ...lifecycleBase,
          runId: activeRun.runId,
          initialRunId: run.runId,
          status: finalStatus.status || 'unknown',
          nativeCleanFinish: runSummary.nativeCleanFinish && !finalStatus.completionMode,
          completionMode: finalStatus.completionMode || 'native',
          endedAt: runEndedAt.toISOString(),
          durationMs: runEndedAt.getTime() - runStartedAt.getTime(),
          files,
          questionForms: runSummary.questionForms,
          questionFormRounds,
          toolUses: runSummary.toolUses,
          fileChanges: runSummary.fileChanges,
          eventCounts: runSummary.eventCounts,
          audit: null,
        },
      });
      await upsertAutomationMessage({
        daemonUrl,
        projectId,
        conversationId: created.conversationId,
        messageId: activeMessageId,
        role: 'assistant',
        content: appendAutomationResult(activeMessageContent, {
          status: 'succeeded',
          completionMode: finalStatus.completionMode || 'native',
          fileCount: files.length,
        }),
        agentId,
        agentName: agent.name || agentId,
        runId: activeRun.runId,
        runStatus: 'succeeded',
        startedAt: Date.now(),
        endedAt: Date.now(),
        producedFiles: normalizeProducedFilesForOpenDesign(files),
      });
    } catch (error) {
      await upsertAutomationMessage({
        daemonUrl,
        projectId,
        conversationId: created.conversationId,
        messageId: assistantMessageId,
        role: 'assistant',
        content: appendAutomationResult(assistantMessageContent, {
          status: 'failed',
          error: error?.message || String(error),
        }),
        agentId,
        agentName: agent.name || agentId,
        runId: run.runId,
        runStatus: 'failed',
        startedAt: Date.now(),
        endedAt: Date.now(),
      }).catch(() => {});
      throw error;
    }

    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      clientSlug,
      projectId,
      conversationId: created.conversationId,
      runId: run.runId,
      lastRunId: activeRun.runId,
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
      seedDir,
      timeoutPolicy,
      allowArtifactFallback,
      artifactQuietMs,
      maxQuestionFormRounds,
      lifecycle: {
        startedAt: runStartedAt.toISOString(),
        endedAt: new Date().toISOString(),
        nativeCleanFinish: Boolean(runSummary?.nativeCleanFinish && !finalStatus?.completionMode),
        questionForms: runSummary?.questionForms || [],
        questionFormRounds,
        toolUses: runSummary?.toolUses || [],
        fileChanges: runSummary?.fileChanges || [],
      },
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

function buildAutomationMessage({ mode, sourceUrl, businessType, tone, scope, prompt }) {
  return [
    `ProfitsLocal automation: ${mode}`,
    sourceUrl ? `Source website: ${sourceUrl}` : 'Source website: none',
    `Business type: ${businessType}`,
    `Tone: ${tone}`,
    `Scope: ${scope}`,
    '',
    'Prompt:',
    prompt,
  ].join('\n');
}

function appendAutomationResult(baseContent, result) {
  const lines = [baseContent, '', 'Run result:'];
  lines.push(`- status: ${result.status}`);
  if (result.completionMode) lines.push(`- completionMode: ${result.completionMode}`);
  if (typeof result.fileCount === 'number') lines.push(`- files: ${result.fileCount}`);
  if (result.error) lines.push(`- error: ${result.error}`);
  return lines.join('\n');
}

function buildQuestionFormAnswerPrompt({
  clientSlug,
  sourceUrl,
  businessType,
  tone,
  scope,
  originalPrompt,
  questionForms,
}) {
  const formList = (questionForms || []).map((form, index) => [
    `Question form ${index + 1}:`,
    `- id: ${form.id || '(none)'}`,
    `- title: ${form.title || '(none)'}`,
    `- raw: ${trimOneLine(form.raw, 1200)}`,
  ].join('\n')).join('\n\n');
  return [
    'Answer the Open Design question form automatically from the ProfitsLocal lead handoff. Do not wait for human input.',
    '',
    'Use these decisions:',
    `- Client slug: ${clientSlug}`,
    `- Source website: ${sourceUrl || 'none supplied'}`,
    `- Business type: ${businessType || 'local business'}`,
    `- Scope: ${scope || 'one-page or simple multi-page local business website'}`,
    `- Visual tone: ${tone || 'practical, trustworthy, conversion-focused local business'}`,
    '- Primary output: produce customer-facing website concept files, especially index.html and local assets.',
    '- If business facts are missing, use industry-common website structure and generic customer-facing filler, but never invent exact email, phone, address, awards, reviews, or owner names.',
    '- Seeded image assets may already exist in the project under assets/*.png, assets/*.jpg, or assets/*.webp. Treat those as the primary approved imagery.',
    '- Do not replace seeded raster assets with newly drawn SVG illustrations. SVGs are acceptable only for small icons, logos, or simple decoration.',
    '- If images are truly missing, create or use project-local industry-appropriate visual assets; do not ship an image-free text-only page unless explicitly requested.',
    '- Keep internal operations language out of the customer-visible page: no demo/mockup/audit/internal/Resend/verification/final-details wording.',
    '- For redesigns, preserve verified contact, service, navigation, and brand facts, then visibly improve conversion, clarity, trust, mobile CTA, and service presentation.',
    '- Include a contact form UI and a phone CTA when phone facts are available; if phone is unknown, use a clean enquiry form without fake contact facts.',
    '- Continue now and produce files. Ask another question form only if generation is technically impossible.',
    '',
    'Detected question form(s):',
    formList || '- none',
    '',
    'Original build prompt:',
    originalPrompt || '',
  ].join('\n');
}

function normalizeProducedFilesForOpenDesign(files) {
  return (Array.isArray(files) ? files : [])
    .filter((file) => file && typeof file.path === 'string' && file.path.length > 0)
    .map((file) => ({
      name: path.basename(file.path),
      path: file.path,
      size: typeof file.size === 'number' ? file.size : 0,
      mtime: Date.now(),
      kind: file.kind || inferProjectFileKind(file.path),
      mime: file.mime || inferProjectFileMime(file.path),
      ...(file.artifactKind ? { artifactKind: file.artifactKind } : {}),
    }));
}

function inferProjectFileKind(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.html')) return 'html';
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(lower)) return 'image';
  if (/\.(mp4|mov|webm|mkv)$/i.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) return 'audio';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(doc|docx)$/i.test(lower)) return 'document';
  if (/\.(ppt|pptx)$/i.test(lower)) return 'presentation';
  if (/\.(xls|xlsx|csv)$/i.test(lower)) return 'spreadsheet';
  if (/\.(txt|md)$/i.test(lower)) return 'text';
  if (/\.(js|ts|tsx|jsx|json|css|scss|less|astro|py|rb|go|rs|java|php)$/i.test(lower)) return 'code';
  return 'binary';
}

function inferProjectFileMime(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js')) return 'application/javascript';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (/\.(jpg|jpeg)$/i.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
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

function normalizeOpenDesignTimeoutMs({
  agentId,
  skillId,
  mode,
  requestedTimeoutMs,
  allowShortTimeout = false,
}) {
  const timeoutMs = Number(requestedTimeoutMs);
  const isCodexWebPrototype = agentId === 'codex' && skillId === 'web-prototype';
  const minimumTimeoutMs = isCodexWebPrototype ? MIN_CODEX_WEB_PROTOTYPE_TIMEOUT_MS : 0;
  const shouldClamp = !allowShortTimeout && minimumTimeoutMs > 0 && timeoutMs < minimumTimeoutMs;
  return {
    requestedTimeoutMs: timeoutMs,
    timeoutMs: shouldClamp ? minimumTimeoutMs : timeoutMs,
    clamped: shouldClamp,
    reason: shouldClamp
      ? `Codex web-prototype runs in ${mode} mode routinely exceed short timeouts before emitting the final artifact/end event.`
      : null,
    minimumTimeoutMs: minimumTimeoutMs || null,
    allowShortTimeout,
  };
}

function normalizeOpenDesignHardTimeoutMs({
  checkpointMs,
  requestedHardTimeoutMs = 0,
}) {
  const normalizedCheckpointMs = Number(checkpointMs) || DEFAULT_CODEX_WEB_PROTOTYPE_TIMEOUT_MS;
  const requested = Number(requestedHardTimeoutMs) || 0;
  const defaultHardTimeoutMs = normalizedCheckpointMs * DEFAULT_OPEN_DESIGN_HARD_TIMEOUT_MULTIPLIER;
  const minimumHardTimeoutMs = normalizedCheckpointMs + MIN_CODEX_WEB_PROTOTYPE_TIMEOUT_MS;
  const hardTimeoutMs = Math.max(requested || defaultHardTimeoutMs, minimumHardTimeoutMs);
  return {
    requestedHardTimeoutMs: requested || null,
    hardTimeoutMs,
    checkpointMs: normalizedCheckpointMs,
    checkpointIsHardKill: false,
    reason: 'Timeout is a watcher checkpoint; hard timeout is only a final guard against indefinitely hung runs.',
  };
}

function buildArtifactWatchConfig({ allowArtifactFallback = false, projectDir, quietMs }) {
  if (!allowArtifactFallback) return null;
  return { projectDir, quietMs };
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

async function findAvailablePort(startPort) {
  const firstPort = Number(startPort);
  for (let portCandidate = firstPort; portCandidate < firstPort + 100; portCandidate += 1) {
    if (await portIsAvailable(portCandidate)) return portCandidate;
  }
  throw new Error(`Could not find an available Open Design port starting at ${firstPort}.`);
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function healthOk(url) {
  try {
    const response = await fetch(`${url}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function streamRun({ daemonUrl, runId, eventsPath, timeoutMs, hardTimeoutMs, projectDir = '', artifactWatch }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let fallbackStatus = null;
  let artifactTimer = null;
  const checkpointMs = Number(timeoutMs) || DEFAULT_CODEX_WEB_PROTOTYPE_TIMEOUT_MS;
  const finalHardTimeoutMs = Number(hardTimeoutMs) || checkpointMs * DEFAULT_OPEN_DESIGN_HARD_TIMEOUT_MULTIPLIER;
  let nextCheckpointAt = startedAt + checkpointMs;
  let checkpointCount = 0;
  let lastEventAt = startedAt;
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
      const snapshot = scanArtifactQuietSnapshot(artifactWatch.projectDir, artifactWatch.quietMs, {
        minArtifactMtimeMs: startedAt,
      });
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
    streamLoop: while (true) {
      if (Date.now() - startedAt > finalHardTimeoutMs) {
        writer.end();
        throw new Error(`Open Design run hit hard timeout after ${finalHardTimeoutMs}ms: ${runId}`);
      }
      let result;
      try {
        const now = Date.now();
        const waitMs = Math.max(250, Math.min(nextCheckpointAt - now, finalHardTimeoutMs - (now - startedAt)));
        result = await Promise.race([
          reader.read(),
          sleep(waitMs).then(() => ({ checkpoint: true })),
        ]);
      } catch (error) {
        if (fallbackStatus && error?.name === 'AbortError') break;
        throw error;
      }
      if (result?.checkpoint) {
        checkpointCount += 1;
        const decision = await inspectOpenDesignCheckpoint({
          daemonUrl,
          runId,
          eventsPath,
          projectDir: projectDir || artifactWatch?.projectDir || '',
          startedAt,
          checkpointCount,
          checkpointMs,
          lastEventAt,
        });
        if (decision.action === 'return') return decision.status;
        if (decision.action === 'fail') {
          throw new Error(decision.message);
        }
        nextCheckpointAt = Date.now() + checkpointMs;
        continue;
      }
      const { value, done } = result;
      if (done) break;
      lastEventAt = Date.now();
      const chunk = decoder.decode(value, { stream: true });
      writer.write(chunk);
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const parsed = parseSseFrame(frame);
        if (parsed?.event === 'end') {
          finalStatus = parsed.data;
          await reader.cancel().catch(() => {});
          break streamLoop;
        }
      }
    }
  } finally {
    writer.end();
    if (artifactTimer) clearInterval(artifactTimer);
  }
  if (fallbackStatus) return fallbackStatus;
  return finalStatus || await getJson(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}`);
}

async function inspectOpenDesignCheckpoint({
  daemonUrl,
  runId,
  eventsPath,
  projectDir = '',
  startedAt,
  checkpointCount,
  checkpointMs,
  lastEventAt,
}) {
  const now = Date.now();
  const eventSummary = summarizeOpenDesignEvents(eventsPath);
  const projectSnapshot = scanOpenDesignProjectSnapshot(projectDir, {
    minArtifactMtimeMs: startedAt,
  });
  const runStatus = await safeGetRunStatus({ daemonUrl, runId });

  if (eventSummary.nativeCleanFinish) {
    return {
      action: 'return',
      status: runStatus || { status: 'succeeded', code: 0, signal: null },
    };
  }

  if (runStatus?.status && !isActiveRunStatus(runStatus.status)) {
    return {
      action: 'return',
      status: runStatus,
    };
  }

  if (eventSummary.questionForms.length > 0) {
    await safeCancelRun({ daemonUrl, runId });
    return {
      action: 'return',
      status: {
        status: 'succeeded',
        code: 0,
        signal: null,
        completionMode: 'question_form_checkpoint',
        checkpoint: {
          reason: 'question_form_detected',
          checkpointCount,
          questionForms: eventSummary.questionForms.length,
          generatedHtmlCount: projectSnapshot.freshGeneratedHtmlCount,
        },
      },
    };
  }

  const latestArtifactAt = Number(projectSnapshot.latestMtimeMs || 0);
  const lastActivityAt = Math.max(Number(lastEventAt || 0), latestArtifactAt, Number(startedAt || 0));
  const idleForMs = now - lastActivityAt;
  const checkpoint = {
    checkpointCount,
    checkpointMs,
    idleForMs,
    runStatus: runStatus?.status || 'unknown',
    projectSnapshot,
    eventCounts: eventSummary.eventCounts,
  };

  if (projectSnapshot.freshGeneratedHtmlCount > 0) {
    return {
      action: 'continue',
      checkpoint: {
        ...checkpoint,
        reason: 'generated_artifacts_exist_waiting_for_native_end',
      },
    };
  }

  if (idleForMs >= checkpointMs) {
    await sendOpenDesignSpecialAlert({
      title: 'Open Design checkpoint stuck',
      message: `Run ${runId} has no fresh generated HTML and no recent activity after checkpoint ${checkpointCount}.`,
      fields: {
        runId,
        checkpointCount,
        idleForMs,
        reason: projectSnapshot.reason || 'no_fresh_generated_html',
      },
    });
    return {
      action: 'fail',
      message: `Open Design checkpoint ${checkpointCount}: no fresh generated HTML and no activity for ${idleForMs}ms; run is stuck before native finish: ${runId}`,
      checkpoint,
    };
  }

  return {
    action: 'continue',
    checkpoint: {
      ...checkpoint,
      reason: 'recent_activity_waiting_for_native_end',
    },
  };
}

function isActiveRunStatus(status) {
  return ['queued', 'running', 'in_progress', 'processing'].includes(String(status || '').toLowerCase());
}

async function safeGetRunStatus({ daemonUrl, runId }) {
  try {
    return await getJson(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}`);
  } catch {
    return null;
  }
}

async function safeCancelRun({ daemonUrl, runId }) {
  try {
    await postJson(`${daemonUrl}/api/runs/${encodeURIComponent(runId)}/cancel`, {});
  } catch {}
}

async function sendOpenDesignSpecialAlert({ title, message, fields = {} }) {
  const webhookUrl = process.env.SPECIAL_ALERTS_DISCORD_WEBHOOK_URL
    || process.env.OPEN_DESIGN_ALERTS_DISCORD_WEBHOOK_URL
    || process.env.OPS_ALERTS_DISCORD_WEBHOOK_URL
    || '';
  if (!webhookUrl) return false;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `**${title}**\n${message}`,
        embeds: [{
          title,
          description: message,
          fields: Object.entries(fields).map(([name, value]) => ({
            name,
            value: String(value).slice(0, 1024) || '-',
            inline: true,
          })),
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
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

function summarizeOpenDesignEvents(eventsPath) {
  const summary = {
    nativeCleanFinish: false,
    questionForms: [],
    toolUses: [],
    fileChanges: [],
    eventCounts: {},
  };
  if (!fs.existsSync(eventsPath)) return summary;
  const text = fs.readFileSync(eventsPath, 'utf8');
  const frames = text.split(/\n\n+/).filter(Boolean);
  for (const frame of frames) {
    const parsed = parseSseFrame(frame);
    const eventName = parsed?.event || 'message';
    summary.eventCounts[eventName] = (summary.eventCounts[eventName] || 0) + 1;
    if (eventName === 'end') summary.nativeCleanFinish = true;
    const payloadText = payloadToText(parsed?.data);
    for (const form of extractQuestionForms(payloadText)) {
      summary.questionForms.push(form);
    }
    const rawPayload = parsed?.data?.type === 'raw' && typeof parsed?.data?.line === 'string'
      ? tryParseJson(parsed.data.line)
      : null;
    const item = rawPayload?.item || parsed?.data?.item || parsed?.data;
    if (item?.type === 'tool_use' || parsed?.data?.type === 'tool_use') {
      const tool = item?.name || parsed?.data?.name || 'unknown';
      summary.toolUses.push({
        tool,
        inputPreview: trimOneLine(JSON.stringify(item?.input || parsed?.data?.input || {}), 240),
      });
    }
    if (item?.type === 'file_change') {
      summary.fileChanges.push(...(item.changes || []).map((change) => ({
        path: change.path || '',
        kind: change.kind || '',
        status: item.status || '',
      })));
    }
  }
  summary.questionForms = uniqueBy(summary.questionForms, (item) => `${item.id}:${item.title}:${item.raw.slice(0, 120)}`);
  summary.toolUses = summary.toolUses.slice(0, 80);
  summary.fileChanges = uniqueBy(summary.fileChanges, (item) => `${item.path}:${item.kind}:${item.status}`).slice(0, 80);
  return summary;
}

function extractQuestionForms(text) {
  if (!text || !text.includes('<question-form')) return [];
  const forms = [];
  const re = /<question-form\b([\s\S]*?)<\/question-form>/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const attrs = match[1] || '';
    forms.push({
      id: attrValue(attrs, 'id') || '',
      title: attrValue(attrs, 'title') || '',
      raw: raw.slice(0, 4000),
      aiAnswerPolicy: 'Use ready-to-build.websiteBuildHandoff.openDesignPayload.questionnaireAnswers plus the project brief; answer only design/process questions and never invent contact facts.',
    });
  }
  return forms;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function attrValue(attrs, name) {
  const match = new RegExp(`${name}=["']([^"']+)["']`, 'i').exec(attrs);
  return match?.[1] || '';
}

function payloadToText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.content === 'string') return value.content;
  if (typeof value.line === 'string') return value.line;
  if (value.item) return payloadToText(value.item);
  return JSON.stringify(value);
}

function trimOneLine(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function writeOpenDesignRunState({ outDir, state }) {
  writeJson(path.join(outDir, 'open-design-run-state.json'), state);
  fs.writeFileSync(path.join(outDir, 'open-design-run-summary.md'), renderOpenDesignRunSummary(state));
}

function renderOpenDesignRunSummary(state) {
  return [
    `# Open Design Run: ${state.clientSlug}`,
    '',
    `- Project: ${state.projectId}`,
    `- Run: ${state.runId}`,
    `- Status: ${state.status}`,
    `- Native clean finish: ${state.nativeCleanFinish ? 'yes' : 'no'}`,
    `- Completion mode: ${state.completionMode || 'pending'}`,
    `- Started: ${state.startedAt || ''}`,
    `- Ended: ${state.endedAt || ''}`,
    `- Duration ms: ${state.durationMs ?? ''}`,
    `- Files: ${(state.files || []).map((file) => file.path).join(', ') || 'none yet'}`,
    `- Question forms: ${(state.questionForms || []).length}`,
    `- Question form auto-answer rounds: ${(state.questionFormRounds || []).length}`,
    '',
    '## Question Forms',
    ...(state.questionForms || []).map((form) => `- ${form.id || '(no id)'} ${form.title || ''}`.trim()),
    '',
    '## Question Form Auto Answers',
    ...(state.questionFormRounds || []).map((round) => `- round ${round.round}: answered ${round.questionForms?.length || 0} form(s), archived events ${round.eventsPath || ''}`),
    '',
    '## Tool Uses',
    ...(state.toolUses || []).slice(0, 25).map((tool) => `- ${tool.tool}: ${tool.inputPreview || ''}`),
    '',
    '## File Changes',
    ...(state.fileChanges || []).slice(0, 25).map((change) => `- ${change.kind || 'change'} ${change.path || ''} ${change.status || ''}`.trim()),
    '',
  ].join('\n');
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

async function putJson(url, body) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`PUT ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function upsertAutomationMessage({
  daemonUrl,
  projectId,
  conversationId,
  messageId,
  role,
  content,
  agentId,
  agentName,
  runId,
  runStatus,
  startedAt,
  endedAt,
  producedFiles,
}) {
  const url = `${daemonUrl}/api/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`;
  const body = {
    id: messageId,
    role,
    content,
    agentId,
    agentName,
    runId: runId ?? null,
    runStatus: runStatus ?? null,
    startedAt: startedAt ?? null,
    endedAt: endedAt ?? null,
    producedFiles: Array.isArray(producedFiles) ? producedFiles : null,
  };
  return putJson(url, body);
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

function seedProjectFiles({ seedDir, projectDir }) {
  if (!seedDir || !fs.existsSync(seedDir)) {
    throw new Error(`Seed dir not found: ${seedDir}`);
  }
  for (const source of listFilesRecursive(seedDir)) {
    const rel = path.relative(seedDir, source);
    const target = path.join(projectDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
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
  return /(^|\/)source-[^/]+\.html$/i.test(normalized)
    || /(^|\/)source\/[^/]+\.html$/i.test(normalized);
}

function scanArtifactQuietSnapshot(projectDir, quietMs, options = {}) {
  const files = listFilesRecursive(projectDir);
  const html = files.filter((file) => file.endsWith('.html'));
  const generatedHtml = html.filter((file) => !isSourceCaptureHtml(file));
  const minArtifactMtimeMs = Number(options.minArtifactMtimeMs || 0);
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
  if (minArtifactMtimeMs && latestMtimeMs < minArtifactMtimeMs) {
    return {
      ready: false,
      reason: 'stale_artifacts',
      htmlCount: html.length,
      generatedHtmlCount: generatedHtml.length,
      latestMtimeMs,
      minArtifactMtimeMs,
    };
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

function scanOpenDesignProjectSnapshot(projectDir, options = {}) {
  if (!projectDir || !fs.existsSync(projectDir)) {
    return {
      ready: false,
      reason: 'project_dir_missing',
      fileCount: 0,
      htmlCount: 0,
      generatedHtmlCount: 0,
      freshGeneratedHtmlCount: 0,
      latestMtimeMs: 0,
    };
  }
  const files = listFilesRecursive(projectDir);
  const html = files.filter((file) => file.endsWith('.html'));
  const generatedHtml = html.filter((file) => !isSourceCaptureHtml(file));
  const minArtifactMtimeMs = Number(options.minArtifactMtimeMs || 0);
  let latestMtimeMs = 0;
  let freshGeneratedHtmlCount = 0;
  for (const file of files) {
    const stats = fs.statSync(file);
    latestMtimeMs = Math.max(latestMtimeMs, stats.mtimeMs);
    if (generatedHtml.includes(file) && (!minArtifactMtimeMs || stats.mtimeMs >= minArtifactMtimeMs)) {
      freshGeneratedHtmlCount += 1;
    }
  }
  return {
    ready: freshGeneratedHtmlCount > 0,
    reason: freshGeneratedHtmlCount > 0
      ? 'fresh_generated_html_present'
      : generatedHtml.length
        ? 'generated_html_stale'
        : html.length
          ? 'source_only_html_present'
          : 'generated_artifacts_missing',
    fileCount: files.length,
    htmlCount: html.length,
    generatedHtmlCount: generatedHtml.length,
    freshGeneratedHtmlCount,
    cssCount: files.filter((file) => file.endsWith('.css')).length,
    latestMtimeMs,
    minArtifactMtimeMs: minArtifactMtimeMs || null,
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
  seedProjectFiles,
  listFilesRecursive,
  isSourceCaptureHtml,
  scanArtifactQuietSnapshot,
  scanOpenDesignProjectSnapshot,
  inspectOpenDesignCheckpoint,
  normalizeOpenDesignHardTimeoutMs,
  summarizeOpenDesignEvents,
  extractQuestionForms,
  writeOpenDesignRunState,
  normalizeOpenDesignTimeoutMs,
  buildArtifactWatchConfig,
  buildAutomationMessage,
  appendAutomationResult,
  normalizeProducedFilesForOpenDesign,
  buildQuestionFormAnswerPrompt,
  upsertAutomationMessage,
};
