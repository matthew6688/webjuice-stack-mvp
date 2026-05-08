export function normalizeOutreachArtifactState(artifact = {}) {
  const sendResult = artifact.sendResult && typeof artifact.sendResult === 'object' ? artifact.sendResult : {};
  const providerEvent = artifact.providerEvent && typeof artifact.providerEvent === 'object' ? artifact.providerEvent : {};
  const provider = String(
    sendResult.provider
      || sendResult.transportProvider
      || artifact.provider
      || detectProviderFromEvent(providerEvent)
      || 'unknown',
  ).toLowerCase();

  const normalized = {
    provider,
    sourceSystem: String(sendResult.sourceSystem || provider || 'unknown'),
    status: normalizeStatus(sendResult.status),
    sentAt: sendResult.sentAt || '',
    sendId: sendResult.id || sendResult.sendId || '',
    externalCampaignId: sendResult.externalCampaignId || sendResult.campaignId || '',
    externalLeadId: sendResult.externalLeadId || sendResult.leadId || '',
    externalMessageId: sendResult.externalMessageId || sendResult.messageId || '',
    externalThreadUrl: sendResult.externalThreadUrl || sendResult.threadUrl || '',
    replyState: normalizeReplyState(sendResult.replyState || ''),
    nextFollowUpDue: sendResult.nextFollowUpDue || '',
    bounceState: normalizeBounceState(sendResult.bounceState || ''),
    unsubscribeState: sendResult.unsubscribeState || '',
    lastEventType: sendResult.lastEventType || '',
    lastEventAt: sendResult.lastEventAt || '',
    replySnippet: sendResult.replySnippet || '',
  };

  const eventState = normalizeProviderEvent(provider, providerEvent);
  return {
    ...normalized,
    status: eventState.status || normalized.status,
    sentAt: eventState.sentAt || normalized.sentAt,
    replyState: eventState.replyState || normalized.replyState,
    nextFollowUpDue: eventState.nextFollowUpDue || normalized.nextFollowUpDue,
    bounceState: eventState.bounceState || normalized.bounceState,
    unsubscribeState: eventState.unsubscribeState || normalized.unsubscribeState,
    lastEventType: eventState.lastEventType || normalized.lastEventType,
    lastEventAt: eventState.lastEventAt || normalized.lastEventAt,
    replySnippet: eventState.replySnippet || normalized.replySnippet,
    externalCampaignId: eventState.externalCampaignId || normalized.externalCampaignId,
    externalLeadId: eventState.externalLeadId || normalized.externalLeadId,
    externalMessageId: eventState.externalMessageId || normalized.externalMessageId,
    externalThreadUrl: eventState.externalThreadUrl || normalized.externalThreadUrl,
  };
}

export function detectProviderFromEvent(event = {}) {
  if (!event || typeof event !== 'object') return '';
  if (
    event.provider === 'agentic-email'
    || event.sourceSystem === 'agentic-email'
    || event.agenticInbox === true
    || event.mailboxUrl
    || event.threadUrl
    || event.inboxUrl
  ) return 'agentic-email';
  if (event.event_type || event.workspace || event.unibox_url) return 'instantly';
  if (event.event || event.email_campaign_id || event.email_account_id) return 'smartlead';
  return '';
}

