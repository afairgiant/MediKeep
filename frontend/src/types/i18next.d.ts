import 'i18next';

import common from '../../public/locales/en/common.json';
import medical from '../../public/locales/en/medical.json';
import admin from '../../public/locales/en/admin.json';
import errors from '../../public/locales/en/errors.json';
import navigation from '../../public/locales/en/navigation.json';
import notifications from '../../public/locales/en/notifications.json';
import reportPdf from '../../public/locales/en/reportPdf.json';
import shared from '../../public/locales/en/shared.json';
import auth from '../../public/locales/en/auth.json';
import settings from '../../public/locales/en/settings.json';
import reports from '../../public/locales/en/reports.json';
import labresults from '../../public/locales/en/labresults.json';
import vitals from '../../public/locales/en/vitals.json';
import invitations from '../../public/locales/en/invitations.json';
import documents from '../../public/locales/en/documents.json';

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
      shared: typeof shared;
      auth: typeof auth;
      settings: typeof settings;
      reports: typeof reports;
      labresults: typeof labresults;
      vitals: typeof vitals;
      invitations: typeof invitations;
      documents: typeof documents;
    };
  }
}
