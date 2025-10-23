module.exports = {
  displayName: 'Responsive Tests',
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/__tests__/responsive/**/*.test.js',
    '<rootDir>/src/__tests__/responsive/**/*.test.jsx'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/responsive/setup.js'
  ],

  // Module paths and aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^services/(.*)$': '<rootDir>/src/services/$1',
    '^utils/(.*)$': '<rootDir>/src/utils/$1',
    '^strategies/(.*)$': '<rootDir>/src/strategies/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/components/adapters/**/*.{js,jsx}',
    'src/components/medical/**/*.{js,jsx}',
    'src/hooks/useResponsive.js',
    'src/strategies/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/components/adapters/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Test timeout for async operations
  testTimeout: 10000,

  // Globals for performance testing
  globals: {
    'performance': true
  },

  // Mock configuration
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/'
  ],

  // Performance and memory settings
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',

  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-reports/responsive',
      outputName: 'junit.xml',
      suiteName: 'Responsive Component Tests'
    }]
  ],

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Error handling
  errorOnDeprecated: true,
  
  // Snapshot configuration
  snapshotSerializers: [
    '@emotion/jest/serializer'
  ]
};