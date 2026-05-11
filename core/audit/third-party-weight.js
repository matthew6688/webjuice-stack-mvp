/**
 * 3rd-party script weight audit.
 *
 * Captures all JS / tracker requests made during the page's main fetch via
 * Playwright network events, classifies them as 1st-party (same registrable
 * domain) vs 3rd-party (different domain), categorizes the 3rd-party ones
 * (analytics / ad pixel / chat / etc), and sums total bytes + count.
 *
 * Provides sales material: "你的网站光是装的 5 个 tracker 就吃掉 320KB +
 * 800ms 的主线程" — direct lever for performance + privacy story.
 *
 * Usage:
 *   const interceptor = attachThirdPartyWeightInterceptor(page);
 *   await page.goto(url);
 *   ...
 *   const result = interceptor.finalize();
 */

const TRACKER_DOMAINS = {
  // analytics
  'googletagmanager.com': { id: 'gtm', name: 'Google Tag Manager', kind: 'analytics' },
  'google-analytics.com': { id: 'ga', name: 'Google Analytics', kind: 'analytics' },
  'analytics.google.com': { id: 'ga', name: 'Google Analytics', kind: 'analytics' },
  'static.hotjar.com': { id: 'hotjar', name: 'Hotjar', kind: 'analytics' },
  'script.hotjar.com': { id: 'hotjar', name: 'Hotjar', kind: 'analytics' },
  'clarity.ms': { id: 'ms_clarity', name: 'Microsoft Clarity', kind: 'analytics' },
  'plausible.io': { id: 'plausible', name: 'Plausible', kind: 'analytics' },
  'cdn.usefathom.com': { id: 'fathom', name: 'Fathom', kind: 'analytics' },
  'cdn.mxpnl.com': { id: 'mixpanel', name: 'Mixpanel', kind: 'analytics' },
  'cdn.amplitude.com': { id: 'amplitude', name: 'Amplitude', kind: 'analytics' },
  'cdn.segment.com': { id: 'segment', name: 'Segment', kind: 'analytics' },
  // ad pixels
  'connect.facebook.net': { id: 'meta_pixel', name: 'Meta Pixel', kind: 'ad_pixel' },
  'snap.licdn.com': { id: 'linkedin_insight', name: 'LinkedIn Insight', kind: 'ad_pixel' },
  'analytics.tiktok.com': { id: 'tiktok_pixel', name: 'TikTok Pixel', kind: 'ad_pixel' },
  'ct.pinterest.com': { id: 'pinterest_tag', name: 'Pinterest Tag', kind: 'ad_pixel' },
  'static.ads-twitter.com': { id: 'twitter_pixel', name: 'X / Twitter Pixel', kind: 'ad_pixel' },
  'redditstatic.com': { id: 'reddit_pixel', name: 'Reddit Pixel', kind: 'ad_pixel' },
  'sc-static.net': { id: 'snap_pixel', name: 'Snap Pixel', kind: 'ad_pixel' },
  'bat.bing.com': { id: 'bing_uet', name: 'Microsoft Bing UET', kind: 'ad_pixel' },
  // chat
  'embed.tawk.to': { id: 'tawk', name: 'Tawk.to', kind: 'chat' },
  'widget.intercom.io': { id: 'intercom', name: 'Intercom', kind: 'chat' },
  'js.driftt.com': { id: 'drift', name: 'Drift', kind: 'chat' },
  'client.crisp.chat': { id: 'crisp', name: 'Crisp', kind: 'chat' },
  'static.zdassets.com': { id: 'zendesk', name: 'Zendesk Chat', kind: 'chat' },
  'jivosite.com': { id: 'jivochat', name: 'JivoChat', kind: 'chat' },
  // marketing platforms
  'list-manage.com': { id: 'mailchimp', name: 'Mailchimp', kind: 'email_capture' },
  'klaviyo.com': { id: 'klaviyo', name: 'Klaviyo', kind: 'email_capture' },
  'hs-scripts.com': { id: 'hubspot', name: 'HubSpot', kind: 'email_capture' },
  // common ads / re-targeting
  'doubleclick.net': { id: 'doubleclick', name: 'DoubleClick', kind: 'ad_serving' },
  'googlesyndication.com': { id: 'adsense', name: 'AdSense / Ads', kind: 'ad_serving' },
};

