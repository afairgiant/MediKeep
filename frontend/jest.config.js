const { createJestConfig } = require('./node_modules/react-scripts/scripts/utils/createJestConfig');

const reactScriptsJestConfig = createJestConfig(
  filePath => require.resolve(`react-scripts/${filePath}`),
  process.cwd(),
  false
);

module.exports = {
  ...reactScriptsJestConfig,
  // Override with custom configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js',
    '<rootDir>/src/test-utils/setupTestsAfterEnv.js'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  moduleNameMapping: {
    ...reactScriptsJestConfig.moduleNameMapping,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js',
    '!src/test-utils/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 10000,
  // Add custom test environments for different scenarios
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/*.integration.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom'
    }
  ]
};