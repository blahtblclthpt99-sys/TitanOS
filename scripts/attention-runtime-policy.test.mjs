import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const ux = await readFile(new URL('../src/lib/attentionUxRuntime.js', import.meta.url), 'utf8');

test('production build does not emit source maps or suppress critical Supabase preload', () => {
  assert.match(vite, /sourcemap:\s*false/);
  assert.doesNotMatch(vite, /name\.includes\(['"]supabase['"]\).*return false/s);
  assert.match(vite, /@supabase\/supabase-js/);
  assert.doesNotMatch(vite, /VITE_VERCEL_/);
  assert.doesNotMatch(vite, /DriverHub|Marketplace|AIAssistant|AuthenticatedShell/);
});

test('legacy browser-state purge is a one-time migration', () => {
  assert.match(main, /LEGACY_CLEANUP_KEY/);
  assert.match(main, /localStorage\.getItem\(LEGACY_CLEANUP_KEY\) === ['"]done['"]/);
  assert.match(main, /localStorage\.setItem\(LEGACY_CLEANUP_KEY, ['"]done['"]\)/);
  assert.match(main, /void purgeLegacyClientStateOnce\(\)/);
});

test('accessibility mutation work is coalesced to animation frames', () => {
  assert.match(ux, /new MutationObserver\(scheduleSync\)/);
  assert.match(ux, /requestAnimationFrame\(sync\)/);
  assert.match(ux, /cancelAnimationFrame\(syncFrame\)/);
});
