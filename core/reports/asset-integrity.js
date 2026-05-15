/**
 * V3 cycle-26 (2026-05-15) · Asset integrity checker for master.md / audit HTML reports.
 *
 * Goals:
 *   1. Extract every asset reference from master.md (inline images, video, hyperlinks).
 *   2. Local mode: verify each referenced file exists in clients/<slug>/v2/.
 *   3. Remote mode (post-publish): HTTP fetch each URL · ensure 200.
 *
 * Why: cycle-25/26 published entities show URLs in profile card but no one
 * verified the URLs resolve. Broken inline images / 404'd master.md / missing
 * video → silently shipped to operator and (later) customer.
 *
 * Used by:
 *   - scripts/cli/pl-asset-integrity-doctor.js (post-publish · runs live HTTP check)
 *   - scripts/test/test-cycle26-master-md-asset-integrity.mjs (pre-publish · TDD)
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Extract all asset references from master.md content.
 *
 * Asset reference shapes detected:
 *   ![alt](url)               · inline image (markdown)
 *   [label](url)              · hyperlink
 *   <video src=... or url>    · raw URL in body (e.g. video_url frontmatter)
 *
 * @param {string} md · master.md raw text
 * @returns {{
 *   images:    Array<{label, url, line}>,
 *   links:     Array<{label, url, line}>,
 *   videos:    Array<{url, line}>,
 *   frontmatter_assets: { video_url?, desktop_screenshot?, mobile_screenshot? }
 * }}
 */
export function extractAssetRefs(md) {
  const images = [];
  const links = [];
  const videos = [];
  const frontmatter_assets = {};

  // ─── parse frontmatter assets block ──
  const fmEnd = md.indexOf('\n---\n', 4);
  if (md.startsWith('---\n') && fmEnd > 4) {
    const fm = md.slice(4, fmEnd);
    // assets:
    //   video_url: "..."
    //   desktop_screenshot: "..."
    //   mobile_screenshot: "..."
    const assetsMatch = fm.match(/assets:\s*\n((?:\s{2,}[a-z_]+:.*\n?)+)/);
    if (assetsMatch) {
      for (const line of assetsMatch[1].split('\n')) {
        const m = line.match(/^\s*([a-z_]+):\s*"?([^"\n]+?)"?\s*$/);
        if (m) frontmatter_assets[m[1]] = m[2];
      }
    }
  }

  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // inline images ![alt](url)
    for (const m of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      images.push({ label: m[1], url: m[2], line: i + 1 });
    }
    // links [label](url) · skip raw email + tel
    for (const m of line.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g)) {
      if (m[2].startsWith('mailto:') || m[2].startsWith('tel:')) continue;
      links.push({ label: m[1], url: m[2], line: i + 1 });
    }
    // raw video URLs (e.g. master.md "video_url" frontmatter rendered inline)
    for (const m of line.matchAll(/(https?:\/\/[^\s"')]+\.(?:webm|mp4|mov))/gi)) {
      videos.push({ url: m[1], line: i + 1 });
    }
  }

  return { images, links, videos, frontmatter_assets };
}

/**
 * LOCAL mode · verify referenced asset files exist in client v2 dir.
 *
 * Only checks LOCAL refs (./screenshots/x.png, ./evidence/y.png, ./video/z.webm).
 * Skips http(s) URLs (those are remote-mode's job).
 *
 * @param {{md: string, clientV2Dir: string}} ctx
 * @returns {{ok, checked, missing: Array<{path, type, ref}>}}
 */
export function verifyAssetsLocal({ md, clientV2Dir }) {
  const refs = extractAssetRefs(md);
  const missing = [];
  let checked = 0;

  const localUrlPatterns = [
    { type: 'screenshot', dir: 'screenshots', re: /^\.?\/?screenshots\/(.+)$/ },
    { type: 'evidence',   dir: 'evidence',    re: /^\.?\/?evidence\/(.+)$/ },
    { type: 'video',      dir: 'video',       re: /^\.?\/?video\/(.+)$/ },
  ];

  function check(url, type = 'unknown') {
    if (/^https?:\/\//.test(url)) return; // remote · skip
    if (url.startsWith('mailto:') || url.startsWith('tel:')) return;
    for (const p of localUrlPatterns) {
      const m = url.match(p.re);
      if (m) {
        checked++;
        const full = path.join(clientV2Dir, p.dir, m[1]);
        if (!fs.existsSync(full)) missing.push({ path: full, type: p.type, ref: url });
        return;
      }
    }
  }

  for (const i of refs.images) check(i.url, 'image');
  for (const l of refs.links)  check(l.url, 'link');
  for (const v of refs.videos) check(v.url, 'video');

  // frontmatter assets
  for (const [k, v] of Object.entries(refs.frontmatter_assets)) {
    check(v, k);
  }

  return { ok: missing.length === 0, checked, missing, refs };
}

/**
 * REMOTE mode · HTTP fetch each asset URL · verify 200.
 *
 * Used by pl-asset-integrity-doctor post-publish.
 *
 * @param {{md: string, baseUrl: string, fetchImpl?}} ctx
 * @returns {Promise<{ok, checked, broken: Array<{url, status}>}>}
 */
export async function verifyAssetsRemote({ md, baseUrl, fetchImpl = fetch }) {
  const refs = extractAssetRefs(md);
  const broken = [];
  const seen = new Set();
  let checked = 0;

  async function check(url) {
    let full;
    if (/^https?:\/\//.test(url)) full = url;
    else if (url.startsWith('./') || url.startsWith('/')) {
      full = baseUrl.replace(/\/$/, '') + (url.startsWith('/') ? url : url.slice(1));
    } else {
      full = `${baseUrl.replace(/\/$/, '')}/${url}`;
    }
    if (seen.has(full)) return;
    seen.add(full);
    checked++;
    try {
      const r = await fetchImpl(full, { method: 'HEAD' });
      if (!r.ok) broken.push({ url: full, status: r.status });
    } catch (err) {
      broken.push({ url: full, status: 0, error: err.message });
    }
  }

  for (const i of refs.images) await check(i.url);
  for (const l of refs.links)  await check(l.url);
  for (const v of refs.videos) await check(v.url);
  // Also explicitly check master.md / master.report.html / internal-audit / customer-audit existence
  for (const must of ['master.md', 'master.report.html', 'internal-audit-report.html', 'customer-facing-audit.html']) {
    await check(`${baseUrl.replace(/\/$/, '')}/${must}`);
  }

  return { ok: broken.length === 0, checked, broken, refs };
}
