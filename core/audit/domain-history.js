/**
 * Domain history + email-deliverability audit.
 *
 * Three signals, all T0 free:
 *   1. WHOIS — domain creation date (= business's online age, SEO equity to preserve)
 *   2. Wayback Machine — when was the site last redesigned? (filter signal:
 *      if redesigned within last 12 months, this lead is unlikely to buy
 *      another redesign now)
 *   3. DNS records (SPF / DKIM / DMARC) — email deliverability posture
 *      (matters for our future SMM / cold-outreach upsells)
 *
 * Implementation:
 *   - WHOIS: use the `whois` command (preinstalled on macOS); parses
 *     "Creation Date" / "Created" / "Domain Registration Date" lines
 *   - Wayback: `https://web.archive.org/cdx/search/cdx?url=<domain>` with
 *     filter for full-page snapshots; pick the dates and bucket them to
 *     detect recent redesigns
 *   - DNS: use Node `dns/promises` to look up TXT records for the apex
 *     domain (SPF + DMARC) and standard DKIM selectors
 */

import { spawnSync } from 'child_process';
import { promises as dns } from 'dns';

const WAYBACK_CDX = 'https://web.archive.org/cdx/search/cdx';

function parseWhoisDate(out) {
  if (!out) return null;
  const lines = out.split('\n').map((l) => l.trim());
  const candidates = [
    /^Creation Date:\s*(.+)$/i,
    /^Created Date:\s*(.+)$/i,
    /^Created On:\s*(.+)$/i,
    /^Created:\s*(.+)$/i,
    /^Domain Registration Date:\s*(.+)$/i,
    /^Registered on:\s*(.+)$/i,
    /^Registration Time:\s*(.+)$/i,
  ];
  for (const line of lines) {
    for (const re of candidates) {
      const m = line.match(re);
      if (m) {
        const d = new Date(m[1]);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
    }
  }
  return null;
}

function whoisLookup(domain) {
  // .au domains require delegated whois (auDA) which doesn't return creation
  // date at all. Also macOS whois doesn't follow referrals reliably. For .au
  // domains we use Wayback first_snapshot as a proxy for "online since".
  const tld = domain.split('.').pop().toLowerCase();
  const isAu = domain.endsWith('.au');
  const args = isAu ? ['-h', 'whois.auda.org.au', domain] : [domain];
  try {
    const r = spawnSync('whois', args, { encoding: 'utf8', timeout: 12_000 });
    if (r.status !== 0 && !r.stdout) return null;
    const out = r.stdout || '';
    // For .au: no Creation Date in auDA response — return last_modified
    if (isAu) {
      const lm = out.match(/^Last Modified:\s*(.+)$/im);
      const lastModIso = lm ? new Date(lm[1]).toISOString() : null;
      return {
        created_iso: null,
        au_last_modified_iso: lastModIso,
        registrar: (out.match(/^Registrar Name:\s*(.+)$/im) || [])[1] || null,
        raw_excerpt: out.slice(0, 800),
      };
    }
    // Generic gTLD — parse Creation Date
    const created = parseWhoisDate(out);
    return { created_iso: created, raw_excerpt: out.slice(0, 800) };
  } catch { return null; }
}

async function waybackHistory(domain, fetchImpl = globalThis.fetch) {
  const url = new URL(WAYBACK_CDX);
  url.searchParams.set('url', domain);
  url.searchParams.set('output', 'json');
  url.searchParams.set('fl', 'timestamp,statuscode,mimetype');
  url.searchParams.append('filter', 'statuscode:200');
  url.searchParams.append('filter', 'mimetype:text/html');
  url.searchParams.set('limit', '500');
  url.searchParams.set('collapse', 'timestamp:6');

  // Wayback CDX 503's anonymously sometimes — set a UA to look like a real
  // client + retry once on 503.
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; ProfitsLocalAudit/1.0)',
    Accept: 'application/json',
  };
  let res;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers });
      if (res.ok) break;
      if (res.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return { snapshot_count: 0, error: `wayback ${res.status}` };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return { snapshot_count: 0, error: err.message };
    }
  }

  try {
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length < 2) return { snapshot_count: 0 };
    const rows = arr.slice(1);  // first row is header
    const dates = rows.map((r) => {
      const ts = r[0];
      if (!/^\d{14}$/.test(ts)) return null;
      return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
    }).filter(Boolean).sort();
    if (!dates.length) return { snapshot_count: 0 };
    return {
      snapshot_count: dates.length,
      first_snapshot: dates[0],
      last_snapshot: dates[dates.length - 1],
      snapshots_per_year: dates.reduce((acc, d) => {
        const y = d.slice(0, 4);
        acc[y] = (acc[y] || 0) + 1;
        return acc;
      }, {}),
    };
  } catch { return null; }
}

