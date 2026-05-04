export function openAiUsageLedgerInput({
  clientSlug,
  campaignId,
  model,
  inputTokens = 0,
  outputTokens = 0,
  inputCostPerMillion,
  outputCostPerMillion,
  metadata = {},
}) {
  if (!model) throw new Error('model is required');
  const inputCost = costForTokens(inputTokens, inputCostPerMillion);
  const outputCost = costForTokens(outputTokens, outputCostPerMillion);
  const amount = inputCost + outputCost;

  return {
    clientSlug: clientSlug || null,
    campaignId: campaignId || null,
    type: 'cost',
    category: 'openai',
    amount,
    units: Number(inputTokens || 0) + Number(outputTokens || 0),
    unitCost: amount,
    currency: 'USD',
    provider: 'openai',
    metadata: {
      model,
      inputTokens: Number(inputTokens || 0),
      outputTokens: Number(outputTokens || 0),
      inputCostPerMillion: Number(inputCostPerMillion || 0),
      outputCostPerMillion: Number(outputCostPerMillion || 0),
      inputCost,
      outputCost,
      ...metadata,
    },
  };
}

export function parseOpenAiRates(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function ratesForModel(rates, model) {
  return rates[model] || rates.default || null;
}

function costForTokens(tokens, costPerMillion) {
  return (Number(tokens || 0) / 1_000_000) * Number(costPerMillion || 0);
}
