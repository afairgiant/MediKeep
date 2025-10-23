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
};
