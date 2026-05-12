/**
 * core/ops/alert-pusher.js — push system alerts to Discord webhook.
 *
 * Reads SYSTEM_ALERTS_DISCORD_WEBHOOK_URL from env. If not set, becomes a
 * no-op (returns { ok: false, reason: 'no_webhook' }) so callers don't have
 * to guard. Logs every push attempt to data/ops/alerts-log.jsonl for audit.
 *
 * SOP-X-Health · 2026-05-12.
 */

import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.resolve(process.cwd(), 'data/ops/alerts-log.jsonl');

const SEVERITY_COLOR = {
  info: 0x8bd3f7,    // sky
  warn: 0xffd45a,    // citrus
  error: 0xff5a3d,   // coral
  critical: 0xc92a2a,
};

const SEVERITY_ICON = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '🔴',
  critical: '🚨',
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function appendLog(record) {
  try {
    ensureDir(LOG_PATH);
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`);
  } catch {
    // never throw from alert path; the alert itself is best-effort
  }
}

/**
 * Push a system alert to Discord.
 *
 * @param {Object} opts
 * @param {string} opts.title - e.g. "gosom Docker unreachable"
 * @param {string} opts.detail - markdown body, max ~1800 chars
 * @param {('info'|'warn'|'error'|'critical')} [opts.severity='warn']
 * @param {string} [opts.source] - tag like 'health-monitor', 'pl:scrape-docker'
 * @param {Object} [opts.fields] - extra `{name, value}[]` pairs in embed
 * @param {string} [opts.url] - admin URL relevant to alert
 * @returns {Promise<{ok:boolean, status?:number, reason?:string}>}
 */
export async function pushAlert({
  title,
  detail = '',
  severity = 'warn',
  source = 'system',
  fields = [],
  url = '',
  webhookUrl = process.env.SYSTEM_ALERTS_DISCORD_WEBHOOK_URL,
} = {}) {
  const at = new Date().toISOString();
  const record = { at, severity, source, title, detail, url, fields };

  if (!webhookUrl) {
    appendLog({ ...record, push_status: 'no_webhook' });
    return { ok: false, reason: 'no_webhook' };
  }

  const icon = SEVERITY_ICON[severity] || '•';
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.warn;

  const embed = {
    title: `${icon} ${title}`.slice(0, 250),
    description: detail.slice(0, 1800),
    color,
    timestamp: at,
    fields: fields.slice(0, 25).map((f) => ({
      name: String(f.name || '').slice(0, 250),
      value: String(f.value || '').slice(0, 1000),
      inline: f.inline !== false,
    })),
    footer: { text: `source: ${source}` },
  };

  if (url) embed.url = url;

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    appendLog({ ...record, push_status: r.status });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    appendLog({ ...record, push_status: 'fetch_error', error: err.message });
    return { ok: false, reason: 'fetch_error', error: err.message };
  }
}
