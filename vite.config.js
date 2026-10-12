import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import packageJson from './package.json' with { type: 'json' };
import { checkAndroidSupabaseEnv } from './scripts/verify-android-supabase-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  // Vite reads .env.production after resolving config. Merge its parsed VITE_*
  // values with explicit CI environment values, which must take precedence.
  const appEnv = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  // A Play APK/AAB must never compile without its actual public auth configuration.
  if (command === 'build' && appEnv.VITE_CAPACITOR_BUILD === 'true') {
    const { errors } = checkAndroidSupabaseEnv(appEnv);
    if (errors.length) throw new Error(`Invalid TitanOS Android Supabase configuration: ${errors.join('; ')}`);
  }
  return {
    base: appEnv.VITE_CAPACITOR_BUILD === 'true' ? './' : '/',
    plugins: [react()],
    define: {
      // Expose Vercel build metadata to the client Sentry release/environment
      "import.meta.env.VITE_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV || ""),
      "import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA": JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA || ""
      ),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      cssMinify: true,
      minify: 'esbuild',
      sourcemap: "hidden", // readable stacks after Sentry upload; not served publicly
      assetsInlineLimit: 2048,
      // Only preload the entry's critical deps — not lazy vendor islands
      modulePreload: {
        polyfill: true,
          resolveDependencies(filename, deps) {
          return deps.filter((dep) => {
            const name = dep.split('/').pop() || '';
            // Never preload heavy islands on the marketing entry
            if (name.includes('charts')) return false;
            if (name.includes('supabase')) return false;
            if (name.includes('motion')) return false;
            if (name.includes('AIAssistant')) return false;
            if (name.includes('AuthenticatedShell')) return false;
            if (name.includes('DriverHub')) return false;
            if (name.includes('Marketplace')) return false;
            if (name.includes('Dashboard')) return false;
            if (name.includes('toaster')) return false;
            // Always allow react-vendor + shared on entry (critical path)
            if (name.includes('react-vendor') || name.includes('shared')) return true;
            if (filename.includes('index') && (name.includes('icons') || name.includes('radix'))) {
              return false;
            }
            return true;
          });
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // Tiny shared utils must live in a dedicated chunk so they never
            // get parked inside charts/radix islands (which would force the
            // marketing entry to download those islands just for clsx/cva).
            if (
              id.includes('clsx') ||
              id.includes('class-variance-authority') ||
              id.includes('tailwind-merge') ||
              id.includes(`${path.sep}tslib${path.sep}`) ||
              id.includes('/tslib/')
            ) {
              return 'shared';
            }
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('framer-motion')) return 'motion';
            // Do NOT force recharts into a named chunk — dynamic imports already
            // split it, and a manual charts island pulls shared deps into entry.
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
              return 'react-vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    },
  };
});