async function lookupTxt(name) {
  try { return await dns.resolveTxt(name); } catch { return null; }
}

async function emailDnsPosture(domain) {
  const apex = domain.replace(/^www\./, '');
  const [spfRecords, dmarcRecords] = await Promise.all([
    lookupTxt(apex),
    lookupTxt(`_dmarc.${apex}`),
  ]);

  let spf = null;
  if (spfRecords) {
    const flat = spfRecords.map((r) => r.join('')).find((r) => /^v=spf1\b/i.test(r));
    if (flat) spf = flat;
  }
  let dmarc = null;
  if (dmarcRecords) {
    const flat = dmarcRecords.map((r) => r.join('')).find((r) => /^v=dmarc1/i.test(r));
    if (flat) dmarc = flat;
  }

  // Try common DKIM selectors (best-effort)
  const dkimSelectors = ['default', 'google', 'k1', 'mail', 'selector1', 'selector2', 's1', 's2'];
  const dkimChecks = await Promise.all(
    dkimSelectors.map(async (sel) => {
      const txt = await lookupTxt(`${sel}._domainkey.${apex}`);
      return txt ? sel : null;
    })
  );
  const dkimSelectorsFound = dkimChecks.filter(Boolean);

  // DMARC policy interpretation
  let dmarcPolicy = null;
  if (dmarc) {
    const m = dmarc.match(/p=(\w+)/i);
    if (m) dmarcPolicy = m[1].toLowerCase();
  }

  return {
    spf_present: Boolean(spf),
    spf_record: spf,
    dmarc_present: Boolean(dmarc),
    dmarc_record: dmarc,
    dmarc_policy: dmarcPolicy,
    dkim_selectors_found: dkimSelectorsFound,
    posture: (() => {
      const s = (spf ? 1 : 0) + (dmarc ? 1 : 0) + (dkimSelectorsFound.length ? 1 : 0);
      if (s === 3) return 'strong';
      if (s === 2) return 'partial';
      if (s === 1) return 'weak';
      return 'none';
    })(),
  };
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export async function auditDomainHistory({ baseUrl } = {}) {
  if (!baseUrl) return { ok: false, reason: 'baseUrl required' };
  let host;
  try { host = new URL(baseUrl).hostname.replace(/^www\./, ''); }
  catch { return { ok: false, reason: 'invalid baseUrl' }; }

  const [whois, wayback, dnsPosture] = await Promise.all([
    Promise.resolve().then(() => whoisLookup(host)),
    waybackHistory(host),
    emailDnsPosture(host),
  ]);

  // For .au domains we don't get creation date from whois, so fall back to
  // Wayback's first_snapshot as a "online since approximately" proxy.
  const isAu = host.endsWith('.au');
  const ageReferenceIso = whois?.created_iso || (isAu && wayback?.first_snapshot ? wayback.first_snapshot : null);
  const domainAgeDays = daysSince(ageReferenceIso);
  const lastSnapshotDays = daysSince(wayback?.last_snapshot);
  const firstSnapshotDays = daysSince(wayback?.first_snapshot);

  // Recent-redesign signal: if Wayback snapshots cluster after a recent month
  // and the page differs visibly, redesign likely happened. Heuristic: if
  // there's been a big jump in monthly snapshot count in last 12 months
  // AND first-snapshot to last-snapshot < ~24 months, treat as recent.
  let recent_redesign_signal = null;
  if (wayback?.snapshots_per_year) {
    const years = Object.keys(wayback.snapshots_per_year).sort();
    const lastYear = years[years.length - 1];
    const lastYearSnapshots = wayback.snapshots_per_year[lastYear] || 0;
    const totalSnapshots = wayback.snapshot_count;
    if (Number(lastYear) >= new Date().getUTCFullYear() - 1 && lastYearSnapshots > totalSnapshots * 0.4) {
      recent_redesign_signal = 'possibly redesigned in the last 12 months — many fresh snapshots';
    }
  }

  return {
    ok: true,
    host,
    is_au_domain: isAu,
    domain_age_days: domainAgeDays,
    domain_age_years: domainAgeDays != null ? Math.floor(domainAgeDays / 365) : null,
    domain_age_source: whois?.created_iso ? 'whois_creation_date'
      : (isAu && wayback?.first_snapshot) ? 'wayback_first_snapshot_proxy'
      : null,
    domain_created_iso: whois?.created_iso || null,
    au_last_modified_iso: whois?.au_last_modified_iso || null,
    registrar: whois?.registrar || null,
    wayback: wayback || null,
    days_since_last_wayback_snapshot: lastSnapshotDays,
    days_since_first_wayback_snapshot: firstSnapshotDays,
    recent_redesign_signal,
    email_dns: dnsPosture,
  };
}
