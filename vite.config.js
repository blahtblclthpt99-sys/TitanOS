import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    base: process.env.VITE_CAPACITOR_BUILD === 'true' ? './' : '/',
    plugins: [react()],
    define: {
      // Expose Vercel build metadata to the client Sentry release/environment
      "import.meta.env.VITE_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV || ""),
      "import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA": JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA || ""
      ),
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
            if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-vendor";
            if (id.includes("@supabase/supabase-js")) return "supabase";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("recharts")) return "charts";
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
