import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isDevelopment } from '../config/env';

// Bundle English translations so the fallback language is always available synchronously.
// This eliminates the race condition where components render before HTTP-loaded translations
// arrive, which caused translation keys to flash in the UI.
// The JSONs live in public/locales/en so the HTTP backend can serve other languages from
// the same tree; the `virtual:bundled-en-locales` module (see vite.config.ts) reads them
// at build time so they can be bundled without violating Vite's public/ import rule.
// @ts-expect-error - virtual module provided by Vite plugin
import bundledEn from 'virtual:bundled-en-locales';

const {
  common: commonEn,
  medical: medicalEn,
  admin: adminEn,
  errors: errorsEn,
  navigation: navigationEn,
  notifications: notificationsEn,
  shared: sharedEn,
  auth: authEn,
  settings: settingsEn,
  reports: reportsEn,
  labresults: labresultsEn,
  vitals: vitalsEn,
  invitations: invitationsEn,
  documents: documentsEn,
} = bundledEn as Record<string, Record<string, unknown>>;

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

    // English is bundled inline (see imports above); other languages load via HTTP backend.
    partialBundledLanguages: true,
    resources: {
      en: {
        common: commonEn,
        medical: medicalEn,
        admin: adminEn,
        errors: errorsEn,
        navigation: navigationEn,
        notifications: notificationsEn,
        shared: sharedEn,
        auth: authEn,
        settings: settingsEn,
        reports: reportsEn,
        labresults: labresultsEn,
        vitals: vitalsEn,
        invitations: invitationsEn,
        documents: documentsEn,
      },
    },

    ns: ['common', 'medical', 'errors', 'navigation', 'notifications', 'admin', 'shared', 'auth', 'settings', 'reports', 'labresults', 'vitals', 'invitations', 'documents'],
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
      // Re-render components when translations are added to the store.
      // The default ('') means components never update after late-arriving translations,
      // causing keys to persist in the UI until page reload.
      bindI18nStore: 'added removed',
      // Include 'languageChanging' so Suspense activates the moment a language switch starts.
      // This makes hasLoadedNamespace's precheck return false during an in-flight change,
      // guaranteeing the UI suspends until the new language's resources are loaded. Without
      // this, transitioning from a fully-loaded language (e.g. bundled English) to an
      // HTTP-loaded language could leave components silently rendering the old language.
      bindI18n: 'languageChanging languageChanged',
    },
  });

export default i18n;
