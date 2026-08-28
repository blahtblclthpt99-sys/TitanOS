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

test('production boot path reaches the full authenticated TitanOS shell', async () => {
  const main = await readFile(new URL('src/main.jsx', root), 'utf8');
  const app = await readFile(new URL('src/App.jsx', root), 'utf8');

  assert.match(main, /import App from ['"]@\/App\.jsx['"]/);
  assert.match(main, /<App\s*\/>/);
  assert.match(app, /lazy\(\(\) => import\(['"]\.\/AuthenticatedShell['"]\)\)/);
  assert.match(app, /<AuthenticatedShell\s*\/>/);
  assert.match(app, /<AuthProvider>/);
  assert.match(app, /BrowserRouter/);
  assert.match(app, /HashRouter/);
  assert.match(app, /<Route path=['"]\/login['"]/);
  assert.match(app, /<Route path=['"]\/portal['"]/);
});

test('production boot does not purge TitanOS state or unregister the PWA at module load', async () => {
  const main = await readFile(new URL('src/main.jsx', root), 'utf8');
  assert.doesNotMatch(main, /purgeLegacyClientState/);
  assert.doesNotMatch(main, /\^\(titanos-\|titan-\|second-\|driver-\|job-\|business-\)/);
  assert.match(main, /serviceWorker\.register\(['"]\/sw\.js['"]\)/);
});

test('Titan Attention remains preserved as a separate migration module', async () => {
  await access(new URL('src/attention/App.jsx', root));
  await access(new URL('src/attention/index.css', root));
  const attention = await readFile(new URL('src/attention/App.jsx', root), 'utf8');
  assert.match(attention, /Titan Attention/);
  assert.match(attention, /attention-api/);
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
