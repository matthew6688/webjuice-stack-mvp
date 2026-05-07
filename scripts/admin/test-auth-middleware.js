import assert from 'node:assert/strict';
import { onRequest } from '../../functions/admin/_middleware.ts';

const env = {
  ADMIN_ACCESS_TOKEN: 'test-admin-token',
};

async function run() {
  await testHtmlUnauthorized();
  await testFormSignIn();
  console.log('admin auth middleware ok');
}

async function testHtmlUnauthorized() {
  const response = await onRequest(makeContext(new Request('https://profitslocal.com/admin', {
    headers: { Accept: 'text/html' },
  })));

  const html = await response.text();

  assert.equal(response.status, 401);
  assert.match(html, /Enter the admin access token/);
  assert.match(html, /Open admin/);
  assert.match(html, /Requested path/);
}

async function testFormSignIn() {
  const form = new URLSearchParams({
    token: env.ADMIN_ACCESS_TOKEN,
    redirect_to: '/admin/finance',
  });

  const response = await onRequest(makeContext(new Request('https://profitslocal.com/admin', {
    method: 'POST',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })));

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/admin/finance');
  assert.match(response.headers.get('Set-Cookie') || '', /pl_admin_token=test-admin-token/);
}

function makeContext(request) {
  return {
    env,
    request,
    next: () => new Response('next'),
  };
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
