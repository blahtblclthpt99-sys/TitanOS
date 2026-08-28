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

test('Titan Attention remains preserved and isolated behind /attention', async () => {
  await access(new URL('src/attention/App.jsx', root));
  await access(new URL('src/attention/index.css', root));
  await access(new URL('src/pages/TitanAttention.jsx', root));

  const main = await readFile(new URL('src/main.jsx', root), 'utf8');
  const attention = await readFile(new URL('src/attention/App.jsx', root), 'utf8');
  const wrapper = await readFile(new URL('src/pages/TitanAttention.jsx', root), 'utf8');

  assert.match(attention, /Titan Attention/);
  assert.match(attention, /attention-api/);
  assert.match(main, /window\.location\.pathname === ['"]\/attention['"]/);
  assert.match(main, /attentionStandalone \? <TitanAttention \/> : <App \/>/);
  assert.match(wrapper, /attachShadow\(\{ mode: ['"]open['"] \}\)/);
  assert.match(wrapper, /index\.css\?inline/);
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

test('Cloudflare Worker explicitly enables Node compatibility required by preserved handlers', async () => {
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  assert.match(wrangler, /"compatibility_flags"\s*:\s*\[[^\]]*"nodejs_compat"[^\]]*\]/s);
});

test('Cloudflare Worker exposes immutable version metadata and exact app origin for release certification', async () => {
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  const worker = await readFile(new URL('cloudflare/worker.js', root), 'utf8');
  assert.match(wrangler, /"version_metadata"\s*:\s*\{\s*"binding"\s*:\s*"CF_VERSION_METADATA"\s*\}/s);
  assert.match(worker, /env\.CF_VERSION_METADATA/);
  assert.match(worker, /app_origin:\s*cleanHttpsOrigin\(env\.APP_ORIGIN\) \|\| null/);
  assert.match(worker, /worker_version_id:/);
  assert.match(worker, /worker_version_tag:/);
  assert.match(worker, /worker_version_timestamp:/);
});

test('canonical production origin is app.titanfieldos.com across deployment and auth contracts', async () => {
  const env = await readFile(new URL('.env.production.example', root), 'utf8');
  const auth = await readFile(new URL('src/lib/auth-redirect.js', root), 'utf8');
  const originDoc = await readFile(new URL('docs/TITANOS_PRODUCTION_ORIGIN.md', root), 'utf8');
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  const certifier = await readFile(new URL('.github/workflows/cloudflare-production-certify.yml', root), 'utf8');
  const canonical = 'https://app.titanfieldos.com';

  assert.match(env, new RegExp(`VITE_TITANOS_PUBLIC_ORIGIN=${canonical.replaceAll('.', '\\.')}`));
  assert.match(env, new RegExp(`VITE_API_BASE_URL=${canonical.replaceAll('.', '\\.')}`));
  assert.match(env, new RegExp(`APP_ORIGIN=${canonical.replaceAll('.', '\\.')}`));
  assert.match(auth, /TITANOS_PRODUCTION_ORIGIN\s*=\s*["']https:\/\/app\.titanfieldos\.com["']/);
  assert.match(originDoc, /https:\/\/app\.titanfieldos\.com/);
  assert.match(wrangler, /"APP_ORIGIN"\s*:\s*"https:\/\/app\.titanfieldos\.com"/);
  assert.match(certifier, /TITAN_PROD_PUBLIC_ORIGIN:\s*https:\/\/app\.titanfieldos\.com/);
  assert.doesNotMatch(certifier, /vars\.TITAN_PROD_PUBLIC_ORIGIN/);
  assert.doesNotMatch(env, /titanos-web\.vercel\.app/);
  assert.doesNotMatch(auth, /titanos-web\.vercel\.app/);
});

test('Wrangler declares the production public bindings and required encrypted secret names', async () => {
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  assert.match(wrangler, /"SUPABASE_URL"\s*:\s*"https:\/\/xcfjpxcmokdfwkarwomy\.supabase\.co"/);
  for (const secret of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ATTENTION_STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    assert.match(wrangler, new RegExp(`"${secret}"`));
  }
  assert.match(wrangler, /"secrets"\s*:\s*\{\s*"required"/s);
});

test('Cloudflare payment edge remains independent of the retired Vercel hostname', async () => {
  const worker = await readFile(new URL('cloudflare/worker.js', root), 'utf8');
  const wrangler = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  assert.doesNotMatch(worker, /LEGACY_API_ORIGIN|titanos-web\.vercel\.app/);
  assert.doesNotMatch(wrangler, /LEGACY_API_ORIGIN|titanos-web\.vercel\.app/);
  assert.match(worker, /legacy_proxy:\s*false/);
});
