import fs from 'fs';
import path from 'path';

export const WEBSITE_STATUS = {
  NO_WEBSITE: 'no_website',
  SOCIAL_OR_THIRD_PARTY: 'social_or_third_party_only',
  INDEPENDENT_HTTP: 'independent_http_site',
  INDEPENDENT_HTTPS: 'independent_https_site',
};

export const RECOMMENDED_DISCOVERY_ACTION = {
  STARTER_CANDIDATE: 'starter_candidate',
  AUDIT_CANDIDATE: 'audit_candidate',
  MANUAL_REVIEW: 'manual_review',
  SKIP: 'skip',
};

const SOCIAL_OR_THIRD_PARTY_HOSTS = [
  'facebook.',
  'instagram.',
  'linktr.ee',
  'ubereats.',
  'doordash.',
  'menulog.',
  'opentable.',
  'thefork.',
  'google.',
];

export function readMapsScraperJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function normalizeMapsScraperRow(row, { niche = '', city = '', query = '' } = {}) {
  const website = cleanUrl(row.web_site || row.website || '');
  const phone = String(row.phone || '').trim();
  const reviewCount = Number(row.review_count || 0);
  const rating = Number(row.review_rating || row.rating || 0);
  const placeId = String(row.place_id || '').trim();
  const mapsUrl = cleanUrl(row.link || '');
  const status = classifyWebsiteStatus(website);
  const imageCount = Array.isArray(row.images) ? row.images.length : 0;
  const hasMenuLink = Boolean(row.menu?.link);
  const hasReservationLink = Boolean(row.reservations);
  const hasOrderOnlineLink = Boolean(row.order_online);
  const relevance = assessDiscoveryRelevance({ row, niche, query });
  const score = scoreDiscoveryLead({
    websiteStatus: status,
    phone,
    reviewCount,
    rating,
    imageCount,
    hasMenuLink,
    hasReservationLink,
    hasOrderOnlineLink,
  });

  return {
    sourceType: 'maps_scraper',
    leadId: placeId || String(row.cid || row.data_id || row.title || '').trim(),
    place_id: placeId,
    cid: String(row.cid || '').trim(),
    data_id: String(row.data_id || '').trim(),
    name: String(row.title || row.name || '').trim(),
    category: String(row.category || '').trim(),
    categories: Array.isArray(row.categories) ? row.categories : [],
    address: String(row.address || '').trim(),
    city,
    niche: niche || String(row.category || '').trim(),
    phone,
    website,
    google_maps_url: mapsUrl,
    rating,
    review_count: reviewCount,
    latitude: Number(row.latitude || 0) || null,
    longitude: Number(row.longtitude || row.longitude || 0) || null,
    timezone: String(row.timezone || '').trim(),
    price_range: String(row.price_range || '').trim(),
    websiteStatus: status,
    discoveryScore: score,
    relevance,
    recommendedAction: recommendDiscoveryAction({ score, websiteStatus: status, phone, reviewCount, relevance }),
    signals: {
      hasPhone: Boolean(phone),
      hasWebsite: Boolean(website),
      hasMenuLink,
      hasReservationLink,
      hasOrderOnlineLink,
      imageCount,
      hasPopularTimes: Boolean(row.popular_times && Object.keys(row.popular_times).length),
      hasAboutAttributes: Array.isArray(row.about) && row.about.length > 0,
    },
    sourceQuery: query,
  };
}

