export function assessPaidIntakeReadiness(record) {
  const missing = [];
  const customer = record?.customer || {};
  const intake = record?.intake || {};
  const order = record?.order || {};

  requireText(missing, 'checkout email', customer.email);
  requireText(missing, 'business name', customer.company);
  requireText(missing, 'order id', record?.orderId || order.id);
  requireText(missing, 'menu, services, products, or offers', intake.services || intake.launchNotes);
  requireText(missing, 'primary customer action', intake.primaryAction);
  requireText(missing, 'address or service area', intake.address || customer.domain);

  const hasAssets = Array.isArray(intake.files) && intake.files.length > 0;
  const hasReferences = Boolean(clean(intake.references || intake.referenceUrl || record?.previewUrl));
  if (!hasAssets && !hasReferences) {
    missing.push('logo, photos, menu PDF, screenshots, or reference website');
  }

  return {
    status: missing.length ? 'needs_more_info' : 'ready_for_agent_task',
    missing,
    checkedAt: new Date().toISOString(),
  };
}

function requireText(missing, label, value) {
  if (!clean(value)) missing.push(label);
}

function clean(value) {
  return String(value || '').trim();
}
