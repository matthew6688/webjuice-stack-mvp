import type { PagesFunction } from '@cloudflare/workers-types';

/**
 * Client-website contact form handler · MINIMAL by design.
 *
 * Lives on customer's `<slug>-dev.pages.dev` deploys (NOT ProfitsLocal main site).
 * Codex R42 consensus 2026-05-29 · 5 fields only · no Cloudinary · no UTM · no tracking.
 *
 * Form contract (5 fields):
 *   name (required) · email (required) · phone (required) · service (optional select) · message (optional)
 *
 * Env required (set per-project by `pl:cf-env-bootstrap --recipient <email>`):
 *   RESEND_API_KEY      · ProfitsLocal Resend key (shared default)
 *   RECIPIENT_EMAIL     · where leads go for THIS client
 *   FROM_EMAIL          · default 'Profits Local <hello@fengtalk.ai>' (use leads@profitslocal.com once verified)
 *
 * Optional env (paid-tier upgrade · NOT implemented MVP · documented for future Hermes-driven config):
 *   SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS · SMTP_FROM
 *   When all set · function would switch to SMTP via relay. Not built MVP per codex R42 Q-ZZ-2 (d).
 *
 * Returns:
 *   200 { ok: true }              · sent successfully
 *   400 { error: '...' }          · missing required fields or invalid email
 *   500 { error: 'config' }       · server misconfigured (RECIPIENT_EMAIL or RESEND_API_KEY missing)
 *   502 { error: 'email failed' } · Resend API rejected
 */

interface Env {
  RESEND_API_KEY: string;
  RECIPIENT_EMAIL: string;
  FROM_EMAIL?: string;
  CLIENT_NAME?: string; // optional · used in subject line if present
  // Future paid-tier · NOT used MVP:
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

interface ClientContactForm {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  suburb?: string;  // R42-followup · editorial-newsletter has visible suburb field
  message?: string;
}

const MAX_FIELD_LEN = 2000;

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LEN) : '';
}

function isEmailShape(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readForm(request: Request): Promise<ClientContactForm | { _parseError: true }> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return (await request.json<ClientContactForm>()) ?? {};
    } catch {
      // R42-followup Q-AAA-5 · malformed JSON → 400 not 500
      return { _parseError: true } as { _parseError: true };
    }
  }
  // form-urlencoded or multipart/form-data
  try {
    const fd = await request.formData();
    return {
      name: trim(fd.get('name')),
      email: trim(fd.get('email')),
      phone: trim(fd.get('phone')),
      service: trim(fd.get('service')),
      suburb: trim(fd.get('suburb')),
      message: trim(fd.get('message')),
    };
  } catch {
    return { _parseError: true } as { _parseError: true };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function plainText(body: ClientContactForm): string {
  return [
    `Name: ${body.name}`,
    `Email: ${body.email}`,
    `Phone: ${body.phone || 'N/A'}`,
    `Service: ${body.service || 'N/A'}`,
    `Suburb: ${body.suburb || 'N/A'}`,
    '',
    'Message:',
    body.message || '(no message)',
  ].join('\n');
}

function htmlBody(body: ClientContactForm, clientName?: string): string {
  const sub = clientName ? `New enquiry · ${clientName}` : 'New enquiry from your website';
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0F1115;padding:24px;max-width:600px;margin:0 auto;">
<h2 style="margin:0 0 16px;font-size:20px;">${escapeHtml(sub)}</h2>
<table style="border-collapse:collapse;width:100%;font-size:15px;">
  <tr><td style="padding:8px 12px;background:#F4F4F5;width:120px;font-weight:600;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;">${escapeHtml(body.name || '')}</td></tr>
  <tr><td style="padding:8px 12px;background:#F4F4F5;font-weight:600;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;"><a href="mailto:${escapeHtml(body.email || '')}">${escapeHtml(body.email || '')}</a></td></tr>
  <tr><td style="padding:8px 12px;background:#F4F4F5;font-weight:600;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;">${escapeHtml(body.phone || 'N/A')}</td></tr>
  <tr><td style="padding:8px 12px;background:#F4F4F5;font-weight:600;">Service</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;">${escapeHtml(body.service || 'N/A')}</td></tr>
  <tr><td style="padding:8px 12px;background:#F4F4F5;font-weight:600;">Suburb</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;">${escapeHtml(body.suburb || 'N/A')}</td></tr>
</table>
${body.message ? `<h3 style="margin:24px 0 8px;font-size:16px;">Message</h3><div style="background:#FAFAF7;padding:14px 18px;border-radius:6px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(body.message)}</div>` : ''}
<p style="margin-top:24px;font-size:13px;color:#5A5C61;">Reply to this email to respond directly to the customer.</p>
</body></html>`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Config check (don't leak secrets · just signal)
    if (!context.env.RESEND_API_KEY || !context.env.RECIPIENT_EMAIL) {
      console.error('client-contact: missing RESEND_API_KEY or RECIPIENT_EMAIL env');
      return json({ error: 'Form temporarily unavailable. Please call us or try again later.' }, 500);
    }

    const parsed = await readForm(context.request);
    if ('_parseError' in parsed) {
      return json({ error: 'Could not read submission. Please try again.' }, 400);
    }
    const body: ClientContactForm = parsed;
    body.name = trim(body.name);
    body.email = trim(body.email);
    body.phone = trim(body.phone);
    body.service = trim(body.service);
    body.suburb = trim(body.suburb);
    body.message = trim(body.message);

    // Validation
    if (!body.name) return json({ error: 'Name is required.' }, 400);
    if (!body.email || !isEmailShape(body.email)) return json({ error: 'A valid email is required.' }, 400);
    if (!body.phone) return json({ error: 'Phone number is required.' }, 400);

    // Send via Resend (SMTP path deferred · codex R42 Q-ZZ-2 d)
    const fromEmail = context.env.FROM_EMAIL || 'Profits Local <hello@fengtalk.ai>';
    const subject = context.env.CLIENT_NAME
      ? `New enquiry · ${context.env.CLIENT_NAME} · ${body.name}`
      : `New enquiry · ${body.name}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: context.env.RECIPIENT_EMAIL,
        subject,
        text: plainText(body),
        html: htmlBody(body, context.env.CLIENT_NAME),
        reply_to: body.email,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error(`Resend error ${resendRes.status}:`, errText.slice(0, 300));
      return json({ error: 'Could not send. Please call us or try again.' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('client-contact error:', err);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
    });
  }
  return onRequestPost(context);
};
