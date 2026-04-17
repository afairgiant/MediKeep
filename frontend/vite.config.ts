import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable JSX in .js files for gradual migration from CRA
      include: '**/*.{jsx,js,tsx,ts}',
      jsxRuntime: 'automatic',
    }),
    svgr(), // Allows importing SVGs as React components
    tsconfigPaths(), // Respects tsconfig baseUrl: "src"
    // Expose English locale JSONs (which live in public/locales/en so the HTTP backend
    // can serve other languages from the same tree) as a virtual module so they can be
    // bundled synchronously by the i18n config without triggering Vite's
    // "no imports from public/" restriction.
    {
      name: 'bundled-en-locales',
      resolveId(id) {
        if (id === 'virtual:bundled-en-locales') return '\0' + id;
        return null;
      },
      load(id) {
        if (id !== '\0virtual:bundled-en-locales') return null;
        const dir = path.resolve(__dirname, 'public/locales/en');
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        const entries = files.map((f) => {
          const ns = f.replace(/\.json$/, '');
          const fullPath = path.join(dir, f);
          // Register each locale JSON as a Rollup/Vite watched file so edits
          // invalidate this virtual module in dev instead of silently showing
          // stale keys until the dev server is restarted.
          this.addWatchFile(fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          return `  ${JSON.stringify(ns)}: ${content}`;
        });
        return `export default {\n${entries.join(',\n')}\n};\n`;
      },
      handleHotUpdate({ file, server }) {
        // Normalize both paths to forward slashes without trailing separator so
        // the boundary check can't match sibling directories like `.../en-GB/`.
        const localesDir = path
          .resolve(__dirname, 'public/locales/en')
          .replace(/\\/g, '/')
          .replace(/\/$/, '');
        const normalized = file.replace(/\\/g, '/');
        const isInsideLocalesDir = normalized.startsWith(localesDir + '/');
        if (!isInsideLocalesDir || !normalized.endsWith('.json')) {
          return;
        }
        const mod = server.moduleGraph.getModuleById(
          '\0virtual:bundled-en-locales'
        );
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
      },
    },
    // Inject build version into service-worker.js so the browser detects SW updates
    {
      name: 'sw-version-inject',
      apply: 'build',
      writeBundle(options) {
        const outDir = options.dir || path.resolve(__dirname, 'build');
        const swPath = path.join(outDir, 'service-worker.js');
        if (!fs.existsSync(swPath)) {
          this.warn('service-worker.js not found in build output — SW version injection skipped');
          return;
        }
        let content = fs.readFileSync(swPath, 'utf-8');
        if (!content.includes('__SW_VERSION__')) {
          this.warn('__SW_VERSION__ placeholder not found in service-worker.js — cache versioning will not work');
          return;
        }
        const hash = crypto.createHash('md5').update(content + Date.now()).digest('hex').slice(0, 10);
        content = content.replace('__SW_VERSION__', hash);
        fs.writeFileSync(swPath, content, 'utf-8');
      },
    },
  ],

  // Development server configuration
  server: {
    port: 3000,
    open: true,
    hmr: {
      overlay: true, // Show errors in browser overlay
    },
    watch: {
      // Ignore node_modules and build directories to prevent unnecessary reloads
      ignored: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.git/**'],
    },

    // Proxy configuration for API requests
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Preserve headers including Authorization
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Ensure Authorization header is forwarded
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
        },
      },
    },
  },

  // Build configuration
  build: {
    outDir: 'build',
    sourcemap: true,

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and related libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],

          // Mantine UI library (your primary UI framework)
          mantine: [
            '@mantine/core',
            '@mantine/hooks',
            '@mantine/form',
            '@mantine/dates',
            '@mantine/notifications',
            '@mantine/dropzone',
          ],

          // Chart libraries
          charts: ['chart.js', 'react-chartjs-2', 'recharts'],

          // Icons
          icons: ['@tabler/icons-react', 'lucide-react'],

          // i18n
          i18n: ['i18next', 'react-i18next', 'i18next-http-backend'],
        },
      },
    },
  },

  // Optimize dependencies (pre-bundle for faster dev server)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mantine/core',
      '@mantine/hooks',
      'i18next',
      'react-i18next',
    ],
  },

  // Resolve configuration
  resolve: {
    alias: {
      // tsconfig-paths plugin handles baseUrl: "src" from tsconfig.json
      // No need to manually add `'@': path.resolve(__dirname, './src')`

      // Shared data directory (single source of truth for test library, etc.)
      // NOTE: This alias is defined for IDE support and potential future use.
      // In actual imports, we use relative paths (e.g., '../../../shared/data/test_library.json')
      // for better Docker build compatibility where alias resolution can be unreliable.
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },

});
