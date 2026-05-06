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
  requireText(missing, 'lead recipient email for the contact form', record?.leadDelivery?.recipientEmail || customer.email);

  const hasAssets = Array.isArray(intake.files) && intake.files.length > 0;
  const hasReferences = Boolean(clean(intake.references || intake.referenceUrl || record?.previewUrl));
  if (!hasAssets && !hasReferences) {
    missing.push('logo, photos, menu PDF, screenshots, or reference website');
  }
  if (record?.firstVersionConfirmation?.confirmed !== true) {
    missing.push('confirmation to generate the first version');
  }

  return {
    status: readinessStatus(missing),
    missing,
    checkedAt: new Date().toISOString(),
  };
}

function readinessStatus(missing) {
  if (!missing.length) return 'ready_for_agent_task';
  if (missing.length === 1 && missing[0] === 'confirmation to generate the first version') {
    return 'needs_generation_confirmation';
  }
  return 'needs_more_info';
}

function requireText(missing, label, value) {
  if (!clean(value)) missing.push(label);
}

function clean(value) {
  return String(value || '').trim();
}
