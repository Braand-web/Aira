import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicPagesGateway} from '../lib/public-pages-gateway.mjs';

test('public pages origin exposes only existing publication routes and strips application credentials', async () => {
  const calls = [];
  const gateway = publicPagesGateway({fetch: async request => {calls.push(request); return new Response('renderer');}});
  const env = {PAGES_ORIGIN: 'https://pages.example.test'};
  for (const path of ['/', '/api/workspace', '/auth/form', '/api/published/', '/api/published/test/leads', '/api/published/%2e%2e', '/_next/private.js']) {
    assert.equal((await gateway.fetch(new Request(env.PAGES_ORIGIN + path), env)).status, 404);
  }
  assert.equal((await gateway.fetch(new Request('https://app.example.test/api/published/page'), env)).status, 404);
  assert.equal((await gateway.fetch(new Request(env.PAGES_ORIGIN + '/api/published/page', {method: 'DELETE'}), env)).status, 405);
  assert.equal(calls.length, 0);
  const headers = {Cookie: 'session=private', Authorization: 'Bearer private', 'x-braand-identity-id': 'forged', 'oai-authenticated-user-email': 'forged', 'x-braand-workspace': 'private'};
  assert.equal((await gateway.fetch(new Request(env.PAGES_ORIGIN + '/api/published/page', {headers}), env)).status, 200);
  for (const name of Object.keys(headers)) assert.equal(calls[0].headers.has(name), false);
  const response = await gateway.fetch(new Request(env.PAGES_ORIGIN + '/api/published/page', {method: 'POST', headers: {Origin: env.PAGES_ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'consent=yes'}), env);
  assert.equal(response.status, 200);
  assert.equal(calls[1].headers.get('origin'), env.PAGES_ORIGIN);
  assert.equal(await calls[1].text(), 'consent=yes');
});
