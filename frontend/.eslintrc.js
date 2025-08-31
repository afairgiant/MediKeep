module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Add custom rules here
    'no-unused-vars': 'warn',
    'no-console': 'error', // Prevent all console statements - use logger instead
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
};
