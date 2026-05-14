/**
 * V3 D37 (2026-05-14) · Contact info 抓取 · 从网站 rawHtml 抽:
 *   - email (mailto: 链接 + 文本中独立 email pattern)
 *   - contact_us_url (homepage 上的 /contact /contact-us 链接)
 *   - social_links (Facebook/Instagram/LinkedIn/TikTok/YouTube · 含裸 URL)
 *
 * Called from audit pipeline Stage 1 (siteFetchFull 完后) · 写回 entity.latest。
 *
 * Per Matthew (2026-05-14): 客户有网站时 audit 必须抓 email + 表单页 + 社媒 ·
 * profile card 联系方式 section 需要这些数据。
 */

// Social media · 包括裸 URL (facebook.com 不带路径也算)
const SOCIAL_PATTERNS = {
  facebook: /https?:\/\/(?:www\.|m\.)?facebook\.com\/(?:[A-Za-z0-9._-]+\/?)?/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/?)?/gi,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9-]+\/?/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._]+\/?/gi,
  youtube: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:c\/|channel\/|@)[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)\/?/gi,
  twitter: /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+\/?/gi,
};

// Email pattern · 排除常见占位 (example.com / yoursite.com / yourdomain · jsmith@email.com)
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PLACEHOLDER_EMAIL_PATTERNS = [
  /@example\./i, /@yourdomain\./i, /@yoursite\./i, /@email\.com$/i,
  /^test@/i, /^user@/i, /^john@/i, /^name@/i, /^email@/i, /^contact@example/i,
  /^jsmith@/i, /^johndoe@/i,
];

function isPlaceholderEmail(e) {
  for (const p of PLACEHOLDER_EMAIL_PATTERNS) if (p.test(e)) return true;
  return false;
}

/** Extract emails · prefer mailto: links · fallback to text pattern */
function extractEmails(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return [];
  const emails = new Set();
  // 1. mailto: links (most reliable)
  const mailtos = rawHtml.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
  for (const m of mailtos) {
    const e = m.slice(7).toLowerCase().trim();
    if (!isPlaceholderEmail(e)) emails.add(e);
  }
  // 2. text pattern fallback (less reliable · filter placeholders)
  if (emails.size === 0) {
    const matches = rawHtml.match(EMAIL_PATTERN) || [];
    for (const m of matches) {
      const e = m.toLowerCase().trim();
      if (!isPlaceholderEmail(e) && !e.endsWith('.png') && !e.endsWith('.jpg')) {
        emails.add(e);
      }
    }
  }
  return Array.from(emails);
}

/** Extract contact-us URL from anchors */
function extractContactUsUrl(rawHtml, baseUrl) {
  if (!rawHtml || typeof rawHtml !== 'string') return null;
  // anchor href containing "contact" (not "contacted" / "contacts")
  const re = /href=["']([^"']*\/contact(?:-us)?(?:\/|\.html?|#[^"']*|\?[^"']*|$)[^"']*)["']/gi;
  const matches = [];
  let m;
  while ((m = re.exec(rawHtml)) !== null) matches.push(m[1]);
  if (!matches.length) return null;
  // Prefer absolute · else resolve relative to baseUrl
  const first = matches[0];
  if (first.startsWith('http')) return first;
  if (!baseUrl) return first; // relative · operator can prefix
  try {
    return new URL(first, baseUrl).href;
  } catch {
    return first;
  }
}

/** Extract social links · 1 per platform (first occurrence · most prominent) */
function extractSocialLinks(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return {};
  const out = {};
  for (const [platform, re] of Object.entries(SOCIAL_PATTERNS)) {
    const matches = rawHtml.match(re);
    if (matches && matches.length > 0) {
      // Skip bare domain (e.g. "facebook.com/" with no path · likely share button)
      const filtered = matches.filter((u) => {
        const path = u.split(/facebook\.com\/|instagram\.com\/|linkedin\.com\/|tiktok\.com\/|youtube\.com\/|youtu\.be\/|twitter\.com\/|x\.com\//)[1];
        return path && path.length > 1 && !['', '/', '?', '#'].includes(path);
      });
      if (filtered.length > 0) out[platform] = filtered[0].replace(/\/$/, '');
    }
  }
  return out;
}

/**
 * Main entry · extract all 3 contact fields from rawHtml.
 *
 * @param {object} fetchPayload · output from siteFetchFull · has rawHtml + finalUrl
 * @returns {{ emails: string[], contact_us_url: string|null, social_links: object }}
 */
export function extractContactInfo(fetchPayload) {
  if (!fetchPayload?.rawHtml) {
    return { emails: [], contact_us_url: null, social_links: {} };
  }
  const html = fetchPayload.rawHtml;
  const baseUrl = fetchPayload.finalUrl || fetchPayload.url || null;
  return {
    emails: extractEmails(html),
    contact_us_url: extractContactUsUrl(html, baseUrl),
    social_links: extractSocialLinks(html),
  };
}
