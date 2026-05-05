import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL?: string;
  FROM_EMAIL?: string;
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

    const notificationEmail = context.env.NOTIFICATION_EMAIL || 'hello@fengtalk.ai';
    const fromEmail = context.env.FROM_EMAIL || 'profitslocal <hello@fengtalk.ai>';
    const fileSummary = attachments.files.length
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
Files:
${fileSummary}

Message:
${message}`,
        reply_to: email,
        attachments: attachments.files.map((file) => ({
          filename: file.filename,
          content: file.content,
          content_type: file.content_type,
        })),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
