import type { PagesFunction } from '@cloudflare/workers-types';
import { uploadAttachmentsToCloudinary, uploadCloudinaryManifest, summarizeCloudinaryAssets } from '../../core/cloudinary/attachments.js';

interface Env {
  STRIPE_SECRET_KEY: string;
  DEFAULT_REPO_OWNER?: string;
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

type TierId = 'one_time' | 'yearly_maintenance' | 'extra_revision';

interface CheckoutRequest {
  tier?: string;
  client_slug?: string;
  repo?: string;
  template?: string;
  preview_url?: string;
  campaign_id?: string;
  brief_id?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  preferred_domain?: string;
  launch_notes?: string;
  parent_order_id?: string;
  auto_run_agent?: string | boolean;
  amount?: string;
  currency?: string;
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

const TIERS: Record<TierId, {
  name: string;
  amount: number;
  mode: 'payment' | 'subscription';
  description: string;
}> = {
  one_time: {
    name: 'profitslocal one-time website',
    amount: 39900,
    mode: 'payment',
    description: 'Website launch with 3 included revision requests.',
  },
  yearly_maintenance: {
    name: 'profitslocal yearly website maintenance',
    amount: 79900,
    mode: 'subscription',
    description: 'Website launch, maintenance, local SEO cleanup, and monthly updates.',
  },
  extra_revision: {
    name: 'profitslocal extra revision',
    amount: 10000,
    mode: 'payment',
    description: 'One extra revision request for an existing order.',
  },
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.STRIPE_SECRET_KEY) {
      return json({ error: 'Stripe is not configured.' }, 500);
    }

    const contentType = context.request.headers.get('content-type') || '';
    const { body, attachments } = contentType.includes('multipart/form-data')
      ? await readMultipartCheckout(context.request)
      : { body: await context.request.json<CheckoutRequest>(), attachments: { files: [], totalBytes: 0 } };
    const tierId = normalizeTier(body.tier);
    const tier = TIERS[tierId];
    const email = clean(body.email);
    const businessName = clean(body.business_name);

    if (!email || !email.includes('@')) {
      return json({ error: 'A valid email is required.' }, 400);
    }

    if (tierId === 'extra_revision' && !clean(body.parent_order_id)) {
      return json({ error: 'Original order ID is required for extra revisions.' }, 400);
    }

    if (attachments.totalBytes > MAX_ATTACHMENT_BYTES) {
      return json({ error: 'Attachments are too large.' }, 413);
    }

    const clientSlug = clean(body.client_slug) || slugify(businessName) || 'profitslocal-main';
    const repo = clean(body.repo) || `${clean(context.env.DEFAULT_REPO_OWNER) || 'matthew6688'}/${clientSlug}`;
    const previewUrl = clean(body.preview_url);
    const requestedAutoRun = boolString(body.auto_run_agent);
    const autoRunAgent = requestedAutoRun ?? Boolean(clean(body.repo) && clientSlug && previewUrl);
    const orderKind = autoRunAgent ? 'sale' : 'paid_intake';
    const origin = new URL(context.request.url).origin;
    const cloudinary = await uploadAttachmentsToCloudinary(context.env, attachments.files, {
      clientSlug,
      orderId: `checkout-${Date.now()}`,
      submissionType: 'checkout',
    });
    if (!cloudinary.ok && cloudinary.configured) {
      return json({ error: cloudinary.error || 'Unable to upload checkout attachments.' }, 502);
    }
    const manifest: any = cloudinary.ok && cloudinary.assets?.length
      ? await uploadCloudinaryManifest(context.env, cloudinary.assets, {
        clientSlug,
        orderId: `checkout-${Date.now()}`,
        submissionType: 'checkout-manifest',
      })
      : { ok: false };
    const attachmentSummary = cloudinary.ok && cloudinary.assets?.length
      ? summarizeCloudinaryAssets(cloudinary.assets)
      : attachments.files
        .map((file) => `${file.filename} (${file.content_type || 'unknown'}, ${formatBytes(file.size)})`)
        .join('\n');

    const metadata: Record<string, string> = compactMetadata({
      tier: tierId,
      amount: String(tier.amount / 100),
      checkout_amount_param: clean(body.amount),
      currency: clean(body.currency) || 'USD',
      client_slug: clientSlug,
      repo,
      template: clean(body.template) || 'webjuice-restaurant',
      preview_url: previewUrl,
      campaign_id: clean(body.campaign_id) || 'profitslocal-main',
      brief_id: clean(body.brief_id),
      business_name: businessName || clientSlug,
      company: businessName || clientSlug,
      email,
      phone: clean(body.phone),
      preferred_domain: clean(body.preferred_domain),
      domain: clean(body.preferred_domain),
      launch_notes: clean(body.launch_notes),
      attachment_summary: attachmentSummary,
      asset_manifest_url: manifest.ok ? manifest.asset.secureUrl : '',
      asset_manifest_public_id: manifest.ok ? manifest.asset.publicId : '',
      parent_order_id: clean(body.parent_order_id),
      auto_run_agent: autoRunAgent ? 'true' : 'false',
      order_kind: orderKind,
      first_landing_url: clean(body.first_landing_url),
      last_landing_url: clean(body.last_landing_url),
      referrer: clean(body.referrer),
      last_referrer: clean(body.last_referrer),
      first_seen_at: clean(body.first_seen_at),
      last_seen_at: clean(body.last_seen_at),
      utm_source: clean(body.utm_source),
      utm_medium: clean(body.utm_medium),
      utm_campaign: clean(body.utm_campaign),
      utm_term: clean(body.utm_term),
      utm_content: clean(body.utm_content),
      gclid: clean(body.gclid),
      fbclid: clean(body.fbclid),
      msclkid: clean(body.msclkid),
      ttclid: clean(body.ttclid),
      twclid: clean(body.twclid),
      li_fat_id: clean(body.li_fat_id),
      gbraid: clean(body.gbraid),
      wbraid: clean(body.wbraid),
      source: clean(body.source),
      ref: clean(body.ref),
    });

