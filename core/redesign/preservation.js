import fs from 'fs';
import path from 'path';

export function buildRedesignPreservationPacket({
  clientSlug,
  niche = 'generic',
  websiteUrl = '',
  googleSearchText = '',
  content = {},
  design = {},
  pages = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!clientSlug) throw new Error('clientSlug is required');
  const facts = buildCoreFacts({ content, googleSearchText, websiteUrl });
  const currentSitemap = buildCurrentSitemap({ websiteUrl, content, pages, googleSearchText });
  const proposedSitemap = buildProposedSitemap({ currentSitemap, niche, content });
  const urlPreservation = buildUrlPreservation({ currentSitemap, proposedSitemap });
  const brandAssets = buildBrandAssets({ content, design });
  const contentPreservationMap = buildContentPreservationMap({ currentSitemap, proposedSitemap, facts, content });
  const seoPlan = buildSeoPlan({ websiteUrl, currentSitemap, proposedSitemap, niche, facts });
  const headerFooterNavigation = buildHeaderFooterNavigation({ currentSitemap, content });
  const nicheAdapter = buildNicheAdapter({ niche, content });
  const readiness = buildReadiness({
    facts,
    brandAssets,
    currentSitemap,
    proposedSitemap,
    urlPreservation,
    nicheAdapter,
  });

  return {
    schemaVersion: 1,
    clientSlug,
    niche,
    sourceWebsiteUrl: websiteUrl || facts.website || '',
    generatedAt,
    toolStrategy: {
      primaryCrawler: 'firecrawl',
      browserTruthCheck: 'dokobot',
      visualQa: 'playwright',
      localAudit: 'ollama',
    },
    currentSitemap,
    proposedSitemap,
    urlPreservation,
    coreBusinessFacts: facts,
    brandAssets,
    contentPreservationMap,
    seoPlan,
    headerFooterNavigation,
    nicheAdapter,
    readiness,
  };
}

export function saveRedesignPreservationPacket(packet, { outDir } = {}) {
  const dir = outDir || path.join('clients', packet.clientSlug, 'redesign');
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'preservation-packet.json');
  const mdPath = path.join(dir, 'preservation-packet.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderPreservationMarkdown(packet));
  return { jsonPath, mdPath };
}

export function renderPreservationMarkdown(packet) {
  return [
    `# Redesign Preservation Packet: ${packet.coreBusinessFacts.businessName || packet.clientSlug}`,
    '',
    `Generated: ${packet.generatedAt}`,
    `Niche: ${packet.niche}`,
    `Source website: ${packet.sourceWebsiteUrl || 'missing'}`,
    `Readiness: ${packet.readiness.status}`,
    '',
    '## Core Business Facts',
    factLine('Name', packet.coreBusinessFacts.businessName),
    factLine('Address / Service area', packet.coreBusinessFacts.addressOrServiceArea),
    factLine('Phone', packet.coreBusinessFacts.phone),
    factLine('Email', packet.coreBusinessFacts.email),
    factLine('Primary CTA', packet.coreBusinessFacts.primaryCtaUrl),
    factLine('Maps', packet.coreBusinessFacts.mapUrl),
    '',
    '## Current Sitemap',
    ...packet.currentSitemap.map((page) => `- ${page.importance}: ${page.url} (${page.pageType}) ${page.title ? `- ${page.title}` : ''}`),
    '',
    '## Proposed Sitemap',
    ...packet.proposedSitemap.map((page) => `- ${page.action}: ${page.url} <= ${page.sourceOldUrls.join(', ') || 'new'} (${page.pageType})`),
    '',
    '## URL Preservation',
    ...packet.urlPreservation.keepSameUrl.map((item) => `- keep: ${item}`),
    ...packet.urlPreservation.redirects301.map((item) => `- 301: ${item.from} -> ${item.to}`),
    ...packet.urlPreservation.needsManualRedirectReview.map((item) => `- review: ${item.url} (${item.reason})`),
    '',
    '## SEO Plan',
    ...packet.seoPlan.required.map((item) => `- ${item}`),
    '',
    '## Risks / Missing',
    ...(packet.readiness.blockers.length ? packet.readiness.blockers.map((item) => `- blocker: ${item}`) : ['- No blockers detected.']),
    ...(packet.readiness.warnings.length ? packet.readiness.warnings.map((item) => `- warning: ${item}`) : []),
    '',
  ].join('\n');
}

