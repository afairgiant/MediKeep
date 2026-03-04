import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isDevelopment } from '../config/env';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: isDevelopment(),

    // Only load the primary language code (e.g., 'en' not 'en-US')
    // This ensures i18n.language always matches our supported language codes
    load: 'languageOnly',

    ns: ['common', 'medical', 'errors', 'navigation', 'notifications', 'admin'],
    defaultNS: 'common',

    // Return key if translation is missing in development, fallback to English in production
    saveMissing: false,
    missingKeyHandler: (lngs, ns, key) => {
      if (isDevelopment()) {
        console.warn(`Missing translation key: ${ns}:${key} for language: ${lngs[0]}`);
      }
    },

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
