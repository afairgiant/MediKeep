module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Disable console warnings in production builds
    'no-console': 'off',
    // Disable unused vars warnings in production builds
    'no-unused-vars': 'off',
    // Disable exhaustive deps warnings in production builds
    'react-hooks/exhaustive-deps': 'off',
  },
};
