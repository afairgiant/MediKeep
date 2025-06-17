module.exports = {
  extends: ['react-app', 'react-app/jest', 'prettier'],
  rules: {
    // Add custom rules here
    'no-unused-vars': 'warn',
    'no-console': 'warn',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
};
