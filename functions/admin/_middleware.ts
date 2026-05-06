import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  ADMIN_ACCESS_TOKEN?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = context.env.ADMIN_ACCESS_TOKEN || '';
  if (!token) return text('Admin access is not configured.', 503);

  const url = new URL(context.request.url);
  const queryToken = url.searchParams.get('token') || '';
  const cookieToken = readCookie(context.request.headers.get('cookie') || '', 'pl_admin_token');
  const authToken = bearerToken(context.request.headers.get('authorization') || '');
  const provided = queryToken || cookieToken || authToken;
  if (provided !== token) return text('Unauthorized.', 401, { 'WWW-Authenticate': 'Bearer realm="ProfitsLocal Admin"' });

  if (queryToken && context.request.method === 'GET') {
    url.searchParams.delete('token');
    const headers = new Headers({
      Location: `${url.pathname}${url.search}${url.hash}`,
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