function buildCoreFacts({ content, googleSearchText, websiteUrl }) {
  const text = googleSearchText || '';
  return {
    businessName: content.hero?.name || firstMatch(text, /^([^\n]+Restaurant[^\n]*)$/mi) || '',
    addressOrServiceArea: content.contact?.address || firstMatch(text, /Address[^:]*:\s*([^\n]+)/i) || firstMatch(text, /\b\d{1,5}\s+[^\n]+(?:QLD|NSW|VIC|CA|NY|TX)[^\n]*/i) || '',
    phone: content.contact?.phone || firstMatch(text, /Phone:\s*([^\n]+)/i) || '',
    email: content.contact?.email || firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || '',
    hours: extractHours(text),
    website: content.contact?.website || websiteUrl || firstMatch(text, /https?:\/\/[^\s\]]+/i) || '',
    mapUrl: content.cta?.mapUrl || content.contact?.googleMapsUrl || '',
    primaryCtaUrl: content.cta?.reserveUrl || content.cta?.callUrl || '',
    socialLinks: extractLinksByWords(text, ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok']),
    criticalClaims: extractCriticalClaims(text),
  };
}

function factLine(label, value) {
  return `- ${label}: ${value || 'missing'}`;
}

function buildCurrentSitemap({ websiteUrl, content, pages, googleSearchText }) {
  const normalizedPages = pages.map(normalizePage).filter((page) => page.url);
  const urls = new Map();
  for (const page of normalizedPages) urls.set(page.url, page);
  if (websiteUrl) urls.set(cleanUrl(websiteUrl), page(cleanUrl(websiteUrl), 'Home', 'home', 'must_keep', 'input'));
  for (const link of extractOfficialSitelinks(googleSearchText)) {
    if (!isSameSite(link.url, websiteUrl)) continue;
    if (!urls.has(link.url)) urls.set(link.url, page(link.url, link.title, inferPageType(link.url, link.title), inferImportance(link.url, link.title), 'dokobot_google_search'));
  }
  if (content.menu?.sourceUrl && !urls.has(content.menu.sourceUrl)) {
    urls.set(content.menu.sourceUrl, page(content.menu.sourceUrl, 'Menu', 'menu', content.menu.sections?.length ? 'must_keep' : 'should_keep', 'content_artifact'));
  }
  if (content.cta?.reserveUrl) {
    urls.set(content.cta.reserveUrl, page(content.cta.reserveUrl, 'Reservation', 'external_cta', 'must_keep', 'content_artifact'));
  }
  return [...urls.values()];
}

function buildProposedSitemap({ currentSitemap, niche, content }) {
  const proposed = [];
  const add = (url, title, pageType, sourceOldUrls, action = 'keep') => {
    proposed.push({ url, title, pageType, sourceOldUrls, action });
  };
  const home = currentSitemap.find((item) => item.pageType === 'home') || currentSitemap[0];
  if (home) add('/', 'Home', 'home', [home.url], 'rewrite');
  const menu = currentSitemap.filter((item) => item.pageType === 'menu');
  if (niche === 'restaurant' && (menu.length || content.menu?.sections?.length)) add('/menu/', 'Menu', 'menu', menu.map((item) => item.url), 'keep');
  const contact = currentSitemap.filter((item) => item.pageType === 'contact');
  if (contact.length || content.contact?.address || content.contact?.phone) add('/contact/', 'Contact', 'contact', contact.map((item) => item.url), contact.length ? 'keep' : 'new');
  const booking = currentSitemap.filter((item) => item.pageType === 'booking');
  if (booking.length) add('/reserve/', 'Reserve', 'booking', booking.map((item) => item.url), 'redirect');
  for (const item of currentSitemap) {
    if (['home', 'menu', 'contact', 'booking', 'external_cta'].includes(item.pageType)) continue;
    if (item.importance === 'must_keep') add(pathnameOrSlug(item.url), item.title || titleFromUrl(item.url), item.pageType, [item.url], 'keep');
  }
  return proposed;
}

