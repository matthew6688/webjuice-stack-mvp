import { updateDiscordThread } from '../funnel/discord.js';

export const WEBSITE_TASK_STAGE_LABELS = {
  new_lead: '新线索',
  researching: '研究中',
  needs_human: '需人工',
  ready_for_mockup: '可做 Mockup',
  mockup_building: '制作中',
  mockup_ready: 'Mockup 就绪',
  skipped: '已跳过',
  replied: '已回复',
  paid_handoff: '成交交接',
  project: '项目任务',
};

export function buildWebsiteTaskThreadTitle({
  stage = 'researching',
  businessName = '',
  industry = '',
  city = '',
  taskId = '',
} = {}) {
  const label = WEBSITE_TASK_STAGE_LABELS[stage] || stage || '任务';
  const subject = businessName || taskId || 'website-task';
  const parts = [
    `[${label}] ${subject}`,
    industry,
    city,
  ].map(cleanPart).filter(Boolean);
  return parts.join(' · ').slice(0, 100);
}

export async function syncWebsiteTaskThreadTitle({
  threadId,
  botToken,
  stage,
  businessName,
  industry,
  city,
  taskId,
  fetchImpl = fetch,
} = {}) {
  if (!threadId) throw new Error('threadId is required');
  const name = buildWebsiteTaskThreadTitle({ stage, businessName, industry, city, taskId });
  const result = await updateDiscordThread({
    threadId,
    botToken,
    name,
    fetchImpl,
  });
  return { ...result, threadId, name };
}

function cleanPart(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[|/]+/g, ' ')
    .trim();
}
