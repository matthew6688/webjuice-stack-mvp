import type { PagesFunction } from '@cloudflare/workers-types';
import { adminActionDefinition } from '../../core/funnel/paid-intake-actions.js';
import { sendOpsDiscordMessage } from '../../core/funnel/paid-intake-ops.js';

interface Env {
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_REF?: string;
  SALES_DISCORD_WEBHOOK_URL?: string;
  PAID_INTAKE_DISCORD_WEBHOOK_URL?: string;
  SITE_URL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await context.request.json<Record<string, string>>()
      : Object.fromEntries((await context.request.formData()).entries());
    const payload = normalizePayload(body);
    const definition = adminActionDefinition(payload.action);
    if (!definition) return json({ error: 'Unknown admin action.' }, 400);
    if (definition.needsNote && !payload.note) return json({ error: 'This action requires a note.' }, 400);
    if (!payload.client_slug || !payload.order_id) return json({ error: 'Client slug and order ID are required.' }, 400);

    const dispatched = await dispatchRecordWorkflow(context.env, payload);
    if (!dispatched.ok) return json({ error: dispatched.error || 'Unable to record admin action.' }, 502);

    const discord = await sendOpsDiscordMessage(context.env, buildAdminActionDiscordMessage({
      payload,
      label: definition.label,
      baseUrl: context.env.SITE_URL || new URL(context.request.url).origin,
    }));
    if (contentType.includes('application/json')) {
      return json({ success: true, dispatched: true, discord });
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/admin/intakes/${encodeURIComponent(payload.client_slug)}/${encodeURIComponent(payload.order_id)}?action=queued`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Admin action error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return onRequestPost(context);
};

async function dispatchRecordWorkflow(env: Env, payload: Record<string, string>) {
  const token = env.AGENT_GITHUB_TOKEN || env.GH_PAT || '';
  if (!token) return { ok: false, error: 'Missing AGENT_GITHUB_TOKEN or GH_PAT.' };
  const repo = env.AGENT_REPO || 'matthew6688/webjuice-stack-mvp';
  const ref = env.AGENT_REF || 'main';
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/record-paid-intake-action.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-admin-action',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        payload: JSON.stringify(payload),
        dedupe_key: `${payload.order_id}-${payload.action}-${Date.now()}`,
      },
    }),
  });
  if (response.status === 204) return { ok: true };
  return { ok: false, error: await response.text() };
}

function normalizePayload(body: Record<string, FormDataEntryValue | string>) {
  return {
    client_slug: clean(body.client_slug),
    order_id: clean(body.order_id),
    action: clean(body.action),
    note: clean(body.note),
    actor: clean(body.actor) || 'profitslocal-admin',
    submitted_at: new Date().toISOString(),
  };
}

function buildAdminActionDiscordMessage({ payload, label, baseUrl }: { payload: Record<string, string>; label: string; baseUrl: string }) {
  return {
    username: 'ProfitsLocal Admin',
    embeds: [{
      title: `Admin action: ${label}`,
      color: 0x8bd3f7,
      fields: [
        { name: 'Client', value: payload.client_slug, inline: true },
        { name: 'Order ID', value: payload.order_id, inline: false },
        { name: 'Actor', value: payload.actor, inline: true },
        ...(payload.note ? [{ name: 'Note', value: payload.note.slice(0, 1000), inline: false }] : []),
        { name: 'Admin', value: `${baseUrl}/admin/intakes/${encodeURIComponent(payload.client_slug)}/${encodeURIComponent(payload.order_id)}`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    }],
  };
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