function buildUrlPreservation({ currentSitemap, proposedSitemap }) {
  const keepSameUrl = [];
  const redirects301 = [];
  const needsManualRedirectReview = [];
  const droppedUrls = [];
  const oldToNew = new Map();
  for (const pageItem of proposedSitemap) {
    for (const oldUrl of pageItem.sourceOldUrls || []) oldToNew.set(oldUrl, pageItem.url);
  }
  for (const oldPage of currentSitemap) {
    if (oldPage.pageType === 'external_cta') {
      keepSameUrl.push(oldPage.url);
      continue;
    }
    const nextUrl = oldToNew.get(oldPage.url);
    if (!nextUrl) {
      if (oldPage.importance === 'must_keep') needsManualRedirectReview.push({ url: oldPage.url, reason: 'must_keep page has no proposed destination' });
      else droppedUrls.push({ url: oldPage.url, reason: 'low priority or merged content not required as a standalone page' });
    } else if (samePath(oldPage.url, nextUrl)) {
      keepSameUrl.push(oldPage.url);
    } else {
      redirects301.push({ from: oldPage.url, to: nextUrl });
    }
  }
  return { keepSameUrl, redirects301, needsManualRedirectReview, droppedUrls };
}

function buildBrandAssets({ content, design }) {
  return {
    logo: content.brand?.logo || '',
    favicon: '',
    colors: content.brand?.colors || design.tokens?.colors || [],
    fonts: content.brand?.fonts || design.tokens?.fonts || [],
    primaryImages: [
      ...(content.gallery || []).map((item) => item.url).filter(Boolean),
      content.brand?.ogImage,
    ].filter(Boolean),
    needsConfirmation: [
      ...(!content.brand?.logo ? ['logo'] : []),
      'favicon',
    ],
  };
}

function buildContentPreservationMap({ currentSitemap, proposedSitemap, facts, content }) {
  const map = [];
  for (const pageItem of currentSitemap) {
    const destination = proposedSitemap.find((proposed) => proposed.sourceOldUrls.includes(pageItem.url));
    map.push({
      sourceUrl: pageItem.url,
      importance: pageItem.importance,
      destinationUrl: destination?.url || '',
      treatment: destination?.action || (pageItem.importance === 'must_keep' ? 'needs_manual_mapping' : 'drop_with_reason'),
      risk: destination ? '' : 'No proposed destination.',
    });
  }
  for (const fact of ['businessName', 'addressOrServiceArea', 'phone', 'primaryCtaUrl']) {
    map.push({
      sourceUrl: facts.website || '',
      importance: 'must_keep',
      destinationUrl: '/',
      treatment: 'preserve_fact',
      fact,
      value: facts[fact] || '',
      risk: facts[fact] ? '' : `${fact} missing`,
    });
  }
  if (content.menu?.sections?.length) {
    map.push({
      sourceUrl: content.menu.sourceUrl || '',
      importance: 'must_keep',
      destinationUrl: '/menu/',
      treatment: 'preserve_menu_highlights_or_full_menu',
      risk: '',
    });
  }
  return map;
}

function buildSeoPlan({ websiteUrl, currentSitemap, proposedSitemap, niche, facts }) {
  return {
    required: [
      'Preserve old URLs where possible.',
      'Create 301 redirects for changed URLs.',
      'Generate sitemap.xml.',
      'Generate robots.txt.',
      'Set canonical URLs.',
      'Set per-page title and meta description.',
      'Set Open Graph title, description, and image.',
      'Add useful image alt text.',
      'Run broken-link and noindex checks.',
      `Add ${niche === 'restaurant' ? 'Restaurant' : 'LocalBusiness'} structured data.`,
      'Add BreadcrumbList structured data for multi-page sites.',
    ],
    canonicalBase: websiteUrl || facts.website || '',
    structuredData: [
      niche === 'restaurant' ? 'Restaurant' : 'LocalBusiness',
      'Organization',
      ...(proposedSitemap.length > 1 ? ['BreadcrumbList'] : []),
    ],
    oldPageCount: currentSitemap.length,
    newPageCount: proposedSitemap.length,
  };
}

