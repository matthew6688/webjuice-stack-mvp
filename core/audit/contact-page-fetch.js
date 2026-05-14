/**
 * V3 D38 (2026-05-14) · Lightweight fetch for /contact/ 等 secondary page
 *
 * 用于 audit Stage 1 末尾 · 抓 contact 页扩充 email + social 覆盖率
 * (homepage 经常无 mailto · contact 页才有完整联系信息)
 *
 * 不用 Playwright (慢 + 占 GPU) · 直接 fetch HTML
 * 失败 try/catch · 不阻塞 audit pipeline
 *
 * Future (P2): 拓展为 multi-page crawl helper · 也抓 /about · /services 用于 reference-adapter
 */

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ProfitsLocal-Audit/1.0';

/**
 * Fetch a single contact page · return { url, finalUrl, rawHtml, status, latencyMs }
 *
 * Compatible shape with siteFetchFull · 直接传给 extractContactInfo
 *
 * @param {string} url contact page URL (resolved abs · 从 extractContactUsUrl)
 * @returns {Promise<{rawHtml: string, finalUrl: string, url: string} | null>}
 */
export async function fetchContactPage(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const rawHtml = await res.text();
    return {
      url,
      finalUrl: res.url || url,
      rawHtml,
      status: res.status,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}
