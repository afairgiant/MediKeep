module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime', // For new JSX transform (no need to import React)
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Add custom rules here
    'no-unused-vars': 'warn',
    'no-console': 'error', // Prevent all console statements - use logger instead
    'react/prop-types': 'warn', // Warn on missing prop types
  },
  overrides: [
    {
      // Vitest test files: declare test runner globals so ESLint doesn't flag them as undefined
      files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.js', '**/*.spec.jsx', '**/*.spec.ts', '**/*.spec.tsx'],
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    {
      // TypeScript files: use the TypeScript parser so type annotations are valid
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      rules: {
        // TypeScript handles type-checking; disable the JS variant to avoid false positives
        'no-unused-vars': 'off',
        // prop-types are redundant when TypeScript types are used
        'react/prop-types': 'off',
      },
    },
  ],
};
