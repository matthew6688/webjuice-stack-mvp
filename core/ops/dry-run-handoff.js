import fs from 'fs';
import path from 'path';
import {
  buildForumThreadName,
  buildWebsiteAgentHandoffMessage,
  defaultDiscordForumBlueprints,
  desiredForumTagNames,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
  syncDiscordForumTags,
  updateDiscordThread,
} from '../funnel/discord.js';
import { recordCaseNotification } from '../cases/case-file.js';

export async function dispatchDryRunHandoff(options = {}) {
  const {
    clientSlug = '',
    orderId = '',
    caseDir = '',
    env = process.env,
    send = false,
    fetchImpl = fetch,
    mention = env.WEBSITE_AGENT_MENTION || '',
    action = '',
  } = options;

  const resolvedCaseDir = caseDir || path.join('data', 'cases', safeId(clientSlug), safeId(orderId));
  const paths = {
    caseDir: resolvedCaseDir,
    casePath: path.join(resolvedCaseDir, 'case.json'),
    checklistPath: path.join(resolvedCaseDir, 'ops-checklist.json'),
    handoffPath: path.join(resolvedCaseDir, 'website-handoff.json'),
    taskDraftPath: path.join(resolvedCaseDir, 'agent-task-draft.json'),
    outputPath: path.join(resolvedCaseDir, 'website-handoff-dispatch.json'),
  };

  const caseFile = readJson(paths.casePath, '缺少 case.json，无法发送 handoff。');
  const checklist = readJson(paths.checklistPath, '缺少 ops-checklist.json，无法判断项目状态。');
  const handoff = readJson(paths.handoffPath, '缺少 website-handoff.json，无法构建 handoff。');
  const task = readJson(paths.taskDraftPath, '缺少 agent-task-draft.json，无法构建 agent handoff。');

  const ready = checklist.status === 'ready_for_customer_review';
  const output = {
    ok: ready,
    send,
    ready,
    clientSlug: caseFile.clientSlug || handoff.clientSlug || clientSlug,
    orderId: caseFile.order?.id || handoff.orderId || orderId,
    repo: caseFile.repo || handoff.repo || '',
    previewUrl: caseFile.previewUrl || handoff.previewUrl || '',
    casePath: paths.casePath,
    checklistPath: paths.checklistPath,
    handoffPath: paths.handoffPath,
    taskDraftPath: paths.taskDraftPath,
    status: checklist.status || 'unknown',
    threadName: handoff.businessName || caseFile.customer?.company || caseFile.clientSlug || 'website-task',
    message: '',
    dispatch: { ok: false, skipped: true, reason: ready ? 'send_disabled' : 'not_ready_for_customer_review' },
  };

  if (!ready) {
    output.message = 'ops-checklist 还没有达到 ready_for_customer_review，禁止发送 Discord handoff。';
    writeJson(paths.outputPath, output);
    return output;
  }

  const websiteTask = {
    ...task,
    taskPath: paths.taskDraftPath,
    case: {
      casePath: caseFile.paths?.casePath || paths.casePath,
      contextPath: caseFile.paths?.contextPath || task.case?.contextPath || '',
      buildPacketPath: caseFile.paths?.buildPacketPath || task.case?.buildPacketPath || handoff.buildPacketPath || '',
    },
  };

  const payload = buildWebsiteAgentHandoffMessage({
    kind: task.kind || task.type || 'sale',
    order: {
      clientSlug: caseFile.clientSlug,
      repo: caseFile.repo,
      orderId: caseFile.order?.id,
      previewUrl: caseFile.previewUrl,
      company: caseFile.customer?.company || handoff.businessName || '',
    },
    task: websiteTask,
    caseRecord: { ref: websiteTask.case },
    mention,
    action: action || '请先阅读 case/context/build packet/website survey，再继续当前项目。这个项目已经达到客户 review 前的内部完成状态；如需继续视觉方案，请复用现有 Open Design project，不要新开项目。完成后只更新 dev，并把结果回写到同一个 Discord thread。',
  });

  output.payload = payload;
  output.parentPayload = {
    content: `Website task: ${handoff.businessName || caseFile.customer?.company || caseFile.clientSlug}\n状态：ready_for_customer_review\nPreview：${caseFile.previewUrl || handoff.previewUrl || 'N/A'}`,
    allowed_mentions: { parse: [] },
  };

  if (send) {
    const channelId = env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || env.WEBSITE_TASKS_DISCORD_CHANNEL_ID || '';
    const botToken = env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN || '';
    if (!channelId || !botToken || !mention) {
      output.ok = false;
      output.dispatch = {
        ok: false,
        skipped: true,
        reason: 'missing_website_tasks_config',
        needs: ['WEBSITE_TASKS_DISCORD_CHANNEL_ID', 'WEBSITE_TASKS_DISCORD_BOT_TOKEN', 'WEBSITE_AGENT_MENTION'],
      };
      output.message = '缺少 Discord website handoff 配置，无法正式发送。';
      writeJson(paths.outputPath, output);
      return output;
    }

    const existingThreadId = caseFile.discord?.websiteTaskThreadId || '';
    const threadName = buildForumThreadName({
      workspace: 'projects',
      kind: task.kind || task.type || 'sale',
      order: {
        ...task.order,
        ...caseFile.customer,
        clientSlug: caseFile.clientSlug,
        company: caseFile.customer?.company || handoff.businessName || '',
        template: caseFile.template || '',
      },
      caseFile,
      revision: caseFile.revision || null,
    });
    const forumTags = await resolveForumTagIds({
      channelId,
      botToken,
      fetchImpl,
      workspace: 'projects',
      kind: task.kind || task.type || 'sale',
      order: {
        ...task.order,
        ...caseFile.customer,
        clientSlug: caseFile.clientSlug,
        company: caseFile.customer?.company || handoff.businessName || '',
        template: caseFile.template || '',
      },
      caseFile,
    });
    const dispatch = existingThreadId
      ? await sendExistingWorkspaceMessage({
        existingThreadId,
        botToken,
        payload,
        threadName,
        forumTags,
        fetchImpl,
      })
      : await sendDiscordThreadedMessage({
        channelId,
        botToken,
        payload,
        threadName,
        forumTagIds: forumTags,
        parentPayload: output.parentPayload,
        fetchImpl,
      });

    if (existingThreadId) {
      dispatch.threadId = existingThreadId;
      dispatch.threadReused = true;
    }

    const record = recordCaseNotification(caseFile.paths || { casePath: paths.casePath }, {
      type: 'website_agent_handoff_sent',
      kind: 'website_task',
      ok: true,
      channel: 'discord',
      reason: 'ops_dispatch_ready_for_customer_review',
      discord: dispatch,
    });

    output.dispatch = { ok: true, ...dispatch };
    output.caseRecord = {
      ok: record.ok,
      casePath: record.caseFile?.paths?.casePath || paths.casePath,
      websiteTaskThreadId: record.caseFile?.discord?.websiteTaskThreadId || dispatch.threadId || '',
      lastMessageUrl: record.caseFile?.discord?.lastMessageUrl || dispatch.messageUrl || '',
    };
    output.message = dispatch.threadId
      ? 'Discord website handoff 已发送，并且 case 已记录 thread。'
      : 'Discord website handoff 已发送，但没有拿到 threadId。';
  } else {
    output.message = 'Dry-run only：已生成可发送的 Discord handoff payload。';
  }

  writeJson(paths.outputPath, output);
  return output;
}

