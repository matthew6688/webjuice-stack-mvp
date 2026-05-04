import { createStableUuidFactory } from './stable-uuid.js';

const DEFAULT_HIDDEN_FIELDS = [
  'client_slug',
  'repo',
  'template',
  'preview_url',
  'campaign_id',
  'tier',
  'amount',
  'currency',
];

export function buildTallyPaymentFormPayload({
  title,
  description,
  tier,
  amount,
  currency = 'USD',
  redirectUrl,
  hiddenFieldNames = DEFAULT_HIDDEN_FIELDS,
  status = 'DRAFT',
}) {
  if (!title) throw new Error('title is required');
  if (!tier) throw new Error('tier is required');
  if (!amount) throw new Error('amount is required');

  const uuid = createStableUuidFactory(['payment', title, tier, amount, currency].join('|'));
  const hiddenGroupUuid = uuid('hidden-group');
  const hiddenFields = hiddenFieldNames.map((name) => ({ uuid: uuid(`hidden-${name}`), name }));

  return {
    status,
    name: `${title} - ${tier}`,
    blocks: [
      formTitleBlock(uuid, title, description),
      textBlock(uuid, `Package: ${packageLabel(tier)} - ${currency} ${amount}`),
      inputBlock(uuid, 'TITLE', 'Your details'),
      inputBlock(uuid, 'INPUT_TEXT', 'Business name', { isRequired: true }),
      inputBlock(uuid, 'INPUT_EMAIL', 'Email', { isRequired: true }),
      inputBlock(uuid, 'INPUT_PHONE_NUMBER', 'Phone', { isRequired: false }),
      inputBlock(uuid, 'INPUT_LINK', 'Preferred domain', { isRequired: false }),
      inputBlock(uuid, 'TEXTAREA', 'Launch notes or requested changes', { isRequired: false }),
      paymentBlock({
        uuid,
        name: `${packageLabel(tier)} package`,
        amount,
        currency,
      }),
      {
        uuid: uuid('hidden-fields'),
        type: 'HIDDEN_FIELDS',
        groupUuid: hiddenGroupUuid,
        groupType: 'HIDDEN_FIELDS',
        payload: {
          hiddenFields,
        },
      },
    ],
    settings: {
      redirectOnCompletion: redirectUrl || '',
      hasProgressBar: true,
    },
  };
}

export function buildTallyMcpPrompt({
  businessName = 'WebJuice',
  tiers,
  webhookUrl,
  thankYouUrl,
}) {
  const tierLines = tiers.map((tier) => `- ${tier.id}: ${tier.currency} ${tier.amount}`).join('\n');
  return [
    `Create Tally payment forms for ${businessName}.`,
    '',
    'Create one published payment form per package tier:',
    tierLines,
    '',
    'Each form must include these visible fields:',
    '- Business name, required short text',
    '- Email, required email',
    '- Phone, optional phone',
    '- Preferred domain, optional link/text',
    '- Launch notes or requested changes, optional long text',
    '- A payment block with the exact static amount for that tier',
    '- Make the package copy clear: one_time includes 3 revisions; yearly_maintenance includes monthly maintenance for one year',
    '',
    'Each form must include hidden fields:',
    DEFAULT_HIDDEN_FIELDS.map((field) => `- ${field}`).join('\n'),
    '',
    webhookUrl ? `Add a FORM_RESPONSE webhook to ${webhookUrl}.` : 'Leave webhook setup for later.',
    thankYouUrl ? `Set redirect on completion to ${thankYouUrl}.` : 'Use the default Tally thank-you screen.',
    '',
    'Return the public tally.so/r/... URL for each tier.',
  ].join('\n');
}

function formTitleBlock(uuid, title, description) {
  return {
    uuid: uuid(`title-${title}`),
    type: 'FORM_TITLE',
    groupUuid: uuid(`title-group-${title}`),
    groupType: 'TEXT',
    payload: {
      html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description || '')}</p>`,
      title,
    },
  };
}

function textBlock(uuid, html) {
  return {
    uuid: uuid(`text-${html}`),
    type: 'TEXT',
    groupUuid: uuid(`text-group-${html}`),
    groupType: 'TEXT',
    payload: {
      html: escapeHtml(html),
    },
  };
}

function inputBlock(uuid, type, title, payload = {}) {
  const groupUuid = uuid(`group-${type}-${title}`);
  return {
    uuid: uuid(`block-${type}-${title}`),
    type,
    groupUuid,
    groupType: 'QUESTION',
    payload: {
      title,
      ...payload,
    },
  };
}

function paymentBlock({ uuid, name, amount, currency }) {
  const id = uuid(`payment-${name}-${amount}-${currency}`);
  return {
    uuid: id,
    type: 'PAYMENT',
    groupUuid: id,
    groupType: 'QUESTION',
    payload: {
      isRequired: true,
      amount: Number(amount),
      currency,
      name,
    },
  };
}

function titleCase(value) {
  return String(value || '').replace(/\b\w/g, (match) => match.toUpperCase());
}

function packageLabel(tier) {
  if (tier === 'one_time') return 'One-Time Website With 3 Revisions';
  if (tier === 'yearly_maintenance') return 'Yearly Website With Monthly Maintenance';
  return titleCase(tier);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
