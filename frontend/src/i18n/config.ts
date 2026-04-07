import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isDevelopment } from '../config/env';

// Bundle English translations so the fallback language is always available synchronously.
// This eliminates the race condition where components render before HTTP-loaded translations
// arrive, which caused translation keys to flash in the UI.
import commonEn from '../../public/locales/en/common.json';
import medicalEn from '../../public/locales/en/medical.json';
import adminEn from '../../public/locales/en/admin.json';
import errorsEn from '../../public/locales/en/errors.json';
import navigationEn from '../../public/locales/en/navigation.json';
import notificationsEn from '../../public/locales/en/notifications.json';
import sharedEn from '../../public/locales/en/shared.json';
import authEn from '../../public/locales/en/auth.json';
import settingsEn from '../../public/locales/en/settings.json';
import reportsEn from '../../public/locales/en/reports.json';
import labresultsEn from '../../public/locales/en/labresults.json';
import vitalsEn from '../../public/locales/en/vitals.json';
import invitationsEn from '../../public/locales/en/invitations.json';
import documentsEn from '../../public/locales/en/documents.json';

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
    },
  });

export default i18n;
