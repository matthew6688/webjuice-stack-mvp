const BRAND = {
  cream: '#FFF6EC',
  paper: '#FFFCF7',
  charcoal: '#17191C',
  muted: '#5E6268',
  coral: '#FF5A3D',
  peach: '#FFE1CE',
  citrus: '#FFD45A',
  mint: '#CDECCF',
  sky: '#8BD3F7',
};

const DEFAULT_LOGO_URL = 'https://profitslocal.com/brand/logo-horizontal.svg';

export function renderProfitsLocalEmail({
  subject = 'ProfitsLocal update',
  eyebrow = 'ProfitsLocal',
  intro = '',
  details = [],
  sections = [],
  cta = null,
  secondaryLinks = [],
  closing = '',
  footerNote = 'ProfitsLocal transactional email. Reply to this email if anything looks wrong.',
  preheader = '',
  logoUrl = DEFAULT_LOGO_URL,
} = {}) {
  const cleanDetails = details
    .map((item) => Array.isArray(item) ? { label: item[0], value: item[1] } : item)
    .filter((item) => item?.label || item?.value);
  const cleanLinks = secondaryLinks.filter((link) => link?.url);
  const preheaderText = preheader || intro || subject;
  const detailRows = cleanDetails.map((item) => `
    <tr>
      <th>${escapeHtml(item.label || 'Detail')}</th>
      <td>${renderDetailValue(item)}</td>
    </tr>
  `).join('');
  const sectionHtml = sections.map((section) => `
    <tr>
      <td class="section-box">
        ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
        ${section.body ? `<p>${renderRichText(section.body)}</p>` : ''}
        ${section.items?.length ? `<ul>${section.items.map((item) => `<li>${renderRichText(item)}</li>`).join('')}</ul>` : ''}
      </td>
    </tr>
  `).join('');
  const secondary = cleanLinks.length
    ? `<div class="secondary-links">${cleanLinks.map((link) => `<a href="${escapeAttribute(link.url)}">${escapeHtml(link.label)}</a>`).join('')}</div>`
    : '';
  const ctaHtml = cta?.url
    ? `<a class="button" href="${escapeAttribute(cta.url)}">${escapeHtml(cta.label || 'Open link')}</a>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(subject)}</title>
    <style>
      body { margin: 0; padding: 0; background: ${BRAND.cream}; color: ${BRAND.charcoal}; font-family: Arial, Helvetica, sans-serif; }
      table { border-collapse: collapse; }
      a { color: ${BRAND.charcoal}; }
      .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; }
      .page { width: 100%; background: ${BRAND.cream}; padding: 28px 0; }
      .container { width: 100%; max-width: 640px; margin: 0 auto; }
      .card { background: ${BRAND.paper}; border: 2px solid ${BRAND.charcoal}; border-radius: 24px; overflow: hidden; }
      .header { padding: 22px 28px 18px; border-bottom: 2px solid ${BRAND.charcoal}; }
      .logo { display: block; width: 178px; max-width: 178px; height: auto; border: 0; outline: none; text-decoration: none; }
      .email-type { font-size: 12px; line-height: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${BRAND.muted}; text-align: right; }
      .inner { padding: 28px; }
      .eyebrow { display: block; margin: 0 0 10px; color: ${BRAND.coral}; font-size: 12px; line-height: 16px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { margin: 0 0 14px; font-family: Georgia, 'Times New Roman', serif; font-size: 38px; line-height: 42px; letter-spacing: -0.02em; font-weight: 500; }
      h2 { margin: 0 0 8px; font-size: 16px; line-height: 1.3; }
      p { margin: 0 0 16px; font-size: 16px; line-height: 25px; color: ${BRAND.muted}; }
      .details { width: 100%; margin: 24px 0; border: 1.5px solid ${BRAND.charcoal}; border-radius: 16px; overflow: hidden; }
      .details th, .details td { border-bottom: 1px solid ${BRAND.charcoal}; padding: 12px 14px; text-align: left; vertical-align: top; font-size: 13px; line-height: 18px; }
      .details tr:last-child th, .details tr:last-child td { border-bottom: 0; }
      .details th { width: 42%; background: ${BRAND.peach}; font-weight: 700; color: ${BRAND.charcoal}; }
      .details td { color: ${BRAND.charcoal}; word-break: normal; }
      .text-link { color: ${BRAND.charcoal} !important; font-weight: 900; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
      .link-pill { display: inline-block; background: ${BRAND.mint}; border: 1.5px solid ${BRAND.charcoal}; border-radius: 999px; color: ${BRAND.charcoal} !important; font-size: 13px; font-weight: 800; line-height: 16px; padding: 8px 11px; text-decoration: none; }
      .link-host { display: inline-block; margin-left: 8px; color: ${BRAND.muted}; font-size: 12px; }
      .button { display: inline-block; margin: 2px 0 18px; background: ${BRAND.coral}; color: #ffffff !important; border-radius: 999px; padding: 15px 24px; text-decoration: none; font-size: 15px; line-height: 18px; font-weight: 800; }
      .secondary-links { margin: 0 0 18px; }
      .secondary-links a { display: inline-block; margin: 0 8px 8px 0; background: ${BRAND.mint}; border: 1.5px solid ${BRAND.charcoal}; border-radius: 999px; padding: 10px 14px; text-decoration: none; font-weight: 800; font-size: 13px; line-height: 16px; }
      .closing { margin-top: 4px; }
      .section-box { background: #ffffff; border: 1.5px solid ${BRAND.charcoal}; border-radius: 16px; padding: 16px; }
      .section-box ul { margin: 8px 0 0; padding-left: 20px; }
      .section-box li { margin: 6px 0; font-size: 14px; line-height: 1.5; }
      .footer-cell { padding: 20px 28px 24px; border-top: 1.5px solid ${BRAND.charcoal}; background: ${BRAND.cream}; }
      .footer { margin: 0; font-size: 13px; line-height: 20px; color: ${BRAND.muted}; }
      @media (max-width: 520px) {
        .page { padding: 16px 0; }
        .inner { padding: 22px; }
        .header { padding: 18px 20px 14px; }
        .logo { width: 150px; max-width: 150px; }
        h1 { font-size: 31px; line-height: 35px; }
        .details th, .details td { display: block; width: 100%; padding: 10px 0; }
        .details th { border-bottom: 0; padding: 10px 12px 0; }
        .details td { padding: 8px 12px 12px; }
      }
    </style>
  </head>
  <body>
    <div class="preheader">${escapeHtml(preheaderText)}</div>
    <table role="presentation" class="page">
      <tr>
        <td>
	          <table role="presentation" class="container">
	            <tr>
	              <td class="card">
                  <table role="presentation" width="100%" class="header" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="left">
                        <img class="logo" src="${escapeAttribute(logoUrl)}" width="178" alt="profitslocal">
                      </td>
                      <td class="email-type" align="right">${escapeHtml(eyebrow)}</td>
                    </tr>
                  </table>
	                <div class="inner">
	                  <div class="eyebrow">${escapeHtml(eyebrow)}</div>
	                  <h1>${escapeHtml(subject)}</h1>
                  ${intro ? `<p>${escapeHtml(intro)}</p>` : ''}
                  ${detailRows ? `<table role="presentation" class="details">${detailRows}</table>` : ''}
                  ${ctaHtml}
                  ${secondary}
                  ${sectionHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sectionHtml}</table>` : ''}
                  ${closing ? `<p class="closing">${renderRichText(closing)}</p>` : ''}
	                </div>
                  ${footerNote ? `<div class="footer-cell"><p class="footer">${escapeHtml(footerNote)}</p></div>` : ''}
	              </td>
	            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function detailsFromObject(object) {
  return Object.entries(object || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => ({
      label: titleize(key),
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }));
}

