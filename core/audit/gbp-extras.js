/**
 * GBP Posts + Q&A scraper via Playwright on the Google Maps place page.
 *
 * Not available via Google Places API (Places only returns 5 reviews;
 * Posts and Q&A require the GBP Business Profile API which is owner-
 * authenticated only). gosom Docker scraper output also doesn't include
 * these. So we scrape ourselves.
 *
 * Tier T0 (local Playwright). Latency ~15-25s/lead because of JS-heavy
 * Maps page + tab navigation.
 *
 * Outputs:
 *   {
 *     ok, place_url, posts: [{ date_text, body, image_count }],
 *     post_count, last_post_relative,
 *     questions: [{ q, a, owner_replied, asker_name }],
 *     question_count, answered_question_count, owner_reply_rate,
 *     observations: [...]   // sales-relevant findings
 *   }
 *
 * Sales signals this surfaces:
 *   - Dormant Posts (no update in 6+ months) → SMM month package candidate
 *   - High Q&A volume + low owner-reply-rate → "customers are asking, no
 *     one is answering" angle
 *   - Recent Posts about specific services → existing content seeds for
 *     redesign blog
 */

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_500;

function relativeToApproxDate(relText) {
  if (!relText) return null;
  const lower = relText.toLowerCase();
  const now = Date.now();
  const dayMs = 86_400_000;
  const m = lower.match(/(\d+)\s+(year|month|week|day|hour)/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { hour: 1/24, day: 1, week: 7, month: 30, year: 365 }[unit] || 0;
  return new Date(now - n * mult * dayMs).toISOString().slice(0, 10);
}

export async function scrapeGbpExtras({
  placeUrl,
  page,            // existing Playwright page (or null → spin up our own)
  browser,         // existing browser (or null)
  timeoutMs = 90_000,
  closePageWhenDone = true,
} = {}) {
  if (!placeUrl) return { ok: false, reason: 'placeUrl required' };

  // Set up Playwright if not provided
  let localBrowser = browser;
  let localPage = page;
  let createdBrowser = false;
  if (!localBrowser) {
    const { chromium } = await import('playwright');
    localBrowser = await chromium.launch({ headless: true });
    createdBrowser = true;
  }
  if (!localPage) {
    const ctx = await localBrowser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    localPage = await ctx.newPage();
  }

  const result = {
    ok: false,
    place_url: placeUrl,
    posts: [],
    post_count: 0,
    last_post_relative: null,
    last_post_approx_date: null,
    questions: [],
    question_count: 0,
    answered_question_count: 0,
    owner_reply_rate: null,
    observations: [],
  };

  try {
    await localPage.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await localPage.waitForTimeout(SETTLE_MS);

    // ── Updates / Posts tab ──
    // The Google Maps place panel has tabs. "Updates" or "Posts from the merchant".
    // Selectors are fragile; try a couple of patterns.
    const updatesTabSelectors = [
      'button[aria-label*="Updates"]',
      'button[role="tab"]:has-text("Updates")',
      'div[role="tab"]:has-text("Updates")',
      'button:has-text("Updates from")',
    ];
    let openedUpdates = false;
    for (const sel of updatesTabSelectors) {
      try {
        const el = await localPage.waitForSelector(sel, { timeout: 3000, state: 'visible' });
        if (el) {
          await el.click();
          await localPage.waitForTimeout(SETTLE_MS);
          openedUpdates = true;
          break;
        }
      } catch {}
    }

    if (openedUpdates) {
      // Scroll the panel to load more posts
      try {
        await localPage.evaluate(() => {
          const containers = document.querySelectorAll('[role="region"], [role="main"], div[aria-label*="Update"]');
          for (const c of containers) c.scrollBy(0, c.scrollHeight);
        });
        await localPage.waitForTimeout(1500);
      } catch {}

      // Extract post text + relative dates
      const posts = await localPage.evaluate(() => {
        // Heuristic: posts contain a date span (e.g. "2 weeks ago") + body text
        const candidates = Array.from(document.querySelectorAll('[role="article"], div[aria-label*="post"], div.section-result, .section-listing-update-feed'));
        const out = [];
        for (const c of candidates.slice(0, 20)) {
          const text = c.innerText?.trim() || '';
          if (!text || text.length < 30) continue;
          // Look for relative date pattern at top
          const dateMatch = text.match(/^(\d+\s+(?:hours?|days?|weeks?|months?|years?)\s+ago|yesterday|today)/i);
          const body = dateMatch ? text.slice(dateMatch[0].length).trim() : text;
          const imgs = c.querySelectorAll('img').length;
          out.push({
            date_text: dateMatch ? dateMatch[0] : null,
            body: body.slice(0, 1000),
            image_count: imgs,
          });
        }
        return out;
      }).catch(() => []);

      result.posts = posts;
      result.post_count = posts.length;
      result.last_post_relative = posts[0]?.date_text || null;
      result.last_post_approx_date = relativeToApproxDate(result.last_post_relative);
    } else {
      result.observations.push('未检测到 Updates / Posts 板块（可能客户从未发过 GBP post）');
    }

    // ── Q&A section ──
    // Navigate back / find the Q&A section. Often appears on the main place panel
    // as "Questions & answers" or "Q&A".
    const qaTriggers = [
      'button[aria-label*="Questions"]',
      'button:has-text("Questions & answers")',
      'div[role="tab"]:has-text("Questions")',
      'a[aria-label*="See all" i]:has-text("question")',
    ];
    let openedQa = false;
    for (const sel of qaTriggers) {
      try {
        const el = await localPage.waitForSelector(sel, { timeout: 3000, state: 'visible' });
        if (el) {
          await el.click();
          await localPage.waitForTimeout(SETTLE_MS);
          openedQa = true;
          break;
        }
      } catch {}
    }

    if (openedQa) {
      const questions = await localPage.evaluate(() => {
        const out = [];
        const blocks = Array.from(document.querySelectorAll('[role="article"], div[aria-label*="question" i], .section-question'));
        for (const b of blocks.slice(0, 30)) {
          const text = b.innerText?.trim() || '';
          if (!text || text.length < 10) continue;
          // Pattern: Q line, then "Answered by"/"Reply by" line, then A
          const ownerReplyMarker = /(owner|business)\s*['']?s?\s*(reply|response)/i.test(text)
            || /response from the owner/i.test(text);
          // Naive split
          const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
          out.push({
            q: parts[0]?.slice(0, 400) || '',
            a: parts.slice(1, 4).join(' ').slice(0, 600),
            owner_replied: ownerReplyMarker,
            full_text: text.slice(0, 800),
          });
        }
        return out;
      }).catch(() => []);

      result.questions = questions;
      result.question_count = questions.length;
      result.answered_question_count = questions.filter((q) => q.owner_replied || q.a?.length > 0).length;
      result.owner_reply_rate = questions.length
        ? Number((questions.filter((q) => q.owner_replied).length / questions.length).toFixed(2))
        : null;
    } else {
      result.observations.push('未检测到 Q&A 板块（可能没人提过问题，或 Google 没显示）');
    }

    // ── Sales-relevant observations ──
    const daysSincePost = result.last_post_approx_date
      ? Math.round((Date.now() - new Date(result.last_post_approx_date).getTime()) / 86_400_000)
      : null;

    if (daysSincePost == null && result.post_count === 0) {
      result.observations.push('未抓到 GBP Posts 内容（可能客户从未发过 post，也可能 Maps DOM 选择器需要更新 — 销售前应人工核对 google.com/maps/place/<biz> 确认）。如果确认是 0，则是 SMM 月度包销售切入。');
    } else if (daysSincePost != null && daysSincePost > 180) {
      result.observations.push(`GBP 上次 post 是 ${result.last_post_relative}（约 ${daysSincePost} 天前）— Google 对长期没更新的商家会降低本地搜索权重。`);
    } else if (daysSincePost != null && daysSincePost <= 30) {
      result.observations.push(`GBP 在过去一个月有 post 更新 — 客户/agency 在主动运营，SMM 升级机会有限。`);
    }

    if (result.question_count > 0 && result.owner_reply_rate != null && result.owner_reply_rate < 0.5) {
      result.observations.push(`Q&A 有 ${result.question_count} 个问题但商家回复率仅 ${Math.round(result.owner_reply_rate * 100)}% — 「客户在问但没人答」是销售切入。`);
    }
    if (result.question_count >= 5) {
      result.observations.push(`Q&A 有 ${result.question_count} 条公开问答 — 内容素材，redesign 后的 FAQ 页可直接引用。`);
    }

    result.ok = true;
  } catch (err) {
    result.reason = err.message;
    result.ok = false;
  } finally {
    if (closePageWhenDone && localPage && !page) {
      try { await localPage.context().close(); } catch {}
    }
    if (createdBrowser) {
      try { await localBrowser.close(); } catch {}
    }
  }

  return result;
}
