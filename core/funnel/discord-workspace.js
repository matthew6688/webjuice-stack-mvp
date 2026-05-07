import {
  buildForumThreadName,
  defaultDiscordForumBlueprints,
  desiredForumTagNames,
  sendDiscordChannelMessage,
  sendDiscordThreadedMessage,
  syncDiscordForumTags,
  updateDiscordThread,
} from './discord.js';

export async function createOrUpdateForumWorkspace({
  workspace,
  channelId,
  botToken,
  payload,
  existingThreadId = '',
  kind = '',
  order = {},
  caseFile = null,
  revision = null,
  fetchImpl = fetch,
  parentPayload = null,
}) {
  const forumTagIds = await resolveForumTagIds({
    workspace,
    channelId,
    botToken,
    kind,
    order,
    caseFile,
    revision,
    fetchImpl,
  });
  const threadName = buildForumThreadName({ workspace, kind, order, caseFile, revision });

  const dispatch = existingThreadId
    ? await sendDiscordChannelMessage({
      channelId: existingThreadId,
      botToken,
      payload,
      fetchImpl,
    })
    : await sendDiscordThreadedMessage({
      channelId,
      botToken,
      payload,
      threadName,
      forumTagIds,
      parentPayload,
      fetchImpl,
    });

  if (existingThreadId) {
    try {
      await updateDiscordThread({
        threadId: existingThreadId,
        botToken,
        name: threadName,
        appliedTagIds: forumTagIds,
        fetchImpl,
      });
    } catch (error) {
      dispatch.metadataUpdateError = error.message || String(error);
    }
    dispatch.threadId = existingThreadId;
    dispatch.threadReused = true;
  }

  dispatch.threadName = threadName;
  dispatch.appliedTagIds = forumTagIds;
  dispatch.threadStyle = dispatch.threadStyle || 'forum_post';
  return dispatch;
}

export async function updateForumWorkspaceStage({
  workspace = 'projects',
  threadId,
  channelId = '',
  botToken,
  kind,
  order = {},
  caseFile = null,
  revision = null,
  fetchImpl = fetch,
}) {
  if (!threadId) throw new Error('threadId is required');
  if (!botToken) throw new Error('botToken is required');
  const forumTagIds = channelId
    ? await resolveForumTagIds({
      workspace,
      channelId,
      botToken,
      kind,
      order,
      caseFile,
      revision,
      fetchImpl,
    })
    : [];
  const threadName = buildForumThreadName({ workspace, kind, order, caseFile, revision });
  const updated = await updateDiscordThread({
    threadId,
    botToken,
    name: threadName,
    appliedTagIds: forumTagIds.length ? forumTagIds : null,
    fetchImpl,
  });
  return {
    ok: true,
    threadId,
    threadName,
    appliedTagIds: forumTagIds,
    update: updated,
  };
}

async function resolveForumTagIds({
  workspace,
  channelId,
  botToken,
  kind,
  order,
  caseFile,
  revision,
  fetchImpl,
}) {
  if (!channelId) return [];
  const blueprints = defaultDiscordForumBlueprints();
  const config = await syncDiscordForumTags({
    channelId,
    botToken,
    tags: blueprints[workspace] || [],
    fetchImpl,
  });
  return desiredForumTagNames({ workspace, kind, order, caseFile, revision })
    .map((name) => config.tagsByName[name])
    .filter(Boolean);
}
