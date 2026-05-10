import fs from 'fs';
import path from 'path';

export async function fetchDiscordThreadMessages({
  threadId,
  botToken,
  limit = 50,
  fetchImpl = fetch,
} = {}) {
  if (!threadId) throw new Error('threadId is required');
  if (!botToken) throw new Error('botToken is required');
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${threadId}/messages?limit=${Number(limit) || 50}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
      'User-Agent': 'profitslocal-discord-thread-sync',
    },
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Discord thread fetch failed: ${response.status} ${text}`.trim());
  const messages = text ? JSON.parse(text) : [];
  return [...messages].reverse().map(normalizeThreadMessage);
}

export async function fetchDiscordThreadInfo({
  threadId,
  botToken,
  fetchImpl = fetch,
} = {}) {
  if (!threadId) throw new Error('threadId is required');
  if (!botToken) throw new Error('botToken is required');
  const response = await fetchImpl(`https://discord.com/api/v10/channels/${threadId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
      'User-Agent': 'profitslocal-discord-thread-sync',
    },
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Discord thread info fetch failed: ${response.status} ${text}`.trim());
  return text ? JSON.parse(text) : {};
}

export function buildDiscordThreadSnapshot({
  clientSlug,
  thread,
  messages,
  syncedAt = new Date().toISOString(),
} = {}) {
  const threadId = thread?.id || '';
  const guildId = thread?.guild_id || '';
  const summaryMessages = (messages || []).filter((message) => (
    message.content
    && !/^💾 Memory updated/i.test(message.content)
    && !isToolEcho(message.content)
  ));
  return {
    schemaVersion: 1,
    clientSlug,
    syncedAt,
    thread: {
      id: threadId,
      parentId: thread?.parent_id || '',
      name: thread?.name || '',
      url: guildId && threadId ? `https://discord.com/channels/${guildId}/${threadId}` : '',
      messageCount: thread?.message_count || messages?.length || 0,
    },
    latestSummary: summarizeMessages(summaryMessages),
    messages: summaryMessages.slice(-20),
  };
}

export function writeDiscordThreadSnapshot(snapshot, {
  clientsRoot = 'clients',
} = {}) {
  if (!snapshot?.clientSlug) throw new Error('clientSlug is required');
  const filePath = path.join(clientsRoot, snapshot.clientSlug, 'lead', 'discord-thread.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function normalizeThreadMessage(message) {
  const attachments = (message.attachments || []).map((attachment) => ({
    filename: attachment.filename || '',
    url: attachment.url || '',
    contentType: attachment.content_type || '',
  }));
  return {
    id: message.id || '',
    createdAt: message.timestamp || '',
    author: message.author?.username || '',
    authorId: message.author?.id || '',
    bot: Boolean(message.author?.bot),
    content: String(message.content || '').trim(),
    attachments,
  };
}

function summarizeMessages(messages) {
  const useful = messages
    .filter((message) => message.content && !isToolEcho(message.content))
    .slice(-4)
    .map((message) => `${message.author}: ${message.content.replace(/\s+/g, ' ').slice(0, 260)}`);
  return useful.join('\n');
}

function isToolEcho(content) {
  return /^(💻 terminal:|🌐 browser_|🔎 search_files:|📖 read_file:|📸 browser_snapshot|💾 Memory updated)/i.test(String(content || '').trim());
}
