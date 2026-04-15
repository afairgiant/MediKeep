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
  plugins: ['i18next', 'unused-imports'],
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
    // Disable core no-unused-vars in favor of unused-imports, which auto-fixes unused imports
    'no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    'no-console': 'error', // Prevent all console statements - use logger instead
    // prop-types disabled: project is migrating to TypeScript, which provides stronger guarantees
    'react/prop-types': 'off',
    // React Compiler / React 19 prep rules (eslint-plugin-react-hooks v7).
    // The project is on React 18 without the Compiler; re-enable these rules
    // as part of the React 19 upgrade. Tracked in TECHNICAL_DEBT.md.
    'react-hooks/error-boundaries': 'off',
    'react-hooks/static-components': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'off',
    'i18next/no-literal-string': ['warn', {
      markupOnly: true,
      ignoreCallee: [
        'console.*',
        'logger.*',
        'require',
        'import',
      ],
      ignoreAttribute: [
        'data-testid',
        'className',
        'styleName',
        'type',
        'name',
        'id',
        'to',
        'href',
        'target',
        'rel',
        'key',
        'icon',
        'variant',
        'size',
        'color',
        'radius',
        'position',
        'component',
        'leftSection',
        'rightSection',
      ],
    }],
  },
  overrides: [
    {
      // Vitest test files and test-adjacent helpers: declare test runner globals
      // so ESLint doesn't flag them as undefined. Covers:
      //   - *.test.* / *.spec.*
      //   - anything under __tests__/, test-utils/, or testing/ (helpers, fixtures)
      files: [
        '**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx',
        '**/*.spec.js', '**/*.spec.jsx', '**/*.spec.ts', '**/*.spec.tsx',
        '**/__tests__/**/*.{js,jsx,ts,tsx}',
        '**/test-utils/**/*.{js,jsx,ts,tsx}',
        '**/testing/**/*.{js,jsx,ts,tsx}',
        '**/setupTests.{js,jsx,ts,tsx}',
      ],
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
      rules: {
        'i18next/no-literal-string': 'off',
        // Tests frequently mock/suppress console output — allow console use.
        'no-console': 'off',
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
        // TypeScript handles unused-checking via tsc; the unused-imports plugin
        // still runs and auto-fixes unused imports (which tsc only warns about).
      },
    },
  ],
};
