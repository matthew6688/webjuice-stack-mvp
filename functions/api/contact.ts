import type { PagesFunction } from '@cloudflare/workers-types';
import { uploadAttachmentsToCloudinary, summarizeCloudinaryAssets } from '../../core/cloudinary/attachments.js';

interface Env {
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL?: string;
  FROM_EMAIL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_PRESET?: string;
  CLOUDINARY_UPLOAD_FOLDER?: string;
  CLOUDINARY_UPLOAD_MAX_BYTES?: string;
}

interface ContactForm {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  website?: string;
  googleBusiness?: string;
  businessType?: string;
  domainPreference?: string;
  message: string;
  client_slug?: string;
  repo?: string;
  template?: string;
  preview_url?: string;
  campaign_id?: string;
  brief_id?: string;
  first_landing_url?: string;
  last_landing_url?: string;
  referrer?: string;
  last_referrer?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
  twclid?: string;
  li_fat_id?: string;
  gbraid?: string;
  wbraid?: string;
  source?: string;
  ref?: string;
}

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_FILE_COUNT = 8;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    const { body, attachments } = contentType.includes('multipart/form-data')
      ? await readMultipartContact(context.request)
      : { body: await context.request.json<ContactForm>(), attachments: { files: [], totalBytes: 0 } };
    const {
      name,
      email,
      company,
      phone,
      website,
      googleBusiness,
      businessType,
      domainPreference,
      message,
    } = body;

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (attachments.totalBytes > MAX_ATTACHMENT_BYTES) {
      return new Response(JSON.stringify({ error: 'Attachments are too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cloudinary = await uploadAttachmentsToCloudinary(context.env, attachments.files, {
      clientSlug: slugify(company || name || 'brief'),
      orderId: `brief-${Date.now()}`,
      submissionType: 'brief',
    });
    if (!cloudinary.ok && cloudinary.configured) {
      return json({ error: cloudinary.error || 'Unable to upload attachments.' }, 502);
    }
    const notificationEmail = context.env.NOTIFICATION_EMAIL || 'hello@fengtalk.ai';
    const fromEmail = context.env.FROM_EMAIL || 'profitslocal <hello@fengtalk.ai>';
    const fileSummary = cloudinary.ok && cloudinary.assets?.length
      ? summarizeCloudinaryAssets(cloudinary.assets).split('\n').map((line) => `- ${line}`).join('\n')
      : attachments.files.length
        ? attachments.files.map((file) => `- ${file.filename} (${file.content_type || 'unknown'}, ${formatBytes(file.size)})`).join('\n')
        : 'None';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: notificationEmail,
        subject: `New profitslocal brief: ${company || name}`,
        text: `Name: ${name}
Email: ${email}
Company: ${company || 'N/A'}
Phone: ${phone || 'N/A'}
Current website: ${website || 'N/A'}
Google Business: ${googleBusiness || 'N/A'}
Business type: ${businessType || 'N/A'}
Domain preference: ${domainPreference || 'N/A'}
Preview context:
${formatContext(body)}

Files:
${fileSummary}

Message:
${message}`,
        reply_to: email,
        attachments: cloudinary.ok && cloudinary.assets?.length ? [] : attachments.files.map((file) => ({
          filename: file.filename,
          content: file.content,
          content_type: file.content_type,
        })),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return json({ error: 'Failed to send notification' }, 500);
    }

    return json({ success: true, cloudinary: cloudinary.ok && Boolean(cloudinary.assets?.length) });
  } catch (err) {
    console.error('Contact form error:', err);
    return json({ error: 'Internal error' }, 500);
  }
};

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return onRequestPost(context);
};

async function readMultipartContact(request: Request) {
  const formData = await request.formData();
  const body: ContactForm = {
    name: stringField(formData, 'name'),
    email: stringField(formData, 'email'),
    company: stringField(formData, 'company'),
    phone: stringField(formData, 'phone'),
    website: stringField(formData, 'website'),
    googleBusiness: stringField(formData, 'googleBusiness'),
    businessType: stringField(formData, 'businessType'),
    domainPreference: stringField(formData, 'domainPreference'),
    message: stringField(formData, 'message'),
    client_slug: stringField(formData, 'client_slug'),
    repo: stringField(formData, 'repo'),
    template: stringField(formData, 'template'),
    preview_url: stringField(formData, 'preview_url'),
    campaign_id: stringField(formData, 'campaign_id'),
    brief_id: stringField(formData, 'brief_id'),
    first_landing_url: stringField(formData, 'first_landing_url'),
    last_landing_url: stringField(formData, 'last_landing_url'),
    referrer: stringField(formData, 'referrer'),
    last_referrer: stringField(formData, 'last_referrer'),
    first_seen_at: stringField(formData, 'first_seen_at'),
    last_seen_at: stringField(formData, 'last_seen_at'),
    utm_source: stringField(formData, 'utm_source'),
    utm_medium: stringField(formData, 'utm_medium'),
    utm_campaign: stringField(formData, 'utm_campaign'),
    utm_term: stringField(formData, 'utm_term'),
    utm_content: stringField(formData, 'utm_content'),
    gclid: stringField(formData, 'gclid'),
    fbclid: stringField(formData, 'fbclid'),
    msclkid: stringField(formData, 'msclkid'),
    ttclid: stringField(formData, 'ttclid'),
    twclid: stringField(formData, 'twclid'),
    li_fat_id: stringField(formData, 'li_fat_id'),
    gbraid: stringField(formData, 'gbraid'),
    wbraid: stringField(formData, 'wbraid'),
    source: stringField(formData, 'source'),
    ref: stringField(formData, 'ref'),
  };

  const rawFiles = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_FILE_COUNT);
  let totalBytes = 0;
  const files = [];

  for (const file of rawFiles) {
    totalBytes += file.size;
    if (totalBytes > MAX_ATTACHMENT_BYTES) break;
    const bytes = await file.arrayBuffer();
    files.push({
      filename: safeFileName(file.name || 'attachment'),
      content: arrayBufferToBase64(bytes),
      content_type: file.type || 'application/octet-stream',
      size: file.size,
    });
  }

  return { body, attachments: { files, totalBytes } };
}

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function safeFileName(value: string) {
  return value
    .replace(/[^\w.\- ()]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'attachment';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'brief';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatContext(body: ContactForm) {
  const rows = [
    ['Client slug', body.client_slug],
    ['Repo', body.repo],
    ['Template', body.template],
    ['Preview URL', body.preview_url],
    ['Campaign ID', body.campaign_id],
    ['Brief ID', body.brief_id],
    ['UTM source', body.utm_source],
    ['UTM medium', body.utm_medium],
    ['UTM campaign', body.utm_campaign],
    ['UTM term', body.utm_term],
    ['UTM content', body.utm_content],
    ['GCLID', body.gclid],
    ['FBCLID', body.fbclid],
    ['MSCLKID', body.msclkid],
    ['TTCLID', body.ttclid],
    ['TWCLID', body.twclid],
    ['LinkedIn click ID', body.li_fat_id],
    ['GBRAID', body.gbraid],
    ['WBRAID', body.wbraid],
    ['Source', body.source],
    ['Ref', body.ref],
    ['First landing URL', body.first_landing_url],
    ['Last landing URL', body.last_landing_url],
    ['Referrer', body.referrer],
    ['Last referrer', body.last_referrer],
    ['First seen at', body.first_seen_at],
    ['Last seen at', body.last_seen_at],
  ].filter(([, value]) => value);

  return rows.length
    ? rows.map(([label, value]) => `${label}: ${value}`).join('\n')
    : 'N/A';
}
