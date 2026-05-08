import fs from 'fs';
import path from 'path';
import { artifactTimestamp } from '../time.js';
import { normalizeOutreachArtifactState } from './outreach-provider-state.js';
import { buildCaseReference, recordCaseNotification } from '../cases/case-file.js';
import { updateForumWorkspaceStage } from './discord-workspace.js';
import { buildDiscordMessage, sendDiscordChannelMessage } from './discord.js';

export async function syncOutreachProviderEvent(payload, options = {}) {
  const provider = String(payload.provider || 'agentic-email').toLowerCase();
  const clientSlug = String(payload.client_slug || payload.clientSlug || '').trim();
  if (!clientSlug) {
    return { ok: false, error: 'client_slug is required' };
  }

  const artifactPath = resolveArtifactPath(clientSlug, payload, options);
  if (!artifactPath) {
    return { ok: false, error: `No outreach email artifact found for ${clientSlug}` };
  }

  const artifact = readJson(artifactPath);
  const event = payload.event && typeof payload.event === 'object' ? payload.event : payload;
  const leadWorkspace = normalizeLeadWorkspace(payload.lead_workspace || payload.leadWorkspace || artifact.leadWorkspace || null);
  const nextSendResult = buildUpdatedSendResult({ artifact, provider, event });
  const nextArtifact = {
    ...artifact,
    provider,
    providerEvent: event,
    leadWorkspace,
    sendResult: nextSendResult,
    updatedAt: artifactTimestamp(),
  };

  if (!options.dryRun) {
    writeJson(artifactPath, nextArtifact);
  }

  const outreachState = normalizeOutreachArtifactState(nextArtifact);
  let caseSync = { ok: false, skipped: true, reason: 'case_not_found' };
  const caseRecord = findLatestCaseRecord(clientSlug, payload.order_id || payload.orderId || '', options.casesDir || 'data/cases');
  if (caseRecord?.paths?.casePath) {
    caseSync = recordCaseNotification(caseRecord.paths, {
      type: 'outreach_provider_event_received',
      kind: 'sale',
      ok: true,
      channel: provider,
      reason: `${outreachState.status || 'event'}:${outreachState.lastEventType || 'unknown'}`,
    }, {
      dryRun: options.dryRun,
    });
  }

  let forumSync = { ok: false, skipped: true, reason: 'missing_workspace_or_discord_config' };
  const workspace = resolveWorkspace({ leadWorkspace, caseSync, caseRecord });
  if (workspace.threadId && workspace.channelId && (options.discordBotToken || options.env?.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN)) {
    const order = {
      clientSlug,
      company: payload.company || caseRecord?.customer?.company || artifact.businessName || clientSlug,
      replyState: outreachState.replyState,
      bounceState: outreachState.bounceState,
      nextFollowUpDue: outreachState.nextFollowUpDue,
      paymentStatus: payload.payment_status || caseRecord?.order?.paymentStatus || '',
    };
    const botToken = options.discordBotToken || options.env?.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const messagePayload = buildLeadOutreachDiscordMessage({ clientSlug, provider, outreachState, payload });
    let threadMessage = { ok: false, skipped: true };
    if (options.sendDiscord !== false) {
      threadMessage = await sendDiscordChannelMessage({
        channelId: workspace.threadId,
        botToken,
        payload: messagePayload,
        fetchImpl: options.fetchImpl || fetch,
      });
    }
    const stage = await updateForumWorkspaceStage({
      workspace: 'leads',
      threadId: workspace.threadId,
      channelId: workspace.channelId,
      botToken,
      kind: 'lead',
      order,
      fetchImpl: options.fetchImpl || fetch,
    });
    forumSync = {
      ok: true,
      workspace,
      threadMessage,
      stage,
    };
    if (caseRecord?.paths?.casePath) {
      caseSync = recordCaseNotification(caseRecord.paths, {
        type: 'lead_workspace_outreach_updated',
        kind: 'sale',
        ok: true,
        channel: 'discord',
        reason: `${provider}:${outreachState.status || 'event'}`,
        discord: {
          ok: true,
          channelId: workspace.threadId,
          threadId: workspace.threadId,
          workspaceChannelId: workspace.channelId,
          threadStyle: 'forum_post',
          threadName: stage?.threadName || workspace.name || '',
          appliedTagIds: stage?.appliedTagIds || workspace.tagIds || [],
          messageId: threadMessage?.messageId || '',
          messageUrl: threadMessage?.messageUrl || '',
          threadUrl: workspace.threadUrl || '',
        },
      }, {
        dryRun: options.dryRun,
      });
    }
  }

  return {
    ok: true,
    provider,
    clientSlug,
    artifactPath,
    outreachState,
    leadWorkspace,
    caseSync,
    forumSync,
  };
}