export function keyValueText(details = []) {
  return details
    .map((item) => Array.isArray(item) ? { label: item[0], value: item[1] } : item)
    .filter((item) => item?.label || item?.value)
    .map((item) => `${item.label || 'Detail'}: ${item.value || ''}`)
    .join('\n');
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function renderDetailValue(item) {
  const label = item?.label || 'Detail';
  const value = item?.value || '';
  if (item?.url) {
    return renderCompactLink(item.url, item.linkLabel || value || label, label);
  }
  const stringValue = String(value);
  if (isUrlOnly(stringValue)) {
    return renderCompactLink(stringValue, linkLabelFor(label, stringValue), label);
  }
  return renderRichText(stringValue, label);
}

function renderRichText(value, label = 'Detail') {
  return String(value || '')
    .split(/(https?:\/\/[^\s<]+)/g)
    .map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return renderCompactLink(part, linkLabelFor(label, part, index), label);
      }
      return escapeHtml(part).replace(/\n/g, '<br>');
    })
    .join('');
}

function renderCompactLink(url, text, label = 'Link') {
  const host = hostLabel(url);
  return [
    `<a class="link-pill" href="${escapeAttribute(url)}">${escapeHtml(text || linkLabelFor(label, url))}</a>`,
    host ? `<span class="link-host">${escapeHtml(host)}</span>` : '',
  ].join('');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isUrlOnly(value) {
  return /^https?:\/\/[^\s<]+$/.test(String(value || '').trim());
}

function hostLabel(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function linkLabelFor(label, url, index = 0) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('approve')) return 'Approve site';
  if (normalized.includes('revision form')) return 'Request revision';
  if (normalized.includes('buy extra')) return 'Buy extra revision';
  if (normalized.includes('domain setup')) return 'Set up domain';
  if (normalized.includes('live site')) return 'Open live site';
  if (normalized.includes('review preview') || normalized === 'preview') return 'Open preview';
  if (normalized.includes('intake')) return 'Complete intake';
  if (normalized.includes('google')) return 'Open Google profile';
  if (normalized.includes('website')) return 'Open website';
  if (normalized.includes('asset') || normalized.includes('file')) return `Open asset${index ? ` ${index + 1}` : ''}`;
  const host = hostLabel(url);
  if (host.includes('profitslocal.com')) return 'Open ProfitsLocal link';
  return 'Open link';
}

function titleize(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
