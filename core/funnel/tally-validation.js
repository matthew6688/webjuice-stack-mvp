export function validateTallyFormPayload(payload, { requirePayment = false } = {}) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload must be an object');
  if (!['BLANK', 'DRAFT', 'PUBLISHED', 'DELETED'].includes(payload?.status)) errors.push('status must be a valid Tally form status');
  if (!Array.isArray(payload?.blocks) || !payload.blocks.length) errors.push('blocks must not be empty');

  const blocks = payload?.blocks || [];
  if (!blocks.some((block) => block.type === 'FORM_TITLE' && block.groupType === 'FORM_TITLE')) {
    errors.push('FORM_TITLE block with groupType FORM_TITLE is required');
  }
  if (!blocks.some((block) => block.type === 'HIDDEN_FIELDS' && block.groupType === 'HIDDEN_FIELDS')) {
    errors.push('HIDDEN_FIELDS block is required');
  }
  if (requirePayment && !blocks.some((block) => block.type === 'PAYMENT' && block.groupType === 'QUESTION')) {
    errors.push('PAYMENT block is required');
  }

  for (const [index, block] of blocks.entries()) {
    if (!block.uuid) errors.push(`blocks[${index}].uuid is required`);
    if (!block.groupUuid) errors.push(`blocks[${index}].groupUuid is required`);
    if (!block.type) errors.push(`blocks[${index}].type is required`);
    if (!block.groupType) errors.push(`blocks[${index}].groupType is required`);
    if (!block.payload) errors.push(`blocks[${index}].payload is required`);
  }

  return { ok: errors.length === 0, errors };
}