function buildHeaderFooterNavigation({ currentSitemap, content }) {
  const navPages = currentSitemap.filter((item) => ['home', 'menu', 'contact', 'booking', 'about', 'service'].includes(item.pageType));
  return {
    preserveNavCandidates: navPages.map((item) => ({ title: item.title, url: item.url, pageType: item.pageType })),
    requiredHeaderLinks: ['Home', ...(content.menu?.sections?.length ? ['Menu'] : []), 'Contact'],
    requiredFooterFacts: ['business name', 'phone', 'address/service area', 'social links when available'],
    notes: 'Header/footer must preserve customer website identity, not ProfitsLocal sales controls.',
  };
}

function buildNicheAdapter({ niche, content }) {
  if (niche === 'restaurant') {
    return {
      niche,
      requiredFacts: ['menu source when menu is shown', 'reservation/order/call CTA', 'address', 'phone', 'hours when shown'],
      mustNotInvent: ['menu prices', 'hours', 'reviews', 'chef/award claims'],
      schema: ['Restaurant'],
      warnings: [
        ...(!content.menu?.sourceUrl ? ['menu source missing'] : []),
        ...(!content.cta?.reserveUrl ? ['reservation URL missing or not offered'] : []),
      ],
    };
  }
  if (niche === 'roofing') {
    return {
      niche,
      requiredFacts: ['services', 'service area', 'estimate CTA', 'phone/contact form'],
      mustNotInvent: ['license numbers', 'insurance claims', 'warranty', 'years in business', 'emergency availability'],
      schema: ['LocalBusiness'],
      warnings: [],
    };
  }
  return {
    niche,
    requiredFacts: ['business name', 'contact method', 'offer/service summary', 'primary CTA'],
    mustNotInvent: ['licenses', 'prices', 'reviews', 'availability'],
    schema: ['LocalBusiness'],
    warnings: ['No niche adapter configured; using generic local-business rules.'],
  };
}

function buildReadiness({ facts, brandAssets, currentSitemap, proposedSitemap, urlPreservation, nicheAdapter }) {
  const blockers = [];
  const warnings = [];
  if (!currentSitemap.length) blockers.push('current sitemap is empty');
  if (!proposedSitemap.length) blockers.push('proposed sitemap is empty');
  if (!facts.businessName) blockers.push('business name missing');
  if (!facts.phone && !facts.email && !facts.primaryCtaUrl) blockers.push('no customer contact or CTA method found');
  if (!brandAssets.logo) warnings.push('logo missing or unconfirmed');
  if (brandAssets.needsConfirmation.includes('favicon')) warnings.push('favicon missing or unconfirmed');
  if (urlPreservation.needsManualRedirectReview.length) blockers.push('must_keep URLs need manual redirect review');
  warnings.push(...(nicheAdapter.warnings || []));
  return {
    status: blockers.length ? 'blocked' : (warnings.length ? 'needs_customer_confirmation' : 'ready_for_redesign'),
    blockers,
    warnings,
  };
}

function normalizePage(item) {
  return page(
    cleanUrl(item.url || item.href || ''),
    item.title || '',
    item.pageType || inferPageType(item.url, item.title),
    item.importance || inferImportance(item.url, item.title),
    item.source || 'input',
  );
}

function page(url, title, pageType, importance, source) {
  return {
    url,
    title: title || titleFromUrl(url),
    pageType,
    importance,
    source,
    status: 'read',
  };
}

