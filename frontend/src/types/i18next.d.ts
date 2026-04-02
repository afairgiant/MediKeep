import 'i18next';

import common from '../../public/locales/en/common.json';
import medical from '../../public/locales/en/medical.json';
import admin from '../../public/locales/en/admin.json';
import errors from '../../public/locales/en/errors.json';
import navigation from '../../public/locales/en/navigation.json';
import notifications from '../../public/locales/en/notifications.json';
import reportPdf from '../../public/locales/en/reportPdf.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      medical: typeof medical;
      admin: typeof admin;
      errors: typeof errors;
      navigation: typeof navigation;
      notifications: typeof notifications;
      reportPdf: typeof reportPdf;
    };
  }
}