function getRegistrableDomain(hostname) {
  // Very rough — handles `.com.au`, `.co.uk`, `.com`, etc by keeping the
  // last 2-3 labels. Good enough for 1st-party detection.
  if (!hostname) return '';
  const parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) return parts.join('.');
  // Handle 2-segment TLDs (.com.au / .co.uk / .org.au etc)
  const TLD_2 = ['com.au', 'org.au', 'net.au', 'gov.au', 'edu.au', 'co.uk', 'co.nz', 'org.uk', 'net.uk', 'co.jp', 'com.sg'];
  const lastTwo = parts.slice(-2).join('.');
  if (TLD_2.includes(lastTwo) && parts.length >= 3) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export function attachThirdPartyWeightInterceptor(page, primaryUrl) {
  const primaryDomain = getRegistrableDomain((() => {
    try { return new URL(primaryUrl).hostname; } catch { return ''; }
  })());
  const requests = [];
  const seen = new Set();

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (seen.has(url)) return;
      seen.add(url);
      const req = response.request();
      const resourceType = req.resourceType();
      // Only track script + xhr + fetch + document + stylesheet (the things that block / take bandwidth)
      if (!['script', 'xhr', 'fetch', 'document', 'stylesheet', 'image'].includes(resourceType)) return;

      let hostname;
      try { hostname = new URL(url).hostname; } catch { return; }
      const reqDomain = getRegistrableDomain(hostname);
      const isFirstParty = reqDomain === primaryDomain;

      // Identify tracker by domain
      let tracker = null;
      for (const [matchDomain, info] of Object.entries(TRACKER_DOMAINS)) {
        if (hostname.endsWith(matchDomain)) { tracker = info; break; }
      }

      // Get size from headers (content-length is approximate)
      const headers = response.headers();
      const size = Number(headers['content-length']) || 0;

      requests.push({
        url: url.slice(0, 200),
        hostname,
        domain: reqDomain,
        first_party: isFirstParty,
        resource_type: resourceType,
        size_bytes: size,
        tracker_id: tracker?.id || null,
        tracker_name: tracker?.name || null,
        tracker_kind: tracker?.kind || null,
        status: response.status(),
      });
    } catch {}
  });

  return {
    finalize() {
      const firstParty = requests.filter((r) => r.first_party);
      const thirdParty = requests.filter((r) => !r.first_party);
      const trackers = thirdParty.filter((r) => r.tracker_id);

      const sumBytes = (arr) => arr.reduce((a, r) => a + (r.size_bytes || 0), 0);

      // Group trackers by id (multiple files per tool common)
      const trackerSummary = {};
      for (const r of trackers) {
        if (!trackerSummary[r.tracker_id]) trackerSummary[r.tracker_id] = {
          id: r.tracker_id,
          name: r.tracker_name,
          kind: r.tracker_kind,
          request_count: 0,
          bytes: 0,
        };
        trackerSummary[r.tracker_id].request_count += 1;
        trackerSummary[r.tracker_id].bytes += (r.size_bytes || 0);
      }

      return {
        ok: true,
        primary_domain: primaryDomain,
        total_requests: requests.length,
        first_party_count: firstParty.length,
        first_party_bytes: sumBytes(firstParty),
        third_party_count: thirdParty.length,
        third_party_bytes: sumBytes(thirdParty),
        third_party_pct_of_bytes: requests.length
          ? Math.round((sumBytes(thirdParty) / (sumBytes(firstParty) + sumBytes(thirdParty))) * 100)
          : 0,
        tracker_count: trackers.length,
        tracker_bytes: sumBytes(trackers),
        tracker_summary: Object.values(trackerSummary).sort((a, b) => b.bytes - a.bytes),
        // sample top 10 heaviest 3rd-party requests for the report
        heaviest_third_party: thirdParty.sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 10),
      };
    },
  };
}