    if (attachments.files.length) {
      const notification = await sendCheckoutAttachmentNotification(context.env, {
        tierId,
        businessName: businessName || clientSlug,
        email,
        phone: clean(body.phone),
        preferredDomain: clean(body.preferred_domain),
        launchNotes: clean(body.launch_notes),
        clientSlug,
        previewUrl,
        attachmentSummary,
        cloudinaryAssets: cloudinary.ok ? cloudinary.assets : [],
        attachments: cloudinary.ok && cloudinary.assets?.length ? [] : attachments.files,
      });
      if (!notification.ok) {
        return json({ error: notification.error || 'Unable to send checkout attachments.' }, 502);
      }
    }

    const params = new URLSearchParams({
      mode: tier.mode,
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}&client_slug=${encodeURIComponent(clientSlug)}&tier=${tierId}`,
      cancel_url: `${origin}/checkout?tier=${tierId}&client_slug=${encodeURIComponent(clientSlug)}`,
      customer_email: email,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(tier.amount),
      'line_items[0][price_data][product_data][name]': tier.name,
      'line_items[0][price_data][product_data][description]': tier.description,
    });

    if (tier.mode === 'subscription') {
      params.set('line_items[0][price_data][recurring][interval]', 'year');
      addNestedMetadata(params, 'subscription_data[metadata]', metadata);
    } else {
      addNestedMetadata(params, 'payment_intent_data[metadata]', metadata);
    }
    addNestedMetadata(params, 'metadata', metadata);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const stripeBody = await stripeResponse.json<any>();
    if (!stripeResponse.ok) {
      return json({
        error: stripeBody?.error?.message || 'Unable to create Stripe Checkout session.',
      }, 502);
    }

    return json({
      id: stripeBody.id,
      url: stripeBody.url,
      autoRunAgent,
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return json({ error: 'Internal error.' }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }
  return onRequestPost(context);
};

function normalizeTier(value: unknown): TierId {
  if (value === 'yearly_maintenance' || value === 'extra_revision') return value;
  return 'one_time';
}

function addNestedMetadata(params: URLSearchParams, prefix: string, metadata: Record<string, string>) {
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`${prefix}[${key}]`, value);
  }
}

function compactMetadata(values: Record<string, unknown>) {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const cleaned = clean(value);
    if (cleaned) metadata[key] = cleaned.slice(0, 500);
  }
  return metadata;
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function boolString(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readMultipartCheckout(request: Request) {
  const formData = await request.formData();
  const body: CheckoutRequest = {
    tier: stringField(formData, 'tier'),
    client_slug: stringField(formData, 'client_slug'),
    repo: stringField(formData, 'repo'),
    template: stringField(formData, 'template'),
    preview_url: stringField(formData, 'preview_url'),
    campaign_id: stringField(formData, 'campaign_id'),
    brief_id: stringField(formData, 'brief_id'),
    business_name: stringField(formData, 'business_name'),
    email: stringField(formData, 'email'),
    phone: stringField(formData, 'phone'),
    preferred_domain: stringField(formData, 'preferred_domain'),
    launch_notes: stringField(formData, 'launch_notes'),
    parent_order_id: stringField(formData, 'parent_order_id'),
    auto_run_agent: stringField(formData, 'auto_run_agent'),
    amount: stringField(formData, 'amount'),
    currency: stringField(formData, 'currency'),
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

async function sendCheckoutAttachmentNotification(env: Env, details: {
  tierId: TierId;
  businessName: string;
  email: string;
  phone: string;
  preferredDomain: string;
  launchNotes: string;
  clientSlug: string;
  previewUrl: string;
  attachmentSummary: string;
  cloudinaryAssets?: Array<{ filename?: string; publicId?: string; secureUrl?: string; resourceType?: string; bytes?: number }>;
  attachments: Array<{ filename: string; content: string; content_type: string; size: number }>;
}) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'Resend is not configured for attachments.' };
  const notificationEmail = env.NOTIFICATION_EMAIL || 'hello@fengtalk.ai';
  const fromEmail = env.FROM_EMAIL || 'profitslocal <hello@fengtalk.ai>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: notificationEmail,
      subject: `Checkout assets: ${details.businessName}`,
      text: `Business: ${details.businessName}
Email: ${details.email}
Phone: ${details.phone || 'N/A'}
Tier: ${details.tierId}
Client slug: ${details.clientSlug}
Preview: ${details.previewUrl || 'N/A'}
Preferred domain: ${details.preferredDomain || 'N/A'}

Files:
${details.attachmentSummary || 'None'}

Cloudinary assets:
${details.cloudinaryAssets?.length ? details.cloudinaryAssets.map((asset) => `- ${asset.filename || asset.publicId}: ${asset.secureUrl || asset.publicId}`).join('\n') : 'None'}

Launch notes:
${details.launchNotes || 'N/A'}`,
      reply_to: details.email,
      attachments: details.attachments.map((file) => ({
        filename: file.filename,
        content: file.content,
        content_type: file.content_type,
      })),
    }),
  });

  if (!response.ok) return { ok: false, error: await response.text() };
  return { ok: true };
}

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
