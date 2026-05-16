/**
 * Australian Business Register (ABN) lookup via ABR Web Services.
 *
 * Free public API · requires registered GUID (5-min signup at
 * https://abr.business.gov.au/Tools/WebServices).
 *
 * Two endpoints (we use both):
 *   1. MatchingNames    · by business name → list of matching ABNs
 *   2. AbnDetails       · by ABN → full details (status / entity / GST / trading names)
 *
 * ENV: ABR_GUID (set in .env.local · graceful skip if missing)
 *
 * Failure: missing GUID · 0 matches · timeout · parse → return null with reason.
 */
const TIMEOUT_MS = 10_000;
const ENDPOINT_NAMES = 'https://abr.business.gov.au/json/MatchingNames.aspx';
const ENDPOINT_ABN = 'https://abr.business.gov.au/json/AbnDetails.aspx';

function parseCallback(text) {
  // ABR returns callback(JSON) JSONP-style · strip wrapper
  const m = text.match(/^callback\(([\s\S]+)\)$/);
  return JSON.parse(m ? m[1] : text);
}

async function fetchJsonp(url, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const text = await r.text();
    return parseCallback(text);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/**
 * Match business name → top N candidate ABNs.
 * Filters to active AU companies by default.
 */
export async function abnSearchByName(name, { guid, maxResults = 5, fetchImpl = globalThis.fetch } = {}) {
  if (!guid) return { ok: false, reason: 'ABR_GUID env var missing · register free at abr.business.gov.au/Tools/WebServices' };
  if (!name) return { ok: false, reason: 'name required' };
  const url = `${ENDPOINT_NAMES}?name=${encodeURIComponent(name)}&maxResults=${maxResults}&guid=${guid}&callback=callback`;
  const data = await fetchJsonp(url, fetchImpl);
  if (!data) return { ok: false, reason: 'fetch failed' };
  if (data.Message && !data.Names?.length) return { ok: false, reason: data.Message };
  const matches = (data.Names || []).map((n) => ({
    abn: n.Abn,
    abn_status: n.AbnStatus,
    name: n.Name,
    name_type: n.NameType,           // legalName / tradingName / businessName
    state: n.State,
    postcode: n.Postcode,
    score: n.Score,                  // ABR similarity 0-100
  }));
  return { ok: true, matches };
}

/**
 * Look up full details by ABN.
 */
export async function abnDetails(abn, { guid, fetchImpl = globalThis.fetch } = {}) {
  if (!guid) return { ok: false, reason: 'ABR_GUID env var missing' };
  if (!abn) return { ok: false, reason: 'abn required' };
  const cleanAbn = String(abn).replace(/\D/g, '');
  if (cleanAbn.length !== 11) return { ok: false, reason: `invalid abn (need 11 digits · got ${cleanAbn.length})` };

  const url = `${ENDPOINT_ABN}?abn=${cleanAbn}&guid=${guid}&callback=callback`;
  const data = await fetchJsonp(url, fetchImpl);
  if (!data) return { ok: false, reason: 'fetch failed' };
  if (data.Message && !data.Abn) return { ok: false, reason: data.Message };

  return {
    ok: true,
    abn: cleanAbn,
    abn_formatted: cleanAbn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4'),
    abn_status: data.AbnStatus,                                    // "Active" / "Cancelled"
    abn_status_effective_from: data.AbnStatusEffectiveFrom,
    acn: data.Acn || null,
    entity_name: data.EntityName,
    entity_type_code: data.EntityTypeCode,
    entity_type_name: data.EntityTypeName,                         // "Australian Private Company" etc.
    gst_registered: !!data.Gst,
    gst_effective_from: data.Gst || null,
    address_state: data.AddressState,
    address_postcode: data.AddressPostcode,
    address_effective_from: data.AddressDate,
    trading_names: Array.isArray(data.BusinessName) ? data.BusinessName : [],
  };
}

/**
 * Convenience: name → top match → full details (combines both endpoints).
 * Returns null if no match or any step fails.
 */
export async function abnLookupByName(name, { guid, fetchImpl = globalThis.fetch, city = null } = {}) {
  const search = await abnSearchByName(name, { guid, fetchImpl, maxResults: 10 });
  if (!search.ok || !search.matches.length) return null;

  // Prefer state match if city given (rough · pick first AU-state result)
  // Otherwise take highest score (already sorted by ABR)
  let best = search.matches[0];
  if (city) {
    const cityState = cityToState(city);
    if (cityState) {
      const stateMatch = search.matches.find((m) => m.state === cityState);
      if (stateMatch) best = stateMatch;
    }
  }

  const details = await abnDetails(best.abn, { guid, fetchImpl });
  if (!details.ok) return null;

  return {
    ...details,
    search_method: 'by_name',
    search_query: name,
    search_score: best.score,
    probed_at: new Date().toISOString(),
  };
}

function cityToState(city) {
  if (!city) return null;
  const c = String(city).toLowerCase();
  // Rough mapping · 主要城市
  if (/brisbane|gold coast|sunshine coast|toowoomba|cairns|townsville|mackay/.test(c)) return 'QLD';
  if (/sydney|newcastle|wollongong|wagga|tweed|tamworth|albury/.test(c)) return 'NSW';
  if (/melbourne|geelong|ballarat|bendigo|shepparton/.test(c)) return 'VIC';
  if (/perth|fremantle|bunbury/.test(c)) return 'WA';
  if (/adelaide/.test(c)) return 'SA';
  if (/hobart|launceston/.test(c)) return 'TAS';
  if (/darwin/.test(c)) return 'NT';
  if (/canberra/.test(c)) return 'ACT';
  return null;
}
