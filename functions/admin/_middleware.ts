import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  ADMIN_ACCESS_TOKEN?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = context.env.ADMIN_ACCESS_TOKEN || '';
  if (!token) return respondUnavailable(context.request);

  const url = new URL(context.request.url);
  const queryToken = url.searchParams.get('token') || '';
  const formToken = await readFormToken(context.request);
  const redirectTarget = await readRedirectTarget(context.request, url);
  const cookieToken = readCookie(context.request.headers.get('cookie') || '', 'pl_admin_token');
  const authToken = bearerToken(context.request.headers.get('authorization') || '');
  const provided = queryToken || formToken || cookieToken || authToken;
  if (provided !== token) return respondUnauthorized(context.request, url, Boolean(queryToken || formToken));

  if ((queryToken && context.request.method === 'GET') || (formToken && context.request.method === 'POST')) {
    url.searchParams.delete('token');
    const headers = new Headers({
      Location: redirectTarget,
      'Set-Cookie': `pl_admin_token=${token}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
    });
    return new Response(null, { status: 302, headers });
  }

  return context.next();
};

function bearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function readCookie(header: string, name: string) {
  return header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

async function readFormToken(request: Request) {
  if (request.method !== 'POST') return '';
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
    return '';
  }
  const formData = await request.clone().formData();
  const value = formData.get('token');
  return typeof value === 'string' ? value.trim() : '';
}

async function readRedirectTarget(request: Request, url: URL) {
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.clone().formData();
      const value = formData.get('redirect_to');
      if (typeof value === 'string' && isSafeAdminPath(value)) return value;
    }
  }

  const sanitized = new URL(url.toString());
  sanitized.searchParams.delete('token');
  return `${sanitized.pathname}${sanitized.search}${sanitized.hash}`;
}

function isSafeAdminPath(value: string) {
  return value.startsWith('/admin');
}

function respondUnavailable(request: Request) {
  if (!wantsHtml(request)) {
    return text('Admin access is not configured.', 503);
  }

  return html(renderPage({
    title: 'Admin unavailable',
    eyebrow: 'Admin access',
    heading: 'Admin access is not configured',
    body: 'This environment does not have an admin token yet. Add ADMIN_ACCESS_TOKEN before using the internal dashboard.',
    requestPath: new URL(request.url).pathname,
    status: 503,
    showForm: false,
  }), 503);
}

function respondUnauthorized(request: Request, url: URL, showError: boolean) {
  if (!wantsHtml(request)) {
    return text('Unauthorized.', 401, { 'WWW-Authenticate': 'Bearer realm="ProfitsLocal Admin"' });
  }

  return html(renderPage({
    title: 'Admin sign in',
    eyebrow: 'ProfitsLocal admin',
    heading: 'Enter the admin access token',
    body: 'Use the same token you keep in the operator SOP. After one successful sign-in, this browser will keep a secure cookie for the admin routes.',
    requestPath: `${url.pathname}${url.search}${url.hash}`,
    status: 401,
    showForm: true,
    error: showError ? 'The token did not match this environment. Please try again.' : '',
  }), 401, { 'WWW-Authenticate': 'Bearer realm="ProfitsLocal Admin"' });
}

function wantsHtml(request: Request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || accept.includes('*/*');
}

function text(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function html(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function renderPage({
  title,
  eyebrow,
  heading,
  body,
  requestPath,
  status,
  showForm,
  error = '',
}: {
  title: string;
  eyebrow: string;
  heading: string;
  body: string;
  requestPath: string;
  status: number;
  showForm: boolean;
  error?: string;
}) {
  const safePath = escapeHtml(requestPath);
  const safeBody = escapeHtml(body);
  const safeHeading = escapeHtml(heading);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeError = escapeHtml(error);
  const statusLabel = status === 401 ? 'Secure sign-in required' : 'Configuration required';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - profitslocal</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6efe5;
      --panel: rgba(255,255,255,0.88);
      --ink: #131110;
      --muted: #6f625a;
      --line: rgba(19,17,16,0.12);
      --accent: #ff5a3d;
      --accent-ink: #ffffff;
      --shadow: 0 24px 60px rgba(19, 17, 16, 0.12);
      --radius: 28px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255,90,61,0.14), transparent 28rem),
        radial-gradient(circle at bottom right, rgba(19,17,16,0.10), transparent 26rem),
        var(--bg);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .shell {
      width: min(100%, 1040px);
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
      backdrop-filter: blur(18px);
    }
    .brand-panel, .form-panel { padding: 36px; }
    .brand-panel {
      border-right: 1px solid var(--line);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.64), rgba(255,255,255,0.84)),
        linear-gradient(135deg, rgba(255,90,61,0.12), transparent 55%);
      display: flex;
      flex-direction: column;
      gap: 24px;
      justify-content: space-between;
    }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--ink);
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 0;
    }
    .brand-mark img { width: 136px; height: auto; display: block; }
    .eyebrow {
      display: inline-flex;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    h1 {
      margin: 0;
      font-size: clamp(34px, 4vw, 56px);
      line-height: 0.94;
      max-width: 10ch;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 16px;
    }
    .meta {
      display: grid;
      gap: 12px;
      padding-top: 12px;
    }
    .meta-card {
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.75);
    }
    .meta-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .meta-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--ink);
      word-break: break-word;
    }
    .form-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      background: rgba(255,255,255,0.94);
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      gap: 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 8px 12px;
      background: rgba(19,17,16,0.04);
      color: var(--ink);
      font-size: 13px;
      font-weight: 600;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 4px rgba(255,90,61,0.14);
    }
    form { display: grid; gap: 14px; }
    label {
      display: grid;
      gap: 8px;
      font-size: 14px;
      color: var(--ink);
      font-weight: 600;
    }
    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
      font: inherit;
      color: var(--ink);
      background: #fff;
    }
    input:focus {
      outline: 2px solid rgba(255,90,61,0.22);
      outline-offset: 2px;
      border-color: rgba(255,90,61,0.4);
    }
    .error {
      border: 1px solid rgba(179, 55, 31, 0.16);
      background: rgba(255,90,61,0.08);
      color: #8a2918;
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 14px;
      line-height: 1.5;
    }
    button {
      appearance: none;
      border: none;
      border-radius: 999px;
      padding: 15px 18px;
      font: inherit;
      font-weight: 700;
      background: var(--accent);
      color: var(--accent-ink);
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(255,90,61,0.22);
    }
    .helper {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
    }
    .helper code {
      font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(19,17,16,0.06);
      color: var(--ink);
    }
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
      .brand-panel { border-right: none; border-bottom: 1px solid var(--line); }
      h1 { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="brand-panel">
      <div>
        <a class="brand-mark" href="/">
          <img src="/brand/logo-horizontal.svg" alt="profitslocal" />
        </a>
      </div>
      <div>
        <span class="eyebrow">${safeEyebrow}</span>
        <h1>${safeHeading}</h1>
      </div>
      <p>${safeBody}</p>
      <div class="meta">
        <div class="meta-card">
          <span class="meta-label">Requested path</span>
          <span class="meta-value">${safePath}</span>
        </div>
        <div class="meta-card">
          <span class="meta-label">What this unlocks</span>
          <span class="meta-value">Overview, intakes, queue, finance, project-level operator tools.</span>
        </div>
      </div>
    </section>
    <section class="form-panel">
      <span class="status-chip"><span class="status-dot"></span>${statusLabel}</span>
      ${showForm ? `
      ${safeError ? `<div class="error">${safeError}</div>` : ''}
      <form method="post" action="${safePath}">
        <input type="hidden" name="redirect_to" value="${safePath}" />
        <label>
          Admin access token
          <input name="token" type="password" autocomplete="current-password" placeholder="Paste the current admin token" required />
        </label>
        <button type="submit">Open admin</button>
      </form>
      <p class="helper">Tip: if you already have a direct token link, you can still use <code>?token=...</code> once and the browser will keep the admin cookie for seven days.</p>
      ` : `
      <p class="helper">Once the environment variable is added, this page will accept the admin token and keep the browser signed in for the internal dashboard.</p>
      `}
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
