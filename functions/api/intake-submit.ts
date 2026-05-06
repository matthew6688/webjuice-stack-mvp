import type { PagesFunction } from '@cloudflare/workers-types';
import { uploadAttachmentsToCloudinary, summarizeCloudinaryAssets } from '../../core/cloudinary/attachments.js';

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
}

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_FILE_COUNT = 8;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { body, attachments } = await readMultipart(context.request);
    if (!body.order_id || !body.email) return json({ error: 'Order ID and email are required.' }, 400);
    if (attachments.totalBytes > MAX_ATTACHMENT_BYTES) return json({ error: 'Attachments are too large.' }, 413);
    const cloudinary = await uploadAttachmentsToCloudinary(context.env, attachments.files, {
      clientSlug: body.client_slug || body.business_name || 'paid-intake',
      orderId: body.order_id,
      submissionType: 'intake',
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
      const sent = await sendAttachmentEmail(context.env, payload, cloudinary.ok && cloudinary.assets?.length ? [] : attachments.files);
      if (!sent.ok) return json({ error: sent.error || 'Unable to send attachments.' }, 502);
    }

    const dispatched = await dispatchRecordWorkflow(context.env, payload);
    if (!dispatched.ok) return json({ error: dispatched.error || 'Unable to record intake.' }, 502);
    return json({ success: true, dispatched: true });
  } catch (error) {
    console.error('Intake submit error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  return onRequestPost(context);
};

async function dispatchRecordWorkflow(env: Env, payload: Record<string, string | string[]>) {
  const token = env.AGENT_GITHUB_TOKEN || env.GH_PAT || '';
  if (!token) return { ok: false, error: 'Missing AGENT_GITHUB_TOKEN or GH_PAT.' };
  const repo = env.AGENT_REPO || 'matthew6688/webjuice-stack-mvp';
  const ref = env.AGENT_REF || 'main';
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/record-paid-intake.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'profitslocal-paid-intake',
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

async function sendAttachmentEmail(env: Env, payload: Record<string, string | string[]>, files: Array<{ filename: string; content: string; content_type: string; size: number }>) {
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
      subject: `Paid intake assets: ${payload.business_name || payload.client_slug || payload.order_id}`,
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
