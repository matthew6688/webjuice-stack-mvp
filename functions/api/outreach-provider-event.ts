import type { PagesFunction } from '@cloudflare/workers-types';
import { dispatchWorkflow } from './_agent-dispatch.ts';
import { buildOutreachProviderWorkflowDispatch } from '../../core/ops/workflow-dispatch.js';

interface Env {
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_REF?: string;
  OUTREACH_PROVIDER_WEBHOOK_SECRET?: string;
  AGENTIC_EMAIL_WEBHOOK_SECRET?: string;
  ADMIN_ACCESS_TOKEN?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = context.request.headers.get('authorization') || '';
    const headerSecret = context.request.headers.get('x-webhook-secret') || '';
    const expectedSecret =
      context.env.OUTREACH_PROVIDER_WEBHOOK_SECRET
      || context.env.AGENTIC_EMAIL_WEBHOOK_SECRET
      || context.env.ADMIN_ACCESS_TOKEN
      || '';
    if (expectedSecret) {
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (bearer !== expectedSecret && headerSecret !== expectedSecret) {
        return json({ error: 'Unauthorized.' }, 401);
      }
    }

    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body.' }, 400);
    const request = buildOutreachProviderWorkflowDispatch(body as Record<string, unknown>);
    if (!request.ok) return json({ error: `Missing required fields: ${request.missing.join(', ')}` }, 400);

    const dispatched = await dispatchWorkflow({
      AGENT_GITHUB_TOKEN: context.env.AGENT_GITHUB_TOKEN || context.env.GH_PAT,
      AGENT_REPO: context.env.AGENT_REPO,
      AGENT_REF: context.env.AGENT_REF,
    }, request.workflow, request.inputs, body);

    return json({ success: true, dispatched, workflow: request.workflow });
  } catch (error) {
    console.error('Outreach provider event error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return onRequestPost(context);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
