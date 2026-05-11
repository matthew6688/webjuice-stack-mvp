/**
 * Tech stack + marketing analytics detector.
 *
 * Pure function over rawHtml (already fetched by Block D Playwright).
 * Returns { cms, builder, hosting, trackers, ad_pixels, analytics, evidence }.
 *
 * Sales-relevant signals this surfaces:
 *   - CMS: WordPress / Wix / Squarespace / Webflow / Framer / Shopify / etc
 *     → tells us redesign migration complexity + customer's tooling sophistication
 *   - Trackers: GTM / GA4 / Hotjar / Clarity → already measuring something
 *   - Ad pixels: Meta / LinkedIn / TikTok / Google Ads → has run paid campaigns
 *   - Email mkt: Mailchimp / Klaviyo / ActiveCampaign forms → has a list
 *
 * Strategy implications:
 *   - GTM + Pixel + analytics = digitally-mature buyer, bigger budget likely
 *   - Wix / Squarespace = template, easy migration, often DIY-built
 *   - WordPress = established, may have plugin debt but clear content history
 *   - Framer / Webflow = design-conscious, harder to displace
 *   - Nothing detected = blank slate, our pitch is "you're flying blind"
 */

const CMS_RULES = [
  { id: 'wordpress', name: 'WordPress', patterns: [
    /wp-content\/(themes|plugins|uploads)/i,
    /<meta[^>]+name=["']generator["'][^>]+wordpress/i,
    /\/wp-includes\/js\//i,
    /<link[^>]+wp-emoji-release\.min\.js/i,
  ] },
  { id: 'wix', name: 'Wix', patterns: [
    /static\.wixstatic\.com/i,
    /<meta[^>]+name=["']generator["'][^>]+wix/i,
    /wixCIDX/i,
    /_wix\b/,
    /parastorage\.com/i,
  ] },
  { id: 'squarespace', name: 'Squarespace', patterns: [
    /squarespace\.com/i,
    /static1\.squarespace\.com/i,
    /<meta[^>]+name=["']generator["'][^>]+squarespace/i,
    /Static\.SQUARESPACE_CONTEXT/i,
  ] },
  { id: 'webflow', name: 'Webflow', patterns: [
    /<html[^>]+data-wf-/i,
    /webflow\.js/i,
    /assets\.website-files\.com/i,
    /uploads-ssl\.webflow\.com/i,
  ] },
  { id: 'framer', name: 'Framer', patterns: [
    /framerusercontent\.com/i,
    /framer-motion/i,
    /\bframer\.(?:com|website)\b/i,
    /<meta[^>]+name=["']generator["'][^>]+framer/i,
  ] },
  { id: 'shopify', name: 'Shopify', patterns: [
    /cdn\.shopify\.com/i,
    /Shopify\.theme/i,
    /shopify-section/i,
    /<meta[^>]+name=["']generator["'][^>]+shopify/i,
  ] },
  { id: 'ghost', name: 'Ghost', patterns: [
    /<meta[^>]+name=["']generator["'][^>]+ghost/i,
    /ghost-sdk/i,
  ] },
  { id: 'drupal', name: 'Drupal', patterns: [
    /<meta[^>]+name=["']generator["'][^>]+drupal/i,
    /\/sites\/default\/files\//i,
    /Drupal\.settings/i,
  ] },
  { id: 'joomla', name: 'Joomla', patterns: [
    /<meta[^>]+name=["']generator["'][^>]+joomla/i,
    /\/media\/jui\//i,
  ] },
  { id: 'duda', name: 'Duda', patterns: [
    /static\.cdn-website\.com/i,
    /\bduda\.co\b/i,
  ] },
  { id: 'godaddy', name: 'GoDaddy Website Builder', patterns: [
    /godaddy\.com\/builder/i,
    /img1\.wsimg\.com/i,
  ] },
  { id: 'weebly', name: 'Weebly', patterns: [
    /weebly\.com/i,
    /<meta[^>]+name=["']generator["'][^>]+weebly/i,
  ] },
  { id: 'sitecore', name: 'Sitecore', patterns: [/sitecore[\.\/]/i] },
  { id: 'bubble', name: 'Bubble', patterns: [/bubble\.io/i, /b-cdn\.net.*bubble/i] },
];

const ANALYTICS_RULES = [
  { id: 'gtm', name: 'Google Tag Manager', patterns: [
    /googletagmanager\.com\/gtm\.js\?id=GTM-/i,
    /\bGTM-[A-Z0-9]{6,}\b/,
  ] },
  { id: 'ga4', name: 'Google Analytics 4', patterns: [
    /googletagmanager\.com\/gtag\/js\?id=G-/i,
    /\bG-[A-Z0-9]{8,}\b/,
  ] },
  { id: 'ua', name: 'Google Analytics (Universal)', patterns: [
    /\bUA-\d{5,}-\d+\b/,
    /google-analytics\.com\/analytics\.js/i,
  ] },
  { id: 'hotjar', name: 'Hotjar', patterns: [/static\.hotjar\.com/i, /hotjar\.com\/c\/hotjar/i] },
  { id: 'ms_clarity', name: 'Microsoft Clarity', patterns: [/clarity\.ms\/tag\//i] },
  { id: 'plausible', name: 'Plausible', patterns: [/plausible\.io\/js\//i] },
  { id: 'fathom', name: 'Fathom Analytics', patterns: [/cdn\.usefathom\.com/i] },
  { id: 'mixpanel', name: 'Mixpanel', patterns: [/cdn\.mxpnl\.com/i, /mixpanel\.init/i] },
  { id: 'amplitude', name: 'Amplitude', patterns: [/cdn\.amplitude\.com/i] },
  { id: 'segment', name: 'Segment', patterns: [/cdn\.segment\.com\/analytics\.js/i] },
];

const PIXEL_RULES = [
  { id: 'meta_pixel', name: 'Meta (Facebook) Pixel', patterns: [
    /connect\.facebook\.net\/[a-z_]+\/fbevents\.js/i,
    /fbq\(['"]init['"]/,
  ] },
  { id: 'google_ads', name: 'Google Ads Conversion', patterns: [
    /\bAW-\d{8,}\b/,
    /googletagmanager\.com\/gtag\/js\?id=AW-/i,
  ] },
  { id: 'linkedin_insight', name: 'LinkedIn Insight Tag', patterns: [
    /snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/i,
    /_linkedin_data_partner_id/i,
  ] },
  { id: 'tiktok_pixel', name: 'TikTok Pixel', patterns: [
    /analytics\.tiktok\.com\/i18n\/pixel/i,
    /ttq\.load/i,
  ] },
  { id: 'pinterest_tag', name: 'Pinterest Tag', patterns: [/ct\.pinterest\.com\/v3/i] },
  { id: 'twitter_pixel', name: 'X / Twitter Pixel', patterns: [/static\.ads-twitter\.com\/uwt\.js/i, /twq\(['"]config['"]/] },
  { id: 'reddit_pixel', name: 'Reddit Pixel', patterns: [/www\.redditstatic\.com\/ads\/pixel\.js/i] },
  { id: 'snap_pixel', name: 'Snap Pixel', patterns: [/sc-static\.net\/scevent\.min\.js/i] },
  { id: 'bing_uet', name: 'Microsoft (Bing) UET', patterns: [/bat\.bing\.com\/bat\.js/i] },
];

const EMAIL_FORM_RULES = [
  { id: 'mailchimp', name: 'Mailchimp', patterns: [/list-manage\.com\/subscribe/i, /mc-cdn\.com/i] },
  { id: 'klaviyo', name: 'Klaviyo', patterns: [/klaviyo\.com\/onsite\/js/i] },
  { id: 'activecampaign', name: 'ActiveCampaign', patterns: [/activehosted\.com/i] },
  { id: 'hubspot', name: 'HubSpot', patterns: [/js\.hs-scripts\.com/i, /hsforms\.com/i] },
  { id: 'convertkit', name: 'ConvertKit / Kit', patterns: [/f\.convertkit\.com/i, /pages\.convertkit\.com/i] },
];

const CHAT_RULES = [
  { id: 'tawk', name: 'Tawk.to chat', patterns: [/embed\.tawk\.to/i] },
  { id: 'intercom', name: 'Intercom', patterns: [/widget\.intercom\.io/i] },
  { id: 'drift', name: 'Drift', patterns: [/js\.driftt\.com/i] },
  { id: 'crisp', name: 'Crisp chat', patterns: [/client\.crisp\.chat/i] },
  { id: 'zendesk', name: 'Zendesk Chat', patterns: [/static\.zdassets\.com\/ekr\//i] },
  { id: 'jivochat', name: 'JivoChat', patterns: [/jivosite\.com/i] },
];

function matchRules(rules, html) {
  const out = [];
  for (const rule of rules) {
    for (const pat of rule.patterns) {
      const m = html.match(pat);
      if (m) {
        out.push({ id: rule.id, name: rule.name, evidence: m[0].slice(0, 120) });
        break;
      }
    }
  }
  return out;
}

export function detectTechStack({ rawHtml, finalUrl } = {}) {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return { ok: false, reason: 'no rawHtml', cms: null, analytics: [], pixels: [], chat: [], email: [] };
  }

  const cmsHits = matchRules(CMS_RULES, rawHtml);
  const analyticsHits = matchRules(ANALYTICS_RULES, rawHtml);
  const pixelHits = matchRules(PIXEL_RULES, rawHtml);
  const chatHits = matchRules(CHAT_RULES, rawHtml);
  const emailHits = matchRules(EMAIL_FORM_RULES, rawHtml);

  // Hosting hint via X-Powered-By would need response headers; for now rely on URL patterns.
  let hostingHint = null;
  if (/cloudflare/i.test(rawHtml)) hostingHint = 'Cloudflare-fronted';
  else if (/vercel/i.test(rawHtml)) hostingHint = 'Vercel';
  else if (/netlify/i.test(rawHtml)) hostingHint = 'Netlify';

  // Sophistication score — rough sales-readiness signal
  const sophistication = (cmsHits.length ? 1 : 0)
    + (analyticsHits.length ? 1 : 0)
    + (pixelHits.length ? 2 : 0)        // pixels = paid ads = budget
    + (chatHits.length ? 1 : 0)
    + (emailHits.length ? 1 : 0);

  return {
    ok: true,
    cms: cmsHits[0] || null,             // usually one wins; rest treated as noise
    cms_alternatives: cmsHits.slice(1),
    analytics: analyticsHits,
    pixels: pixelHits,
    chat: chatHits,
    email_capture: emailHits,
    hosting_hint: hostingHint,
    sophistication_score: sophistication,
    has_paid_ads_evidence: pixelHits.length > 0,
    has_measurement: analyticsHits.length > 0 || pixelHits.length > 0,
    final_url: finalUrl || null,
  };
}
