/**
 * Deterministic grid-balance check (Matthew 2026-05-30).
 *
 * Catches the "stupid" layout bug: N items in a C-column grid that leave a LONE item
 * alone on the last row (e.g. 4 reviews in a 3-col grid → 3+1). Pure rules, no LLM.
 *
 * Rule (Matthew's words "不能有奇数的 item 单独一行"): a row must never contain exactly ONE
 * lone item. Flag when items > cols AND items % cols === 1. (3+2 is fine; 3+1 / 7-in-3col are not.)
 *
 * Columns are read from the page's OWN inline <style> (`grid-template-columns: repeat(N, …)`),
 * so this is template-agnostic. `auto-fit`/`auto-fill` grids are variable-width → reported as
 * `advisory` (we can't know the rendered column count without layout), not a hard orphan.
 *
 * Applies to every item-grid: services (.story-grid), reviews, gallery, projects, before/after,
 * team, coverage, footer colophon — anything matching a `*-grid` class with element children.
 */
import * as cheerio from 'cheerio';

// Grid containers we treat as ITEM grids (vs 2-part layout grids like hero/about/contact which
// are intentionally 2 fixed panes, not a repeating item list).
const LAYOUT_GRID_CLASSES = new Set(['hero-grid', 'about-grid', 'contact-grid', 'field-row']);

/** Parse `.<class> { … grid-template-columns: repeat(N, …) … }` from inline CSS → {class: N}. */
function parseGridColumns(css) {
  const map = {};
  // Strip @media blocks first — we check the DESKTOP base layout; mobile overrides (1fr / 1-col)
  // would otherwise mask the real column count and hide orphans. (Handles one nesting level.)
  css = css.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ');
  // match selectors (possibly compound like `.a.b`) with a grid-template-columns rule
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    const selectors = m[1];
    const body = m[2];
    const gtc = body.match(/grid-template-columns:\s*([^;]+)/i);
    if (!gtc) continue;
    const value = gtc[1].trim();
    let cols = null;
    const rep = value.match(/repeat\(\s*(\d+)\s*,/i);
    if (rep) cols = parseInt(rep[1], 10);
    else if (/auto-fit|auto-fill/i.test(value)) cols = 'auto';
    else if (/^1fr$/i.test(value)) cols = 1;
    else {
      // explicit track list e.g. "1fr 1fr" or "minmax(...) minmax(...)" → count top-level tracks
      const tracks = value.split(/\s+(?![^(]*\))/).filter(Boolean);
      if (tracks.length >= 1 && tracks.length <= 6) cols = tracks.length;
    }
    if (cols == null) continue;
    // A selector group may be comma-separated; each selector may be compound (`.a.b`). Attribute the
    // column count ONLY to the LAST (most specific) class of each selector — otherwise a modifier rule
    // like `.story-grid.story-grid--2col { repeat(2) }` would wrongly overwrite base `.story-grid`'s 3.
    for (const sel of selectors.split(',')) {
      const classes = [...sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
      if (!classes.length) continue;
      map[classes[classes.length - 1]] = cols; // carrier = rightmost class · last CSS definition wins
    }
  }
  return map;
}

/** Effective column count for an element given its class list + the parsed CSS map.
 *  A modifier class (more specific, e.g. reviews-grid--2col) overrides the base grid class. */
function effectiveCols(classList, colMap) {
  let cols = null;
  // base grid class first, then let any modifier (longer class name containing '--' or a digit) override
  const ordered = [...classList].sort((a, b) => a.length - b.length);
  for (const c of ordered) {
    if (colMap[c] != null) cols = colMap[c];
  }
  return cols;
}

/**
 * @param {string} html rendered page HTML (includes inline <style>)
 * @returns {{ findings: Array, checked: Array }}
 *   findings: [{ grid, items, cols, severity, label, detail }]  (orphan rows)
 *   checked:  [{ grid, items, cols, ok }]                        (all item-grids inspected)
 */
export function checkGridBalance(html) {
  const $ = cheerio.load(html);
  const css = $('style').map((_, el) => $(el).text()).get().join('\n');
  const colMap = parseGridColumns(css);

  // Classes that carry a center-last-orphan safety rule (`… :last-child … :nth-child(Nn+1) …`):
  // a lone last item in these grids is intentionally CENTERED, so it is NOT a layout mistake.
  const orphanSafe = new Set();
  for (const m of css.matchAll(/([^{}]*:last-child[^{}]*|[^{}]*:nth-child\([^)]*\)[^{}]*)\{[^{}]*\}/g)) {
    const sel = m[1];
    if (/:last-child/.test(sel) && /:nth-child\([^)]*n\s*\+\s*1\)/.test(sel)) {
      for (const c of sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)) orphanSafe.add(c[1]);
    }
  }

  const findings = [];
  const checked = [];

  $('[class*="grid"]').each((_, el) => {
    const classList = ($(el).attr('class') || '').split(/\s+/).filter(Boolean);
    const gridClass = classList.find((c) => /grid/i.test(c) && !LAYOUT_GRID_CLASSES.has(c));
    if (!gridClass || LAYOUT_GRID_CLASSES.has(gridClass)) return;
    // count direct ELEMENT children (the items)
    const items = $(el).children().filter((_, c) => c.type === 'tag').length;
    if (items === 0) return;
    const cols = effectiveCols(classList, colMap);
    // codex review 2026-05-30: check EVERY grid element (no class#items dedupe — that could hide a
    // second grid with the same base class but a different modifier / a real orphan).

    if (cols === 'auto' || cols == null) {
      checked.push({ grid: gridClass, items, cols: cols || 'unknown', ok: true, note: 'variable/unknown columns — not orphan-checkable deterministically' });
      return;
    }
    if (cols <= 1) { checked.push({ grid: gridClass, items, cols, ok: true }); return; }

    const loneOrphan = items > cols && items % cols === 1;
    const handled = classList.some((c) => orphanSafe.has(c));
    checked.push({ grid: gridClass, items, cols, ok: !loneOrphan || handled, ...(loneOrphan && handled ? { note: 'lone item centered via CSS safety rule' } : {}) });
    if (loneOrphan && !handled) {
      findings.push({
        grid: gridClass,
        items, cols,
        severity: 'high',
        label: 'grid_lone_orphan',
        detail: `${gridClass}: ${items} items in a ${cols}-column grid → last row has 1 lone item (${Math.floor(items / cols)}×${cols} + 1). Use ${items % 2 === 0 ? '2 columns' : 'a balanced count'} so no item sits alone.`,
      });
    }
  });

  return { findings, checked };
}
