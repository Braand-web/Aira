import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

test('the real legacy pricing route opens billing settings and preserves only a single payment reference', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../app/pricing/page.tsx', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [{
      name: 'redirect-fixture',
      setup(builder) {
        builder.onResolve({filter: /^next\/navigation$/}, () => ({path: 'redirect', namespace: 'fixture'}));
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({
          contents: 'export function redirect(location) { throw Object.assign(new Error("redirect"), {location}); }',
          loader: 'js',
        }));
      },
    }],
  });
  const {default: Pricing} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const cases = [
    [{}, '/?settings=billing'],
    [{billingOrder: 'order-return'}, '/?settings=billing&billingOrder=order-return'],
    [{billingOrder: ['first', 'second']}, '/?settings=billing'],
    [{settings: 'general', return_to: 'https://example.test'}, '/?settings=billing'],
    [{billingOrder: 'order&settings=general#other'}, '/?settings=billing&billingOrder=order%26settings%3Dgeneral%23other'],
  ];
  for (const [query, destination] of cases) {
    await assert.rejects(Pricing({searchParams: Promise.resolve(query)}), error => error.location === destination);
  }
});
