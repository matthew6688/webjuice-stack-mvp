import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  STRIPE_WEBHOOK_SECRET: string;
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_WORKFLOW_ID?: string;
  AGENT_REF?: string;
}

const DISPATCH_DEFAULTS = {
  repo: 'matthew6688/webjuice-stack-mvp',
  workflowId: 'route-funnel-event.yml',
  ref: 'main',
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.text();
    const signature = context.request.headers.get('stripe-signature') || '';

    if (!context.env.STRIPE_WEBHOOK_SECRET) {
      return json({ error: 'Stripe webhook secret is not configured.' }, 500);
    }

    const verified = await verifyStripeSignature(rawBody, signature, context.env.STRIPE_WEBHOOK_SECRET);
    if (!verified.ok) {
      return json({ error: verified.reason }, 400);
    }

    const event = JSON.parse(rawBody);
    if (event.type !== 'checkout.session.completed') {
      return json({ received: true, ignored: true, type: event.type });
    }

    const session = event?.data?.object || {};
    const metadata = session.metadata || {};
    const workflowKind = metadata.order_kind === 'paid_intake'
      ? 'paid_intake'
      : metadata.order_kind === 'sale'
        ? 'sale'
        : metadata.auto_run_agent === 'false' && !metadata.preview_url
          ? 'paid_intake'
          : 'auto';
    const dispatchResult = await dispatchRouteWorkflow({
      env: context.env,
      payload: rawBody,
      dedupeKey: event.id || session.id || '',
      autoRunAgent: metadata.auto_run_agent !== 'false',
      kind: workflowKind,
    });

    if (!dispatchResult.ok) {
      return json({
        error: 'Stripe event verified, but workflow dispatch failed.',
        details: dispatchResult.message,
      }, 502);
    }

    return json({
      received: true,
      dispatched: true,
      workflow: dispatchResult.workflow,
      dedupeKey: dispatchResult.dedupeKey,
    });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }
  return onRequestPost(context);
};

async function dispatchRouteWorkflow(options: {
  env: Env;
  payload: string;
  dedupeKey: string;
  autoRunAgent: boolean;
  kind: string;
}) {
  const token = options.env.AGENT_GITHUB_TOKEN || options.env.GH_PAT || '';
  if (!token) {
    return { ok: false, message: 'Missing AGENT_GITHUB_TOKEN or GH_PAT.' };
  }

  const repo = options.env.AGENT_REPO || DISPATCH_DEFAULTS.repo;
  const workflowId = options.env.AGENT_WORKFLOW_ID || DISPATCH_DEFAULTS.workflowId;
  const ref = options.env.AGENT_REF || DISPATCH_DEFAULTS.ref;
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-stripe-webhook',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        provider: 'stripe',
        payload: options.payload,
        send_discord: 'true',
        send_email: 'true',
        dry_run: 'false',
        auto_run_agent: options.autoRunAgent ? 'true' : 'false',
        dedupe_key: options.dedupeKey,
        kind: options.kind,
      },
    }),
  });

  if (response.status === 204) {
    return {
      ok: true,
      workflow: `${repo}/${workflowId}@${ref}`,
      dedupeKey: options.dedupeKey,
    };
  }

  return {
    ok: false,
    message: await response.text(),
  };
}

async function verifyStripeSignature(body: string, header: string, secret: string) {
  const parts = parseStripeSignature(header);
  if (!parts.timestamp || parts.signatures.length === 0) {
    return { ok: false, reason: 'Missing Stripe signature.' };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.timestamp));
  if (!Number.isFinite(age) || age > 300) {
    return { ok: false, reason: 'Stripe signature timestamp is outside tolerance.' };
  }

  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${body}`);
  const matched = parts.signatures.some((signature) => timingSafeEqual(signature, expected));
  return matched
    ? { ok: true }
    : { ok: false, reason: 'Invalid Stripe signature.' };
}

function parseStripeSignature(header: string) {
  const result = { timestamp: '', signatures: [] as string[] };
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') result.timestamp = value || '';
    if (key === 'v1' && value) result.signatures.push(value);
  }
  return result;
}

async function hmacSha256Hex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
