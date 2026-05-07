(function () {
  const storageKey = 'profitslocal_funnel_context';
  const cookieName = 'pl_funnel_context';
  const ttlDays = 30;
  const contextKeys = [
    'client_slug',
    'repo',
    'template',
    'preview_url',
    'campaign_id',
    'brief_id',
    'tier',
    'amount',
    'currency',
    'business_name',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
    'msclkid',
    'ttclid',
    'twclid',
    'li_fat_id',
    'gbraid',
    'wbraid',
    'source',
    'ref',
  ];

  const now = new Date().toISOString();
  const params = new URLSearchParams(window.location.search);
  const existing = readContext();
  const incoming = {};

  contextKeys.forEach((key) => {
    const value = params.get(key);
    if (value) incoming[key] = value;
  });

  if (!existing.first_landing_url) incoming.first_landing_url = window.location.href;
  incoming.last_landing_url = window.location.href;
  incoming.last_seen_at = now;
  if (!existing.first_seen_at) incoming.first_seen_at = now;
  if (document.referrer && !document.referrer.includes(window.location.hostname)) {
    incoming.referrer = existing.referrer || document.referrer;
    incoming.last_referrer = document.referrer;
  }

  const next = cleanContext({ ...existing, ...incoming });
  if (Object.keys(incoming).length) writeContext(next);

  window.ProfitsLocalFunnel = {
    getContext: () => readContext(),
    fillForm: (form) => fillForm(form || document),
    clearContext: clearContext,
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-funnel-context-form]').forEach((form) => fillForm(form));
  });

  function fillForm(root) {
    const context = readContext();
    Object.entries(context).forEach(([key, value]) => {
      const field = root.querySelector ? root.querySelector(`[name="${cssEscape(key)}"]`) : null;
      if (field && 'value' in field && !field.value) field.value = value;
    });
    return context;
  }

  function readContext() {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored) || {};
    } catch {}
    try {
      const match = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${cookieName}=`));
      if (!match) return {};
      return JSON.parse(decodeURIComponent(match.slice(cookieName.length + 1))) || {};
    } catch {
      return {};
    }
  }

  function writeContext(context) {
    const value = JSON.stringify(context);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {}
    const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  function clearContext() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }

  function cleanContext(context) {
    return Object.fromEntries(
      Object.entries(context)
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => [key, value.trim().slice(0, 900)])
    );
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }
})();