export function buildMapsScraperDiscoveryRun({
  rows,
  query = '',
  niche = '',
  city = '',
  batchId = '',
  runId = '',
  generatedAt = new Date().toISOString(),
  toolLog = {},
} = {}) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  const leads = rows
    .map((row) => normalizeMapsScraperRow(row, { query, niche, city }))
    .sort((a, b) => b.discoveryScore - a.discoveryScore || b.review_count - a.review_count);
  const actionCounts = countBy(leads, (lead) => lead.recommendedAction);
  const websiteStatusCounts = countBy(leads, (lead) => lead.websiteStatus);

  return {
    schemaVersion: 1,
    generatedAt,
    runId,
    query,
    niche,
    city,
    batchId,
    costPolicy: {
      googlePlacesApi: 'not_used_in_discovery',
      emailExtraction: 'disabled',
      reviewBodyExtraction: 'disabled',
      reviewPayloadStorage: 'stripped_before_analysis',
      proxy: toolLog.proxy || 'none',
      notes: [
        'Use maps scraper for cheap broad discovery.',
        'Use Google Places API only after a candidate is selected for official verification/evidence.',
        'Use Tinyfish/site-audit only for selected website audit candidates.',
        'The upstream scraper may return small default review samples; this workflow strips review/email payloads before analysis storage unless explicitly overridden.',
      ],
    },
    toolLog,
    totals: {
      rawRows: rows.length,
      leads: leads.length,
      withWebsite: leads.filter((lead) => lead.website).length,
      withPhone: leads.filter((lead) => lead.phone).length,
      actionCounts,
      websiteStatusCounts,
    },
    queue: {
      starterCandidates: leads.filter((lead) => lead.recommendedAction === RECOMMENDED_DISCOVERY_ACTION.STARTER_CANDIDATE),
      auditCandidates: leads.filter((lead) => lead.recommendedAction === RECOMMENDED_DISCOVERY_ACTION.AUDIT_CANDIDATE),
      manualReview: leads.filter((lead) => lead.recommendedAction === RECOMMENDED_DISCOVERY_ACTION.MANUAL_REVIEW),
      skipped: leads.filter((lead) => lead.recommendedAction === RECOMMENDED_DISCOVERY_ACTION.SKIP),
    },
    leads,
  };
}

export function writeMapsScraperDiscoveryRun(run, runDir) {
  fs.mkdirSync(runDir, { recursive: true });
  writeJson(path.join(runDir, 'discovery-run.json'), run);
  writeJson(path.join(runDir, 'leads.compact.json'), run.leads);
  writeJson(path.join(runDir, 'queue.json'), run.queue);
  fs.appendFileSync(path.join(runDir, 'tool-log.jsonl'), `${JSON.stringify({
    at: run.generatedAt,
    event: 'maps_scraper_discovery_analyzed',
    query: run.query,
    totals: run.totals,
    costPolicy: run.costPolicy,
    toolLog: run.toolLog,
  })}\n`);
  return {
    discoveryRun: path.join(runDir, 'discovery-run.json'),
    compactLeads: path.join(runDir, 'leads.compact.json'),
    queue: path.join(runDir, 'queue.json'),
    toolLog: path.join(runDir, 'tool-log.jsonl'),
  };
}

export function buildLeadDiscoveryLogEntry({ lead, run, rawPath = '', decision = '' } = {}) {
  return {
    at: new Date().toISOString(),
    event: 'maps_scraper_candidate_promoted',
    sourceType: 'maps_scraper',
    query: run?.query || lead?.sourceQuery || '',
    tool: run?.toolLog?.tool || 'gosom/google-maps-scraper',
    toolVersion: run?.toolLog?.toolVersion || 'docker:gosom/google-maps-scraper:latest',
    rawPath,
    placeId: lead?.place_id || '',
    cid: lead?.cid || '',
    websiteStatus: lead?.websiteStatus || '',
    discoveryScore: lead?.discoveryScore ?? null,
    recommendedAction: decision || lead?.recommendedAction || '',
    costPolicy: run?.costPolicy || {},
  };
}

