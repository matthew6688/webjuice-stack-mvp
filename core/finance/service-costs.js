export function resendEmailLedgerInput({
  clientSlug = null,
  campaignId = null,
  to = '',
  subject = '',
  providerId = '',
  unitCost = 0,
  metadata = {},
} = {}) {
  const amount = Number(unitCost || 0);
  return {
    clientSlug,
    campaignId,
    type: 'cost',
    category: 'resend',
    amount,
    units: 1,
    unitCost: amount,
    currency: 'USD',
    provider: 'resend',
    metadata: {
      to,
      subject,
      providerId,
      estimated: true,
      ...metadata,
    },
  };
}

export function agentRuntimeLedgerInput({
  clientSlug = null,
  campaignId = null,
  taskId = '',
  mode = '',
  startedAt = '',
  finishedAt = '',
  costPerMinute = 0,
  provider = 'agent-runtime',
  metadata = {},
} = {}) {
  const seconds = durationSeconds(startedAt, finishedAt);
  const minutes = seconds / 60;
  const unitCost = Number(costPerMinute || 0);
  const amount = minutes * unitCost;
  return {
    clientSlug,
    campaignId,
    type: 'cost',
    category: 'labor_estimate',
    amount,
    units: minutes,
    unitCost,
    currency: 'USD',
    provider,
    metadata: {
      taskId,
      mode,
      startedAt,
      finishedAt,
      seconds,
      estimated: true,
      ...metadata,
    },
  };
}

export function imageGenerationLedgerInput({
  clientSlug = null,
  campaignId = null,
  provider = 'openai-image',
  model = '',
  images = 1,
  unitCost = 0,
  metadata = {},
} = {}) {
  const units = Number(images || 1);
  const cost = Number(unitCost || 0);
  return {
    clientSlug,
    campaignId,
    type: 'cost',
    category: 'image_generation',
    amount: units * cost,
    units,
    unitCost: cost,
    currency: 'USD',
    provider,
    metadata: {
      model,
      estimated: true,
      ...metadata,
    },
  };
}

function durationSeconds(startedAt, finishedAt) {
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return (end - start) / 1000;
}
