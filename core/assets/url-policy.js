const URL_FIELDS = new Set([
  'url',
  'logo',
  'ogImage',
  'sourceUrl',
  'reserveUrl',
  'mapUrl',
  'website',
  'secureUrl',
]);

const SAFE_HTTP_UPGRADE_HOSTS = [
  'static1.squarespace.com',
  'images.squarespace-cdn.com',
  'res.cloudinary.com',
  'lh3.googleusercontent.com',
  'maps.googleapis.com',
];

export function auditAssetUrls(value, {
  path = '',
  safeHttpUpgradeHosts = SAFE_HTTP_UPGRADE_HOSTS,
} = {}) {
  const issues = [];
  walk(value, path, issues, safeHttpUpgradeHosts);
  return {
    ok: issues.length === 0,
    issues,
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}

export function normalizeAssetUrls(value, {
  safeHttpUpgradeHosts = SAFE_HTTP_UPGRADE_HOSTS,
} = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetUrls(item, { safeHttpUpgradeHosts }));
  }
  if (!value || typeof value !== 'object') return value;

  const next = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && shouldInspectKey(key) && item.startsWith('http://') && canUpgradeHttpUrl(item, safeHttpUpgradeHosts)) {
      next[key] = item.replace(/^http:\/\//, 'https://');
    } else {
      next[key] = normalizeAssetUrls(item, { safeHttpUpgradeHosts });
    }
  }
  return next;
}

export function canUpgradeHttpUrl(url, safeHttpUpgradeHosts = SAFE_HTTP_UPGRADE_HOSTS) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && safeHttpUpgradeHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function walk(value, path, issues, safeHttpUpgradeHosts) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, issues, safeHttpUpgradeHosts));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, item] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (typeof item === 'string' && shouldInspectKey(key) && item.startsWith('http://')) {
      issues.push({
        severity: 'error',
        path: nextPath,
        url: item,
        fixable: canUpgradeHttpUrl(item, safeHttpUpgradeHosts),
        message: canUpgradeHttpUrl(item, safeHttpUpgradeHosts)
          ? 'HTTP asset URL should be upgraded to HTTPS before deploy.'
          : 'HTTP asset URL is not on the safe upgrade list and must be fixed before deploy.',
      });
    }
    walk(item, nextPath, issues, safeHttpUpgradeHosts);
  }
}

function shouldInspectKey(key) {
  return URL_FIELDS.has(key) || /url$/i.test(key) || /image/i.test(key) || /photo/i.test(key);
}
