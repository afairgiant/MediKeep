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
      rules: {
        'i18next/no-literal-string': 'off',
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
