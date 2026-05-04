import { createStableUuidFactory } from './stable-uuid.js';

const DEFAULT_HIDDEN_FIELDS = [
  'client_slug',
  'repo',
  'template',
  'preview_url',
  'campaign_id',
  'currency',
];

export function buildTallyFeedbackFormPayload({
  title,
  description,
  redirectUrl,
  hiddenFieldNames = DEFAULT_HIDDEN_FIELDS,
  status = 'DRAFT',
}) {
  if (!title) throw new Error('title is required');

  const uuid = createStableUuidFactory(['feedback', title].join('|'));

  return {
    status,
    name: `${title} - feedback`,
    blocks: [
      formTitleBlock(uuid, title, description || 'Send requested changes for your preview site.'),
      inputBlock(uuid, 'INPUT_TEXT', 'Business name', { isRequired: true }),
      inputBlock(uuid, 'INPUT_EMAIL', 'Email', { isRequired: true }),
      inputBlock(uuid, 'TEXTAREA', 'Requested changes', { isRequired: true, alias: 'feedback' }),
      inputBlock(uuid, 'INPUT_LINK', 'Reference URL', { isRequired: false, alias: 'reference_url' }),
      inputBlock(uuid, 'FILE_UPLOAD', 'Screenshots or brand assets', { isRequired: false }),
      {
        uuid: uuid('hidden-fields'),
        type: 'HIDDEN_FIELDS',
        groupUuid: uuid('hidden-group'),
        groupType: 'HIDDEN_FIELDS',
        payload: {
          hiddenFields: hiddenFieldNames.map((name) => ({ uuid: uuid(`hidden-${name}`), name })),
        },
      },
    ],
    settings: {
      redirectOnCompletion: redirectUrl || '',
      hasProgressBar: true,
    },
  };
}

export function buildTallyFeedbackMcpPrompt({
  businessName = 'WebJuice',
  webhookUrl,
  thankYouUrl,
}) {
  return [
    `Create a Tally customer feedback form for ${businessName}.`,
    '',
    'The form must include these visible fields:',
    '- Business name, required short text',
    '- Email, required email',
    '- Requested changes, required long text, field alias feedback',
    '- Reference URL, optional link/text, field alias reference_url',
    '- Screenshots or brand assets, optional file upload',
    '',
    'The form must include hidden fields:',
    DEFAULT_HIDDEN_FIELDS.map((field) => `- ${field}`).join('\n'),
    '',
    webhookUrl ? `Add a FORM_RESPONSE webhook to ${webhookUrl}.` : 'Leave webhook setup for later.',
    thankYouUrl ? `Set redirect on completion to ${thankYouUrl}.` : 'Use the default Tally thank-you screen.',
    '',
    'Return the public tally.so/r/... URL.',
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