function extractOfficialSitelinks(text = '') {
  const links = [];
  const regex = />\s*([^\n\[]+)\s*\[(\d+)\]\n>\s*(https?:\/\/[^\s\]]+)/g;
  let match;
  while ((match = regex.exec(text))) {
    links.push({ title: match[1].trim(), url: cleanUrl(match[3]) });
  }
  const simpleRegex = /(Lunch & Dinner Menu|Contact|Lunch Specials|The R&R Experience|About|Services|Menu)[^\n]*\[(\d+)\]/gi;
  while ((match = simpleRegex.exec(text))) {
    const ref = new RegExp(`\\[${match[2]}\\]\\s+(https?:\\/\\/[^\\s]+)`);
    const url = text.match(ref)?.[1];
    if (url) links.push({ title: match[1].trim(), url: cleanUrl(url) });
  }
  return uniqueByUrl(links);
}

function extractLinksByWords(text, words) {
  return words.flatMap((word) => {
    const regex = new RegExp(`${word}[^\\n]*\\[(\\d+)\\]`, 'i');
    const ref = text.match(regex)?.[1];
    if (!ref) return [];
    const url = text.match(new RegExp(`\\[${ref}\\]\\s+(https?:\\/\\/[^\\s]+)`))?.[1];
    return url ? [{ label: word, url }] : [];
  });
}

function inferPageType(url = '', title = '') {
  const value = `${url} ${title}`.toLowerCase();
  if (/contact/.test(value)) return 'contact';
  if (/menu|dining|food|drink|lunch|dinner/.test(value)) return 'menu';
  if (/reserve|book|reservation|sevenrooms|opentable|resy/.test(value)) return 'booking';
  if (/about|story|experience/.test(value)) return 'about';
  if (/service|roof|repair|replacement|estimate/.test(value)) return 'service';
  if (/privacy|terms|legal/.test(value)) return 'legal';
  if (url === '/' || /\/?$/.test(url) && !new URLish(url).pathname.replace('/', '')) return 'home';
  return 'page';
}

function inferImportance(url = '', title = '') {
  const pageType = inferPageType(url, title);
  if (['home', 'contact', 'menu', 'booking', 'service', 'legal', 'external_cta'].includes(pageType)) return 'must_keep';
  if (pageType === 'about') return 'should_keep';
  return 'can_merge';
}

function pathnameOrSlug(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  } catch {
    return url.startsWith('/') ? url : `/${slugify(url)}/`;
  }
}

function samePath(oldUrl, nextUrl) {
  if (/^https?:\/\//i.test(oldUrl) && !/^https?:\/\//i.test(nextUrl) && !isSameSite(oldUrl, nextUrl)) return false;
  const oldPath = pathnameOrSlug(oldUrl).replace(/\/$/, '');
  const newPath = pathnameOrSlug(nextUrl).replace(/\/$/, '');
  return oldPath === newPath;
}

function cleanUrl(url) {
  return String(url || '').trim().replace(/[),.]+$/, '');
}

function titleFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ') || 'Home';
  } catch {
    return String(url || '').replace(/^\/|\/$/g, '').replace(/[-_]+/g, ' ') || 'Home';
  }
}

function firstMatch(text, regex) {
  return text.match(regex)?.[1]?.trim() || text.match(regex)?.[0]?.trim() || '';
}

function extractHours(text) {
  return firstMatch(text, /Hours[^:]*:\s*([^\n]+)/i) || '';
}

function extractCriticalClaims(text) {
  const claims = [];
  for (const pattern of [/Reservations required/i, /Private dining room/i, /Outdoor seating/i]) {
    const match = text.match(pattern);
    if (match) claims.push(match[0]);
  }
  return claims;
}

function uniqueByUrl(links) {
  const seen = new Set();
  return links.filter((link) => {
    if (!link.url || seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function isSameSite(url, baseUrl) {
  if (!url || !baseUrl) return true;
  try {
    const parsed = new URL(url, baseUrl);
    const base = new URL(baseUrl);
    return parsed.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '');
  } catch {
    return true;
  }
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function URLish(url) {
  try {
    return new URL(url);
  } catch {
    return { pathname: String(url || '') };
  }
}