async function sendExistingWorkspaceMessage({
  existingThreadId,
  botToken,
  payload,
  threadName,
  forumTags,
  fetchImpl,
}) {
  const dispatch = await sendDiscordChannelMessage({
    channelId: existingThreadId,
    botToken,
    payload,
    fetchImpl,
  });
  try {
    await updateDiscordThread({
      threadId: existingThreadId,
      botToken,
      name: threadName,
      appliedTagIds: forumTags,
      fetchImpl,
    });
  } catch (error) {
    dispatch.metadataUpdateError = error.message || String(error);
  }
  dispatch.threadName = threadName;
  dispatch.appliedTagIds = forumTags;
  return dispatch;
}

async function resolveForumTagIds({
  channelId,
  botToken,
  fetchImpl,
  workspace,
  kind,
  order,
  caseFile,
}) {
  try {
    const blueprints = defaultDiscordForumBlueprints();
    const config = await syncDiscordForumTags({
      channelId,
      botToken,
      tags: blueprints[workspace] || [],
      fetchImpl,
    });
    return desiredForumTagNames({ workspace, kind, order, caseFile }).map((name) => config.tagsByName[name]).filter(Boolean);
  } catch {
    return [];
  }
}

function readJson(filePath, errorMessage) {
  if (!fs.existsSync(filePath)) throw new Error(errorMessage);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}
