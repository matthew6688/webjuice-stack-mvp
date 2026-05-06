export const ADMIN_ACTIONS = {
  request_more_info: {
    label: 'Request More Info',
    status: 'intake_needs_more_info',
    eventType: 'admin_requested_more_info',
    needsNote: true,
  },
  mark_v1_started: {
    label: 'Mark V1 Started',
    status: 'v1_generation_started',
    eventType: 'admin_marked_v1_started',
    sets: { firstVersionStartedAt: true },
  },
  mark_v1_delivered: {
    label: 'Mark V1 Delivered',
    status: 'v1_delivered',
    eventType: 'admin_marked_v1_delivered',
    sets: { firstVersionDeliveredAt: true },
  },
  mark_completed: {
    label: 'Mark Completed',
    status: 'completed',
    eventType: 'admin_marked_completed',
  },
  approve_latest_revision: {
    label: 'Approve Latest Revision',
    status: 'revision_approved',
    eventType: 'admin_approved_latest_revision',
    revisionStatus: 'revision_approved',
  },
  reject_latest_revision: {
    label: 'Reject Latest Revision',
    status: 'revision_rejected',
    eventType: 'admin_rejected_latest_revision',
    revisionStatus: 'revision_rejected',
    needsNote: true,
  },
  quote_custom: {
    label: 'Quote Custom Work',
    status: 'custom_quote_needed',
    eventType: 'admin_marked_custom_quote_needed',
    needsNote: true,
  },
};

export function adminActionDefinition(action) {
  return ADMIN_ACTIONS[action] || null;
}

export function allowedAdminActions(record = {}) {
  const status = record.status || '';
  const actions = [];
  if (['intake_needs_more_info', 'intake_needs_generation_confirmation', 'paid_intake_pending_preview'].includes(status)) {
    actions.push('request_more_info');
  }
  if (status === 'intake_ready_for_review') {
    actions.push('mark_v1_started', 'request_more_info', 'quote_custom');
  }
  if (status === 'v1_generation_started') {
    actions.push('mark_v1_delivered', 'request_more_info', 'quote_custom');
  }
  if (status === 'v1_delivered') {
    actions.push('mark_completed', 'quote_custom');
  }
  if (status === 'revision_requested') {
    actions.push('approve_latest_revision', 'reject_latest_revision', 'quote_custom');
  }
  if (!actions.length) actions.push('request_more_info', 'quote_custom');
  return actions;
}