export function classifyWebsiteStatus(website) {
  if (!website) return WEBSITE_STATUS.NO_WEBSITE;
  const host = hostname(website);
  if (SOCIAL_OR_THIRD_PARTY_HOSTS.some((pattern) => host.includes(pattern))) {
    return WEBSITE_STATUS.SOCIAL_OR_THIRD_PARTY;
  }
  if (/^http:\/\//i.test(website)) return WEBSITE_STATUS.INDEPENDENT_HTTP;
  return WEBSITE_STATUS.INDEPENDENT_HTTPS;
}

export function scoreDiscoveryLead({
  websiteStatus,
  phone,
  reviewCount,
  rating,
  imageCount,
  hasMenuLink,
  hasReservationLink,
  hasOrderOnlineLink,
} = {}) {
  let score = 0;
  if (websiteStatus === WEBSITE_STATUS.NO_WEBSITE) score += 40;
  if (websiteStatus === WEBSITE_STATUS.SOCIAL_OR_THIRD_PARTY) score += 35;
  if (websiteStatus === WEBSITE_STATUS.INDEPENDENT_HTTP) score += 20;
  if (phone) score += 15;
  if (reviewCount >= 100) score += 15;
  if (reviewCount >= 500) score += 10;
  if (rating >= 4.3) score += 8;
  if (rating >= 4.7) score += 4;
  if (imageCount >= 8) score += 4;
  if (hasMenuLink) score += 4;
  if (hasReservationLink || hasOrderOnlineLink) score += 3;
  if (websiteStatus === WEBSITE_STATUS.INDEPENDENT_HTTPS && reviewCount >= 1000) score -= 15;
  if (!phone && websiteStatus === WEBSITE_STATUS.NO_WEBSITE) score -= 20;
  return Math.max(0, Math.min(100, score));
}

export function assessDiscoveryRelevance({ row = {}, niche = '', query = '' } = {}) {
  const haystack = [
    row.title,
    row.name,
    row.category,
    ...(Array.isArray(row.categories) ? row.categories : []),
  ].filter(Boolean).join(' ').toLowerCase();
  const rules = relevanceRulesFor({ niche, query });
  if (!rules.requiredAny.length) {
    return { relevant: true, reason: 'no_relevance_rule', matched: [] };
  }
  const matched = rules.requiredAny.filter((token) => haystack.includes(token));
  if (matched.length) {
    return { relevant: true, reason: 'matched_category_or_name', matched };
  }
  return {
    relevant: false,
    reason: 'category_name_mismatch',
    requiredAny: rules.requiredAny,
    haystack,
  };
}

function relevanceRulesFor({ niche = '', query = '' } = {}) {
  const text = `${niche} ${query}`.toLowerCase();
  if (/(roof|gutter|til|restoration|metal\s*roof)/.test(text)) {
    return { requiredAny: ['roof', 'gutter', 'til', 'restoration', 'metal'] };
  }
  if (/(restaurant|cafe|dining|food|bar|pizza|noodle|bakery|brunch)/.test(text)) {
    return { requiredAny: ['restaurant', 'cafe', 'food', 'bar', 'pizza', 'noodle', 'bakery', 'dining', 'brunch'] };
  }
  if (/(dental|dentist|clinic)/.test(text)) {
    return { requiredAny: ['dental', 'dentist', 'clinic'] };
  }
  if (/(salon|hair|beauty|spa)/.test(text)) {
    return { requiredAny: ['salon', 'hair', 'beauty', 'spa'] };
  }
  return { requiredAny: [] };
}

function recommendDiscoveryAction({ score, websiteStatus, phone, reviewCount, relevance }) {
  if (relevance && relevance.relevant === false) return RECOMMENDED_DISCOVERY_ACTION.SKIP;
  if (!phone && websiteStatus === WEBSITE_STATUS.NO_WEBSITE) return RECOMMENDED_DISCOVERY_ACTION.MANUAL_REVIEW;
  if (websiteStatus === WEBSITE_STATUS.NO_WEBSITE && score >= 55) return RECOMMENDED_DISCOVERY_ACTION.STARTER_CANDIDATE;
  if (websiteStatus === WEBSITE_STATUS.SOCIAL_OR_THIRD_PARTY && score >= 55) return RECOMMENDED_DISCOVERY_ACTION.STARTER_CANDIDATE;
  if (websiteStatus === WEBSITE_STATUS.INDEPENDENT_HTTP && score >= 55) return RECOMMENDED_DISCOVERY_ACTION.AUDIT_CANDIDATE;
  if (websiteStatus === WEBSITE_STATUS.INDEPENDENT_HTTPS && score >= 60) return RECOMMENDED_DISCOVERY_ACTION.AUDIT_CANDIDATE;
  if (reviewCount >= 100 && score >= 40) return RECOMMENDED_DISCOVERY_ACTION.MANUAL_REVIEW;
  return RECOMMENDED_DISCOVERY_ACTION.SKIP;
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function cleanUrl(value) {
  return String(value || '').trim();
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