function normalizeProviderEvent(provider, event) {
  if (!event || typeof event !== 'object' || Object.keys(event).length === 0) {
    return blankEventState();
  }

  if (provider === 'instantly') {
    const eventType = String(event.event_type || '').toLowerCase();
    return {
      status: mapInstantlyEventToStatus(eventType),
      sentAt: event.timestamp || '',
      replyState: eventType === 'reply_received' ? 'replied' : '',
      nextFollowUpDue: '',
      bounceState: eventType === 'email_bounced' ? 'bounced' : '',
      unsubscribeState: eventType === 'lead_unsubscribed' ? 'unsubscribed' : '',
      lastEventType: eventType,
      lastEventAt: event.timestamp || '',
      replySnippet: event.reply_text_snippet || '',
      externalCampaignId: event.campaign_id || '',
      externalLeadId: event.lead_id || event.lead_email || '',
      externalMessageId: event.email_id || '',
      externalThreadUrl: event.unibox_url || '',
    };
  }

  if (provider === 'smartlead') {
    const eventType = String(event.event || '').toUpperCase();
    return {
      status: mapSmartleadEventToStatus(eventType),
      sentAt: event.timestamp || '',
      replyState: eventType === 'EMAIL_REPLIED' ? 'replied' : '',
      nextFollowUpDue: '',
      bounceState: eventType === 'EMAIL_BOUNCED' ? 'bounced' : '',
      unsubscribeState: eventType === 'EMAIL_UNSUBSCRIBED' ? 'unsubscribed' : '',
      lastEventType: eventType,
      lastEventAt: event.timestamp || '',
      replySnippet: event.reply?.body || '',
      externalCampaignId: event.campaign_id || '',
      externalLeadId: event.lead_id || event.lead?.email || '',
      externalMessageId: event.email?.message_id || event.reply?.message_id || '',
      externalThreadUrl: '',
    };
  }

  if (provider === 'agentic-email') {
    const rawStatus = String(event.status || event.eventType || event.event_type || '').toLowerCase();
    return {
      status: normalizeStatus(rawStatus),
      sentAt: event.sentAt || event.sent_at || event.timestamp || '',
      replyState: normalizeReplyState(event.replyState || event.reply_state || ''),
      nextFollowUpDue: event.nextFollowUpDue || event.next_follow_up_due || '',
      bounceState: normalizeBounceState(event.bounceState || event.bounce_state || ''),
      unsubscribeState: event.unsubscribeState || event.unsubscribe_state || '',
      lastEventType: rawStatus || String(event.eventType || event.event_type || ''),
      lastEventAt: event.lastEventAt || event.last_event_at || event.timestamp || '',
      replySnippet: event.replySnippet || event.reply_snippet || event.preview || '',
      externalCampaignId: event.externalCampaignId || event.campaignId || '',
      externalLeadId: event.externalLeadId || event.leadId || event.leadEmail || '',
      externalMessageId: event.externalMessageId || event.messageId || '',
      externalThreadUrl: event.externalThreadUrl || event.threadUrl || event.inboxUrl || event.mailboxUrl || '',
    };
  }

  return {
    ...blankEventState(),
    lastEventType: String(event.event_type || event.event || ''),
    lastEventAt: event.timestamp || '',
  };
}

function blankEventState() {
  return {
    status: '',
    sentAt: '',
    replyState: '',
    nextFollowUpDue: '',
    bounceState: '',
    unsubscribeState: '',
    lastEventType: '',
    lastEventAt: '',
    replySnippet: '',
    externalCampaignId: '',
    externalLeadId: '',
    externalMessageId: '',
    externalThreadUrl: '',
  };
}

function mapInstantlyEventToStatus(eventType) {
  switch (eventType) {
    case 'reply_received':
    case 'auto_reply_received':
      return 'replied';
    case 'email_bounced':
      return 'bounced';
    case 'lead_unsubscribed':
      return 'unsubscribed';
    case 'email_opened':
      return 'opened';
    case 'link_clicked':
      return 'clicked';
    case 'email_sent':
      return 'sent';
    default:
      return '';
  }
}

function mapSmartleadEventToStatus(eventType) {
  switch (eventType) {
    case 'EMAIL_REPLIED':
      return 'replied';
    case 'EMAIL_BOUNCED':
      return 'bounced';
    case 'EMAIL_UNSUBSCRIBED':
      return 'unsubscribed';
    case 'EMAIL_OPENED':
      return 'opened';
    case 'EMAIL_CLICKED':
      return 'clicked';
    case 'EMAIL_SENT':
      return 'sent';
    default:
      return '';
  }
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized;
}

function normalizeReplyState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'replied') return normalized;
  return normalized;
}

function normalizeBounceState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bounced') return normalized;
  return normalized;
}
