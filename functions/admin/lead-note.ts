import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_REF?: string;
  SITE_URL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await context.request.json<Record<string, string>>()
      : Object.fromEntries((await context.request.formData()).entries());
    const payload = normalizePayload(body);
    if (!payload.client_slug || !payload.note) return json({ error: 'client_slug and note are required.' }, 400);
    const dispatched = await dispatchWorkflow(context.env, payload);
    if (!dispatched.ok) return json({ error: dispatched.error || 'Unable to record lead note.' }, 502);
    if (contentType.includes('application/json')) {
      return json({ success: true, dispatched: true });
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/admin/leads/?note=queued&client=${encodeURIComponent(payload.client_slug)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Lead note error:', error);
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
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/record-lead-note.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-lead-note',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        payload: JSON.stringify(payload),
        dedupe_key: `${payload.client_slug}-lead-note-${Date.now()}`,
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
    company: clean(body.company),
    actor: clean(body.actor) || 'profitslocal-admin',
    action: clean(body.action),
    note: clean(body.note),
    next_follow_up_due: clean(body.next_follow_up_due),
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
