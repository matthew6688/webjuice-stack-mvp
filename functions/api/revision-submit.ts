import type { PagesFunction } from '@cloudflare/workers-types';
import { uploadAttachmentsToCloudinary, summarizeCloudinaryAssets } from '../../core/cloudinary/attachments.js';
import { buildRevisionOpsMessage, sendOpsDiscordMessage } from '../../core/funnel/paid-intake-ops.js';
import { detailsFromObject, keyValueText, renderProfitsLocalEmail } from '../../core/funnel/email-template.js';
import { buildRevisionWorkflowDispatch } from '../../core/ops/workflow-dispatch.js';

interface Env {
  AGENT_GITHUB_TOKEN?: string;
  GH_PAT?: string;
  AGENT_REPO?: string;
  AGENT_REF?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
  FROM_EMAIL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_PRESET?: string;
  CLOUDINARY_UPLOAD_FOLDER?: string;
  CLOUDINARY_UPLOAD_MAX_BYTES?: string;
  SALES_DISCORD_WEBHOOK_URL?: string;
  PAID_INTAKE_DISCORD_WEBHOOK_URL?: string;
  SITE_URL?: string;
}

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_FILE_COUNT = 8;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { body, attachments } = await readMultipart(context.request);
    if (!body.order_id || !body.email || !body.requested_changes) {
      return json({ error: 'Order ID, email, and requested changes are required.' }, 400);
    }
    if (body.confirm_revision_scope !== 'on') {
      return json({ error: 'Please confirm the revision scope before submitting.' }, 400);
    }
    if (attachments.totalBytes > MAX_ATTACHMENT_BYTES) return json({ error: 'Attachments are too large.' }, 413);

    const cloudinary = await uploadAttachmentsToCloudinary(context.env, attachments.files, {
      clientSlug: body.client_slug || body.business_name || 'paid-revision',
      orderId: body.order_id,
      submissionType: 'revision',
    });
    if (!cloudinary.ok && cloudinary.configured) {
      return json({ error: cloudinary.error || 'Unable to upload attachments.' }, 502);
    }
    const fileSummary = cloudinary.ok && cloudinary.assets?.length
      ? summarizeCloudinaryAssets(cloudinary.assets)
      : attachments.files.map((file) => `${file.filename} (${file.content_type}, ${formatBytes(file.size)})`).join('\n');
    const payload = {
      ...body,
      attachment_summary: fileSummary,
      files: fileSummary ? fileSummary.split(/\n+/).filter(Boolean) : [],
      asset_refs: cloudinary.ok && cloudinary.assets?.length ? JSON.stringify(cloudinary.assets) : '',
      submitted_at: new Date().toISOString(),
    };

    if (attachments.files.length) {
      const sent = await sendRevisionEmail(context.env, payload, cloudinary.ok && cloudinary.assets?.length ? [] : attachments.files);
      if (!sent.ok) return json({ error: sent.error || 'Unable to send revision assets.' }, 502);
    }

    const dispatched = await dispatchRevisionWorkflow(context.env, payload);
    if (!dispatched.ok) return json({ error: dispatched.error || 'Unable to record revision.' }, 502);

    const discordPayload = buildRevisionOpsMessage({
      payload,
      summary: {
        clientSlug: payload.client_slug,
        orderId: payload.order_id,
        status: 'revision_submitted',
        files: payload.files,
        assets: cloudinary.ok ? cloudinary.assets : [],
      },
      baseUrl: context.env.SITE_URL || new URL(context.request.url).origin,
    });
    const discord = await sendOpsDiscordMessage(context.env, discordPayload);
    return json({ success: true, dispatched: true, cloudinary: cloudinary.ok && Boolean(cloudinary.assets?.length), discord });
  } catch (error) {
    console.error('Revision submit error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return onRequestPost(context);
};

async function dispatchRevisionWorkflow(env: Env, payload: Record<string, string | string[]>) {
  const token = env.AGENT_GITHUB_TOKEN || env.GH_PAT || '';
  if (!token) return { ok: false, error: 'Missing AGENT_GITHUB_TOKEN or GH_PAT.' };
  const repo = env.AGENT_REPO || 'matthew6688/webjuice-stack-mvp';
  const ref = env.AGENT_REF || 'main';
  const request = buildRevisionWorkflowDispatch(payload);
  if (!request.ok) return { ok: false, error: `Missing required revision fields: ${request.missing.join(', ')}` };
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/route-funnel-event.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-paid-revision',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        payload: JSON.stringify(payload),
        dedupe_key: `${payload.order_id || 'order'}-${Date.now()}`,
      },
    }),
  });
  if (response.status === 204) return { ok: true };
  return { ok: false, error: await response.text() };
}

async function sendRevisionEmail(env: Env, payload: Record<string, string | string[]>, files: Array<{ filename: string; content: string; content_type: string; size: number }>) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'Resend is not configured.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'profitslocal <hello@fengtalk.ai>',
      to: env.NOTIFICATION_EMAIL || 'hello@fengtalk.ai',
      subject: `Paid revision assets: ${payload.business_name || payload.client_slug || payload.order_id}`,
      text: Object.entries(payload).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n'),
      reply_to: String(payload.email || ''),
      attachments: files.map((file) => ({
        filename: file.filename,
        content: file.content,
        content_type: file.content_type,
      })),
    }),
  });
  if (!response.ok) return { ok: false, error: await response.text() };
  return { ok: true };
}

async function readMultipart(request: Request) {
  const formData = await request.formData();
  const body: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') body[key] = value.trim();
  }
  const rawFiles = formData.getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_FILE_COUNT);
  let totalBytes = 0;
  const files = [];
  for (const file of rawFiles) {
    totalBytes += file.size;
    if (totalBytes > MAX_ATTACHMENT_BYTES) break;
    files.push({
      filename: safeFileName(file.name || 'attachment'),
      content: arrayBufferToBase64(await file.arrayBuffer()),
      content_type: file.type || 'application/octet-stream',
      size: file.size,
    });
  }
  return { body, attachments: { files, totalBytes } };
}

function safeFileName(value: string) {
  return value.replace(/[^\w.\- ()]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'attachment';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
