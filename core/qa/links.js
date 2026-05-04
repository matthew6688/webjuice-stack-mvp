export function validateRestaurantLinks(content) {
  const errors = [];
  const warnings = [];
  const checked = [];

  checkUrl({
    label: 'call',
    value: content.cta?.callUrl,
    required: true,
    predicate: (value) => String(value).startsWith('tel:'),
    message: 'call URL must start with tel:',
    checked,
    errors,
  });
  checkUrl({
    label: 'map',
    value: content.cta?.mapUrl || content.contact?.googleMapsUrl,
    required: true,
    predicate: (value) => isHttpUrl(value) && String(value).includes('google.com/maps'),
    message: 'map URL must be a Google Maps URL',
    checked,
    errors,
  });
  checkUrl({
    label: 'menuSource',
    value: content.menu?.sourceUrl,
    required: true,
    predicate: isHttpUrlOrLocal,
    message: 'menu source must be an http(s) URL or local artifact path',
    checked,
    errors,
  });

  if (content.cta?.reserveUrl) {
    checkUrl({
      label: 'reserve',
      value: content.cta.reserveUrl,
      required: false,
      predicate: isHttpUrl,
      message: 'reservation URL must be http(s)',
      checked,
      errors,
    });
  } else {
    warnings.push('reservation URL missing; reserve CTA should be omitted');
  }

  if (content.contact?.email) {
    checked.push({ label: 'email', value: `mailto:${content.contact.email}` });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.contact.email)) {
      errors.push('contact.email is not a valid email address');
    }
  } else {
    warnings.push('email missing; email CTA should be omitted');
  }

  for (const [sectionIndex, section] of (content.menu?.sections || []).entries()) {
    for (const [itemIndex, item] of (section.items || []).entries()) {
      if (!item.sourceUrl && !item.sourceKey) {
        errors.push(`menu item source missing at section ${sectionIndex}, item ${itemIndex}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, checked };
}

function checkUrl({ label, value, required, predicate, message, checked, errors }) {
  if (!value) {
    if (required) errors.push(`${label} URL is required`);
    return;
  }
  checked.push({ label, value });
  if (!predicate(value)) errors.push(message);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isHttpUrlOrLocal(value) {
  return isHttpUrl(value) || String(value).startsWith('/') || String(value).startsWith('./');
}
