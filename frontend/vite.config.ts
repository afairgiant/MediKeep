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
