/**
 * agentic-inbox-profitslocal client — sends outbound email via the existing
 * Cloudflare worker at mail.profitslocal.com.
 *
 * Auth: Cloudflare Access service token (CF-Access-Client-Id +
 * CF-Access-Client-Secret headers). Worker validates JWT injected by CF Access
 * edge after service-token policy approves the request.
 *
 * Required env (in .env.local):
 *   AGENTIC_INBOX_URL=https://mail.profitslocal.com
 *   AGENTIC_INBOX_MAILBOX_ID=hi@profitslocal.com    (RAW email — do NOT URL-encode;
 *                                                    encodeURIComponent() runs in the client)
 *   AGENTIC_INBOX_ACCESS_CLIENT_ID=<service-token-id>.access
 *   AGENTIC_INBOX_ACCESS_CLIENT_SECRET=<secret>
 *
 * Setup (one-time, in Cloudflare dashboard):
 *   1. Zero Trust → Access → Service Auth → Service Tokens → "Create"
 *   2. Edit the agentic-inbox Access application policy → add Rule "Service Token"
 *      → include the new token name
 *   3. Copy Client ID + Client Secret to profitslocal .env.local
 *
 * When credentials are missing, sendOutbound() returns dry-run with the exact
 * HTTP request that WOULD have been made.
 */

import fs from 'fs';
import path from 'path';

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in .env.local`);
  return v;
}

function hasCredentials() {
  return Boolean(
    process.env.AGENTIC_INBOX_URL
    && process.env.AGENTIC_INBOX_MAILBOX_ID
    && process.env.AGENTIC_INBOX_ACCESS_CLIENT_ID
    && process.env.AGENTIC_INBOX_ACCESS_CLIENT_SECRET,
  );
}

/**
 * Send a new outbound email. NOT a reply — this creates a fresh thread.
 *
 * @param {object} opts
 * @param {string} opts.to            — recipient email
 * @param {string} opts.subject
 * @param {string} opts.html          — HTML body (preferred)
 * @param {string} [opts.text]        — plaintext alt
 * @param {string} [opts.from]        — sender email; default = mailbox owner
 * @param {object} [opts.headers]     — extra raw headers (e.g. X-PL-Variant)
 * @param {string} [opts.entityKey]   — for ledger / event log correlation
 * @param {string} [opts.variantId]
 * @returns {Promise<{ok, messageId?, threadId?, dry_run?, intended?}>}
 */
export async function sendOutbound(opts = {}) {
  const { to, subject, html, text, from, headers = {}, entityKey, variantId } = opts;
  if (!to) return { ok: false, reason: 'to required' };
  if (!subject) return { ok: false, reason: 'subject required' };
  if (!html && !text) return { ok: false, reason: 'html or text required' };

  const baseUrl = process.env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com';
  const mailboxId = process.env.AGENTIC_INBOX_MAILBOX_ID || '';
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/emails`;

  const customHeaders = {
    ...(entityKey ? { 'X-PL-Entity-Key': entityKey } : {}),
    ...(variantId ? { 'X-PL-Variant': variantId } : {}),
    ...headers,
  };

  const payload = {
    to: [to],
    from: from || `hi@${process.env.DOMAINS || 'profitslocal.com'}`,
    subject,
    html: html || `<pre>${escapeHtml(text)}</pre>`,
    text: text || htmlToText(html),
    customHeaders,
  };

  if (!hasCredentials()) {
    return {
      ok: true,
      dry_run: true,
      reason: 'CF Access service token credentials not set',
      intended: {
        method: 'POST',
        endpoint,
        headers: { 'CF-Access-Client-Id': '<unset>', 'CF-Access-Client-Secret': '<unset>', 'Content-Type': 'application/json' },
        payload: { ...payload, html: payload.html.slice(0, 100) + '…' },
      },
      setup_hint: 'Set AGENTIC_INBOX_ACCESS_CLIENT_ID + AGENTIC_INBOX_ACCESS_CLIENT_SECRET in .env.local',
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Access-Client-Id': envOrThrow('AGENTIC_INBOX_ACCESS_CLIENT_ID'),
      'CF-Access-Client-Secret': envOrThrow('AGENTIC_INBOX_ACCESS_CLIENT_SECRET'),
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, body: responseText, endpoint };
  }
  let parsed;
  try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }
  return {
    ok: true,
    status: response.status,
    messageId: parsed.id || parsed.messageId || null,
    threadId: parsed.thread_id || parsed.threadId || null,
    response: parsed,
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function htmlToText(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}
