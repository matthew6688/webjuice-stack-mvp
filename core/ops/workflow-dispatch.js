export function buildApprovalWorkflowDispatch(body = {}, env = {}) {
  const orderId = String(body.order_id || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const clientSlug = String(body.client_slug || '').trim();
  const repo = String(body.repo || '').trim();
  const missing = [];
  if (!orderId) missing.push('order_id');
  if (!email) missing.push('email');
  if (!clientSlug) missing.push('client_slug');
  if (!repo) missing.push('repo');
  const dryRun = env.APPROVAL_ALLOW_DRY_RUN === 'true' && String(body.dry_run || '').toLowerCase() === 'true';

  return {
    ok: missing.length === 0,
    missing,
    workflow: 'publish-approved.yml',
    inputs: {
      client_slug: clientSlug,
      order_id: orderId,
      email,
      task_path: String(body.task_path || ''),
      push: 'true',
      check_deploy: 'true',
      send_email: 'true',
      send_discord: 'true',
      dry_run: String(dryRun),
    },
    discordFields: {
      client_slug: clientSlug,
      repo,
      order_id: orderId,
      email,
    },
  };
}

export function buildRevisionWorkflowDispatch(payload = {}) {
  const orderId = String(payload.order_id || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const requestedChanges = String(payload.requested_changes || payload.requestedChanges || '').trim();
  const clientSlug = String(payload.client_slug || payload.clientSlug || '').trim();
  const repo = String(payload.repo || '').trim();
  const missing = [];
  if (!orderId) missing.push('order_id');
  if (!email) missing.push('email');
  if (!requestedChanges) missing.push('requested_changes');
  if (!clientSlug) missing.push('client_slug');
  if (!repo) missing.push('repo');

  return {
    ok: missing.length === 0,
    missing,
    workflow: 'route-funnel-event.yml',
    inputs: {
      provider: 'tally',
      kind: 'revision',
      send_discord: 'true',
      send_email: 'true',
      dry_run: 'false',
      auto_run_agent: 'true',
      dedupe_key: `${orderId}-${payload.submitted_at || payload.submittedAt || 'revision'}`,
      payload: JSON.stringify(payload),
    },
  };
}
