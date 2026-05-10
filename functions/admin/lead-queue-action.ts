import type { PagesFunction } from '@cloudflare/workers-types';
import { EXECUTABLE_QUEUE_ACTIONS, QUEUE_ACTION_DEFINITIONS } from '../../core/funnel/stage-config.js';

interface Env {
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_REF?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await context.request.json<Record<string, string>>()
      : Object.fromEntries((await context.request.formData()).entries());
    const payload = normalizePayload(body);
    const actionDefinition = QUEUE_ACTION_DEFINITIONS[payload.queue_action as keyof typeof QUEUE_ACTION_DEFINITIONS];
    if (!EXECUTABLE_QUEUE_ACTIONS.has(payload.queue_action)) return json({ error: 'Unsupported lead queue action.' }, 400);
    if (actionDefinition?.requiresEntityKey && !payload.entity_key) {
      return json({ error: 'entity_key is required for this action.' }, 400);
    }
    if (actionDefinition?.requiresClientSlug && !payload.client_slug) {
      return json({ error: 'client_slug is required for this action.' }, 400);
    }
    const dispatched = await dispatchWorkflow(context.env, payload);
    if (!dispatched.ok) return json({ error: dispatched.error || 'Unable to run lead queue action.' }, 502);
    if (contentType.includes('application/json')) return json({ success: true, dispatched: true });
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/admin/queue/?queue_action=queued&action=${encodeURIComponent(payload.queue_action)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Lead queue action error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return onRequestPost(context);
};

async function dispatchWorkflow(env: Env, payload: Record<string, string>) {
  const token = env.AGENT_GITHUB_TOKEN || env.GH_PAT || '';
  if (!token) return { ok: false, error: 'Missing AGENT_GITHUB_TOKEN or GH_PAT.' };
  const repo = env.AGENT_REPO || 'matthew6688/webjuice-stack-mvp';
  const ref = env.AGENT_REF || 'main';
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/run-lead-queue-action.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-queue-action',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        payload: JSON.stringify(payload),
        dedupe_key: `${payload.queue_action}-${payload.entity_key || 'batch'}-${Date.now()}`,
      },
    }),
  });
  if (response.status === 204) return { ok: true };
  return { ok: false, error: await response.text() };
}

function normalizePayload(body: Record<string, FormDataEntryValue | string>) {
  return {
    queue_action: clean(body.queue_action || body.action),
    entity_key: clean(body.entity_key || body.entityKey),
    client_slug: clean(body.client_slug),
    company: clean(body.company),
    actor: clean(body.actor) || 'profitslocal-admin',
    dry_run: clean(body.dry_run),
    operation_id: clean(body.operation_id) || `queue_op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    created_at: new Date().toISOString(),
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
