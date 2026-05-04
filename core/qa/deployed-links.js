export async function checkDeployedPreview(url, {
  timeoutMs = 10000,
  checkInternalLinks = true,
} = {}) {
  const result = {
    url,
    ok: false,
    status: null,
    contentType: '',
    title: '',
    checked: [],
    errors: [],
    warnings: [],
  };

  if (!url) {
    result.errors.push('preview URL missing');
    return result;
  }

  const response = await fetchWithTimeout(url, timeoutMs);
  result.status = response.status;
  result.contentType = response.headers.get('content-type') || '';
  result.checked.push({ label: 'preview', value: url, status: response.status });

  if (!response.ok) {
    result.errors.push(`preview returned HTTP ${response.status}`);
    return result;
  }

  if (!result.contentType.includes('text/html')) {
    result.warnings.push(`preview content-type is ${result.contentType || 'unknown'}`);
    result.ok = true;
    return result;
  }

  const html = await response.text();
  result.title = extractTitle(html);
  if (!result.title) result.warnings.push('HTML title missing');
  if (!html.match(/href=["']tel:/i)) result.warnings.push('tel: CTA not found in deployed HTML');
  if (!html.match(/google\.com\/maps|maps\.app\.goo\.gl/i)) result.warnings.push('Google Maps link not found in deployed HTML');

  if (checkInternalLinks) {
    const internalLinks = extractInternalLinks(url, html).slice(0, 25);
    for (const link of internalLinks) {
      const linkResponse = await fetchWithTimeout(link, timeoutMs, { method: 'HEAD' });
      result.checked.push({ label: 'internal', value: link, status: linkResponse.status });
      if (!linkResponse.ok) result.errors.push(`internal link failed: ${link} returned HTTP ${linkResponse.status}`);
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}

async function fetchWithTimeout(url, timeoutMs, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(`fetch failed for ${url}: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? decodeEntities(stripTags(match[1]).trim()) : '';
}

function extractInternalLinks(baseUrl, html) {
  const base = new URL(baseUrl);
  const links = new Set();
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) continue;
    if (/^(javascript:|data:)/i.test(href)) continue;
    const url = new URL(href, base);
    url.hash = '';
    if (url.origin !== base.origin) continue;
    links.add(url.toString());
  }
  return [...links];
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
