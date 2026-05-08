import fs from 'fs';
import path from 'path';
import { artifactTimestamp } from '../time.js';
import { sendDiscordChannelMessage } from './discord.js';
import { updateForumWorkspaceStage } from './discord-workspace.js';
import { recordCaseNotification, buildCaseReference } from '../cases/case-file.js';

export function readLeadNotes(clientSlug, { clientsRoot = 'clients' } = {}) {
  const notesPath = path.join(clientsRoot, clientSlug, 'outreach', 'lead-notes.jsonl');
  if (!fs.existsSync(notesPath)) return [];
  return fs.readFileSync(notesPath, 'utf8')
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function recordLeadNote(payload, options = {}) {
  const clientSlug = String(payload.client_slug || payload.clientSlug || '').trim();
  if (!clientSlug) return { ok: false, error: 'client_slug is required' };
  const note = String(payload.note || '').trim();
  if (!note) return { ok: false, error: 'note is required' };

  const createdAt = payload.created_at || payload.createdAt || artifactTimestamp();
  const nextFollowUpDue = String(payload.next_follow_up_due || payload.nextFollowUpDue || '').trim();
  const actor = String(payload.actor || 'profitslocal-admin').trim();
  const action = String(payload.action || '').trim();
  const noteEntry = {
    id: `lead_note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: action ? 'lead_decision' : 'lead_note',
    action,
    actor,
    note,
    nextFollowUpDue,
    createdAt,
  };

  const notesPath = path.join(options.clientsRoot || 'clients', clientSlug, 'outreach', 'lead-notes.jsonl');
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(notesPath), { recursive: true });
    fs.appendFileSync(notesPath, `${JSON.stringify(noteEntry)}\n`, 'utf8');
  }

  const caseRecord = findLatestCaseRecord(clientSlug, payload.order_id || payload.orderId || '', options.casesDir || 'data/cases');
  let caseSync = { ok: false, skipped: true, reason: 'case_not_found' };
  if (caseRecord?.paths?.casePath) {
    caseSync = recordCaseNotification(caseRecord.paths, {
      type: 'lead_note_recorded',
      kind: 'sale',
      ok: true,
      channel: 'admin',
      reason: nextFollowUpDue ? `lead_note:${nextFollowUpDue}` : 'lead_note',
      note,
    }, { dryRun: options.dryRun });
  }

  let forumSync = { ok: false, skipped: true, reason: 'missing_workspace_or_discord_config' };
  const workspace = resolveWorkspace(payload, caseRecord);
  const botToken = options.discordBotToken || options.env?.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
  if (workspace.threadId && workspace.channelId && botToken) {
    if (options.sendDiscord !== false) {
      const discord = await sendDiscordChannelMessage({
        channelId: workspace.threadId,
        botToken,
        fetchImpl: options.fetchImpl || fetch,
        payload: {
          username: 'ProfitsLocal Leads',
          embeds: [{
            title: `Lead note: ${payload.company || caseRecord?.customer?.company || clientSlug}`,
            color: 0xf39c12,
            fields: [
              { name: 'Client', value: clientSlug, inline: true },
              { name: 'Actor', value: actor, inline: true },
              ...(nextFollowUpDue ? [{ name: 'Next follow-up', value: nextFollowUpDue, inline: false }] : []),
              { name: 'Note', value: note.slice(0, 1000), inline: false },
            ],
            timestamp: createdAt,
          }],
        },
      });
      forumSync.discord = discord;
    }
    const stage = await updateForumWorkspaceStage({
      workspace: 'leads',
      threadId: workspace.threadId,
      channelId: workspace.channelId,
      botToken,
      kind: 'lead',
      order: {
        clientSlug,
        company: payload.company || caseRecord?.customer?.company || clientSlug,
        nextFollowUpDue,
        replyState: '',
        bounceState: '',
        paymentStatus: caseRecord?.order?.paymentStatus || '',
      },
      fetchImpl: options.fetchImpl || fetch,
    });
    forumSync = { ok: true, workspace, stage, ...(forumSync.discord ? { discord: forumSync.discord } : {}) };
  }

  return {
    ok: true,
    noteEntry,
    notesPath,
    caseSync,
    forumSync,
  };
}

function resolveWorkspace(payload, caseRecord) {
  const discord = caseRecord?.discord || {};
  const raw = payload.lead_workspace || payload.leadWorkspace || {};
  return {
    threadId: raw.threadId || discord.salesThreadId || '',
    channelId: raw.channelId || discord.salesWorkspaceChannelId || '',
  };
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

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
