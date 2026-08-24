module.exports = {
  // All 13 locales present in public/locales. `el` and `th` were missing here
  // while their JSON files existed, so extract silently skipped them and every
  // new key had to be added to those two by hand or not at all.
  locales: [
    'en',
    'de',
    'el',
    'es',
    'fr',
    'it',
    'nl',
    'pl',
    'pt',
    'ru',
    'sv',
    'th',
    'zh',
  ],

  input: ['src/**/*.{js,jsx,ts,tsx}'],
  output: 'public/locales/$LOCALE/$NAMESPACE.json',

  defaultNamespace: 'common',
  namespaceSeparator: ':',
  keySeparator: '.',

  // Don't delete keys automatically - project has 52 dynamic key patterns
  // the parser can't detect. Removed keys get _old suffix for manual review.
  keepRemoved: true,

  sort: true,

  createOldCatalogs: false,

  lexers: {
    js: ['JsxLexer'],
    jsx: ['JsxLexer'],
    ts: ['JsxLexer'],
    tsx: ['JsxLexer'],
  },

  defaultValue: '',

  ignore: [
    'src/**/*.test.*',
    'src/**/*.spec.*',
    'src/test-utils/**',
    'src/testing/**',
    'src/__tests__/**',
  ],
};
