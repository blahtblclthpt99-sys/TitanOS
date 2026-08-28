import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const requiredPaths = [
  'src/AuthenticatedShell.jsx',
  'src/components/layout/AppLayout.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/AIAssistant.jsx',
  'src/pages/DriverHub.jsx',
  'src/pages/Marketplace.jsx',
  'src/pages/Settings.jsx',
  'src/api/functions.js',
  'api/functions/titanAI.js',
  'api/functions/supportAI.js',
  'api/functions/stripeWebhook.js',
  'postcss.config.js',
  'vite.config.js',
  'cloudflare/worker.js',
  'cloudflare/attention-api.js',
  'wrangler.jsonc',
];

test('Cloudflare candidate preserves the complete TitanOS application surface', async () => {
  for (const path of requiredPaths) {
    await access(new URL(path, root));
  }
});

test('Cloudflare migration does not replace the full TitanOS package graph with a mini-app', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.name, 'titanos');
  assert.ok(Object.keys(pkg.dependencies || {}).length >= 40);
  assert.ok(pkg.scripts?.['gate:ship']);
  assert.ok(pkg.scripts?.['test:ai']);
  assert.ok(pkg.scripts?.['test:driver']);
  assert.ok(pkg.dependencies?.['@tanstack/react-query']);
  assert.ok(pkg.dependencies?.['@capacitor/core']);
});

test('Cloudflare payment edge remains independent of the retired Vercel hostname', async () => {
  const worker = await readFile(new URL('cloudflare/worker.js', root), 'utf8');
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  assert.doesNotMatch(worker, /LEGACY_API_ORIGIN|titanos-web\.vercel\.app/);
  assert.doesNotMatch(wrangler, /LEGACY_API_ORIGIN|titanos-web\.vercel\.app/);
  assert.match(worker, /legacy_proxy:\s*false/);
});
