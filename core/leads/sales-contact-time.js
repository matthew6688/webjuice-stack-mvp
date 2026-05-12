/**
 * core/leads/sales-contact-time.js
 *
 * Parse Places API `opening_hours.weekday_text[]` into a "best contact window"
 * suggestion for sales outreach.
 *
 * SOP-1 G-14 · 2026-05-12.
 *
 * Input shape (from entity.latest.places_enrichment.opening_hours_verified):
 *   { weekday_text: [
 *       "Monday: 9:00 AM - 5:00 PM",
 *       "Tuesday: Closed",
 *       ...
 *   ] }
 *
 * Output: { suggested_window, weekday_summary, days_open, days_closed, source }
 *
 * Heuristic (US/AU SMB sales):
 *   - Best time = mid-morning weekdays (Tue/Wed/Thu, 10:00-11:30 local)
 *     unless business is closed those days → fall back to first open weekday
 *   - Avoid: Mon morning (catch-up), Fri afternoon (winding down),
 *     lunch hour (12:00-13:00), early morning before open
 *   - Output is a HUMAN-READABLE recommendation, not a structured cron-time
 */

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PREFERRED_DAYS = ['Tuesday', 'Wednesday', 'Thursday'];

/**
 * Parse one weekday_text row.
 * Returns: { day, closed, open?: 'HH:MM', close?: 'HH:MM', raw }
 */
function parseWeekdayRow(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const colonIdx = raw.indexOf(':');
  if (colonIdx < 0) return null;
  const day = raw.slice(0, colonIdx).trim();
  const hoursText = raw.slice(colonIdx + 1).trim();

  if (/closed/i.test(hoursText)) {
    return { day, closed: true, raw };
  }
  if (/open\s*24\s*hours/i.test(hoursText)) {
    return { day, closed: false, open: '00:00', close: '23:59', raw };
  }

  // Common format: "9:00 AM - 5:00 PM" or "9:00 AM – 5:00 PM" (en-dash)
  const m = hoursText.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–\-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return { day, closed: false, raw, unparsed: true };

  const to24 = (h, mn, ampm) => {
    let hour = parseInt(h, 10);
    const minute = mn ? parseInt(mn, 10) : 0;
    if (/PM/i.test(ampm) && hour !== 12) hour += 12;
    if (/AM/i.test(ampm) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  return {
    day,
    closed: false,
    open: to24(m[1], m[2], m[3]),
    close: to24(m[4], m[5], m[6]),
    raw,
  };
}

/**
 * Suggest a sales contact window from parsed weekday rows.
 */
function suggestWindow(parsedRows) {
  const openRows = parsedRows.filter((r) => r && !r.closed && !r.unparsed);
  if (openRows.length === 0) {
    return { suggested_window: 'Hours not parseable — call before noon weekday', confidence: 'low' };
  }

  // Prefer Tue/Wed/Thu that are open
  const preferredOpen = openRows.filter((r) => PREFERRED_DAYS.includes(r.day));
  const targetDays = preferredOpen.length > 0 ? preferredOpen : openRows;

  // Pick representative day (first match)
  const rep = targetDays[0];
  const openHour = parseInt(rep.open.split(':')[0], 10);
  const closeHour = parseInt(rep.close.split(':')[0], 10);

  // Suggest 1 hour after open OR 10am, whichever is later; before lunch
  const startHour = Math.max(openHour + 1, 10);
  const endHour = Math.min(startHour + 2, 12); // before noon

  // If startHour ≥ 12 (afternoon-only open), fall back to 14:00 - 15:30
  let window;
  if (startHour >= 12) {
    window = `14:00 – 15:30`;
  } else if (endHour <= startHour) {
    window = `${String(startHour).padStart(2, '0')}:00 – ${String(closeHour).padStart(2, '0')}:00`;
  } else {
    window = `${String(startHour).padStart(2, '0')}:00 – ${String(endHour).padStart(2, '0')}:00`;
  }

  const dayLabel = preferredOpen.length > 0
    ? `${preferredOpen.map((r) => r.day.slice(0, 3)).join(' / ')}`
    : openRows.map((r) => r.day.slice(0, 3)).join(' / ');

  return {
    suggested_window: `${dayLabel} ${window} (local)`,
    confidence: preferredOpen.length >= 2 ? 'high' : 'medium',
    rationale: preferredOpen.length > 0
      ? '工作日中段开门 + 避免周一开机 / 周五下班 / 午餐时间'
      : '所选日营业 + 避免午餐时间',
  };
}

/**
 * Public API: compute sales-contact-time signal for an entity.
 * Returns null if no usable opening_hours data.
 */
export function computeSalesContactTime(entity) {
  const weekdayText = entity?.latest?.places_enrichment?.opening_hours_verified?.weekday_text;
  if (!Array.isArray(weekdayText) || weekdayText.length === 0) {
    return null;
  }
  const parsedRows = weekdayText.map(parseWeekdayRow).filter(Boolean);
  const open = parsedRows.filter((r) => !r.closed);
  const closed = parsedRows.filter((r) => r.closed);
  const suggestion = suggestWindow(parsedRows);

  return {
    suggested_window: suggestion.suggested_window,
    confidence: suggestion.confidence,
    rationale: suggestion.rationale,
    weekday_summary: parsedRows.map((r) => r.closed
      ? `${r.day.slice(0, 3)}: closed`
      : r.open && r.close
        ? `${r.day.slice(0, 3)}: ${r.open}-${r.close}`
        : `${r.day.slice(0, 3)}: ${r.raw.split(':').slice(1).join(':').trim()}`).join(' · '),
    days_open: open.length,
    days_closed: closed.length,
    source: 'places_api.opening_hours.weekday_text',
    computed_at: new Date().toISOString(),
  };
}
