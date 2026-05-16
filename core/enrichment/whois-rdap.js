/**
 * WHOIS via RDAP (Registration Data Access Protocol).
 *
 * Public free standard · no auth · TLD-specific endpoints:
 *   .au  → https://rdap.cctld.au/rdap/domain/<domain>
 *   else → https://rdap.org/domain/<domain> (proxy · auto-routes to right registry)
 *
 * Returns registration date · registrar · domain age · expiry · status.
 *
 * SSL tolerance: some old domains have expired certs · retry insecure on cert err
 * (sitemap-analyzer 同样模式).
 *
 * Failure: 404 (domain not found) · timeout · parse fail → return null.
 */
const TIMEOUT_MS = 10_000;

function endpointFor(domain) {
  if (/\.au$/i.test(domain)) return `https://rdap.cctld.au/rdap/domain/${encodeURIComponent(domain)}`;
  return `https://rdap.org/domain/${encodeURIComponent(domain)}`;
}

async function fetchJson(url, fetchImpl, { allowInsecure = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const opts = {
    signal: ctrl.signal,
    headers: { 'Accept': 'application/rdap+json, application/json', 'User-Agent': 'profitslocal-enrichment' },
  };
  if (allowInsecure) {
    try {
      const { Agent } = await import('undici');
      opts.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    } catch {}
  }
  try {
    const r = await fetchImpl(url, opts);
    if (r.status === 404) return { status: 404 };
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    const code = err?.cause?.code || '';
    if (!allowInsecure && /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) {
      clearTimeout(timer);
      return fetchJson(url, fetchImpl, { allowInsecure: true });
    }
    return null;
  } finally { clearTimeout(timer); }
}

function parseRdapDate(s) {
  if (!s) return null;
  try { return new Date(s).toISOString().slice(0, 10); } catch { return null; }
}

function findEvent(events, action) {
  if (!Array.isArray(events)) return null;
  const ev = events.find((e) => e?.eventAction === action);
  return ev ? parseRdapDate(ev.eventDate) : null;
}

function findRegistrar(entities) {
  if (!Array.isArray(entities)) return null;
  const reg = entities.find((e) => Array.isArray(e?.roles) && e.roles.includes('registrar'));
  if (!reg) return null;
  // Try vCard
  const vcardItems = reg?.vcardArray?.[1] || [];
  const fnItem = vcardItems.find((it) => it[0] === 'fn');
  if (fnItem && fnItem[3]) return fnItem[3];
  return reg.handle || null;
}

/**
 * Look up domain registration via RDAP.
 *
 * @param {string} domain
 * @param {object} [opts]
 * @returns {Promise<null | {
 *   domain: string,
 *   registered_at: string,        // YYYY-MM-DD
 *   expires_at: string,
 *   last_changed_at: string,
 *   registrar: string,
 *   domain_age_years: number,
 *   status: string[],             // RDAP status codes
 *   probed_at: string,
 *   _raw_endpoint: string
 * }>}
 */
export async function whoisLookup(domain, { fetchImpl = globalThis.fetch } = {}) {
  if (!domain) return null;
  const clean = String(domain).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (!clean) return null;

  const endpoint = endpointFor(clean);
  const data = await fetchJson(endpoint, fetchImpl);
  if (!data || data.status === 404) return null;

  const registered_at = findEvent(data.events, 'registration');
  const expires_at = findEvent(data.events, 'expiration');
  const last_changed_at = findEvent(data.events, 'last changed');
  const registrar = findRegistrar(data.entities);

  // .au RDAP redacts registration date for privacy (auDA policy).
  // Use last_changed_at as a fallback signal of domain activity · but flag the source.
  // True domain age preferred via Wayback first_snapshot in enrichment orchestrator.
  let domain_age_years = null;
  let domain_age_source = null;
  if (registered_at) {
    domain_age_years = Math.floor((Date.now() - Date.parse(registered_at)) / (365.25 * 86400 * 1000));
    domain_age_source = 'rdap_registration';
  }
  // No fallback to last_changed_at here · misleading (registrars 'last change' could be a renewal · not registration)

  return {
    domain: clean,
    registered_at,                                  // may be null for .au (privacy redacted)
    expires_at,
    last_changed_at,
    registrar,
    domain_age_years,
    domain_age_source,                              // 'rdap_registration' or null
    status: Array.isArray(data.status) ? data.status : [],
    privacy_redacted: !registered_at && /\.au$/i.test(clean),
    probed_at: new Date().toISOString(),
    _raw_endpoint: endpoint,
  };
}
