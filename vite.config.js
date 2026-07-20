import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    base: process.env.VITE_CAPACITOR_BUILD === 'true' ? './' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      cssMinify: true,
      minify: 'esbuild',
      sourcemap: false,
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
