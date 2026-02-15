import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

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
    // Disable ESLint plugin during dev - it's causing constant restarts
    // You can run `npm run lint` separately to check for issues
    // eslint({
    //   cache: false,
    //   include: ['src/**/*.js', 'src/**/*.jsx'],
    //   exclude: ['node_modules', 'build', 'dist', 'src/**/*.ts', 'src/**/*.tsx'],
    //   failOnError: false,
    //   failOnWarning: false,
    // }),
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
