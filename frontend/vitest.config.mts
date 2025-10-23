import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react({
      include: '**/*.{jsx,js,tsx,ts}',
      jsxRuntime: 'automatic',
    }),
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.js',
        'src/test-utils/',
        '**/*.test.js',
        '**/*.test.jsx',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
});