function buildUpdatedSendResult({ artifact, provider, event }) {
  const current = artifact.sendResult && typeof artifact.sendResult === 'object' ? artifact.sendResult : {};
  return {
    ...current,
    provider,
    sourceSystem: current.sourceSystem || provider,
    status: event.status || event.eventType || event.event_type || current.status || '',
    sentAt: current.sentAt || event.sentAt || event.sent_at || '',
    id: current.id || current.sendId || '',
    externalCampaignId: event.externalCampaignId || event.campaignId || current.externalCampaignId || current.campaignId || '',
    externalLeadId: event.externalLeadId || event.leadId || event.leadEmail || current.externalLeadId || current.leadId || '',
    externalMessageId: event.externalMessageId || event.messageId || current.externalMessageId || current.messageId || '',
    externalThreadUrl: event.externalThreadUrl || event.threadUrl || event.inboxUrl || event.mailboxUrl || current.externalThreadUrl || current.threadUrl || '',
    replyState: event.replyState || event.reply_state || current.replyState || '',
    nextFollowUpDue: event.nextFollowUpDue || event.next_follow_up_due || current.nextFollowUpDue || '',
    bounceState: event.bounceState || event.bounce_state || current.bounceState || '',
    lastEventType: event.eventType || event.event_type || event.status || current.lastEventType || '',
    lastEventAt: event.lastEventAt || event.last_event_at || event.timestamp || current.lastEventAt || '',
    replySnippet: event.replySnippet || event.reply_snippet || current.replySnippet || '',
  };
}

function buildLeadOutreachDiscordMessage({ clientSlug, provider, outreachState, payload }) {
  const order = {
    clientSlug,
    company: payload.company || clientSlug,
    email: payload.lead_email || payload.email || '',
    feedback: outreachState.replySnippet || '',
  };
  const base = buildDiscordMessage({ kind: 'sale', order, task: null });
  const statusLabel = outreachState.replyState === 'replied'
    ? 'Lead replied'
    : outreachState.bounceState === 'bounced'
      ? 'Lead bounced'
      : outreachState.nextFollowUpDue
        ? 'Follow-up scheduled'
        : `Lead ${outreachState.status || 'event'}`;
  return {
    username: 'ProfitsLocal Leads',
    embeds: [{
      ...(base.embeds?.[0] || {}),
      title: `${statusLabel}: ${order.company || clientSlug}`,
      color: outreachState.replyState === 'replied' ? 0x2ecc71 : outreachState.bounceState === 'bounced' ? 0xe74c3c : 0x3498db,
      fields: [
        { name: 'Client', value: clientSlug, inline: true },
        { name: 'Provider', value: provider, inline: true },
        { name: 'Status', value: outreachState.status || 'unknown', inline: true },
        ...(outreachState.nextFollowUpDue ? [{ name: 'Next follow-up', value: outreachState.nextFollowUpDue, inline: false }] : []),
        ...(outreachState.replySnippet ? [{ name: 'Reply snippet', value: outreachState.replySnippet.slice(0, 900), inline: false }] : []),
      ],
      timestamp: outreachState.lastEventAt || new Date().toISOString(),
    }],
  };
}

function resolveWorkspace({ leadWorkspace, caseSync, caseRecord }) {
  const caseDiscord = caseSync?.caseFile?.discord || caseRecord?.discord || {};
  return {
    threadId: leadWorkspace.threadId || caseDiscord.salesThreadId || '',
    channelId: leadWorkspace.channelId || caseDiscord.salesWorkspaceChannelId || '',
    name: leadWorkspace.name || caseDiscord.salesWorkspaceName || '',
    tagIds: leadWorkspace.tagIds || caseDiscord.salesWorkspaceTagIds || [],
    threadUrl: leadWorkspace.threadUrl || caseDiscord.lastThreadUrl || '',
  };
}

function normalizeLeadWorkspace(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    threadId: raw.threadId || raw.salesThreadId || '',
    channelId: raw.channelId || raw.salesWorkspaceChannelId || '',
    name: raw.name || raw.salesWorkspaceName || '',
    tagIds: raw.tagIds || raw.salesWorkspaceTagIds || [],
    threadUrl: raw.threadUrl || '',
  };
}

function resolveArtifactPath(clientSlug, payload, options) {
  const explicit = payload.artifact_path || payload.artifactPath || '';
  if (explicit && fs.existsSync(explicit)) return explicit;
  const emailDir = path.join(options.clientsRoot || 'clients', clientSlug, 'outreach', 'email');
  if (!fs.existsSync(emailDir)) return '';
  return fs.readdirSync(emailDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(emailDir, file))
    .sort((a, b) => String(readJsonSafe(b)?.generatedAt || '').localeCompare(String(readJsonSafe(a)?.generatedAt || '')))[0] || '';
}

function findLatestCaseRecord(clientSlug, orderId, casesRoot) {
  if (!clientSlug) return null;
  if (orderId) {
    const ref = buildCaseReference({ clientSlug, orderId }, { casesDir: casesRoot });
    const caseFile = readJsonSafe(ref.casePath);
    if (caseFile) return { ...caseFile, paths: caseFile.paths || ref };
  }
  const clientDir = path.join(casesRoot, clientSlug);
  if (!fs.existsSync(clientDir)) return null;
  const candidates = fs.readdirSync(clientDir)
    .map((id) => path.join(clientDir, id, 'case.json'))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ file, json: readJsonSafe(file) }))
    .filter((entry) => entry.json)
    .sort((a, b) => String(b.json.updatedAt || '').localeCompare(String(a.json.updatedAt || '')));
  if (!candidates.length) return null;
  return candidates[0].json;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
