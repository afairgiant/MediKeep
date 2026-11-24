import i18n from '../i18n/config';

/**
 * Translated messages for the page form checks (the validate*Form functions in
 * utils/, and the checks in the record pages). The message a check returns is
 * shown to the user in the form's popup, so it must be translated: return one
 * of these, or another t() call, never a hardcoded string.
 *
 * Field names come from the label keys the forms already use, so the message
 * names the field the way the form shows it.
 */

const label = (labelKey: string, defaultLabel: string) =>
  i18n.t(labelKey, defaultLabel);

/** "Injury Name is required." */
export const requiredMessage = (labelKey: string, defaultLabel: string) =>
  i18n.t('shared:formValidation.required', '{{field}} is required.', {
    field: label(labelKey, defaultLabel),
  });

/** "Medication Name: Use at least 2 characters." */
export const tooShortMessage = (
  labelKey: string,
  defaultLabel: string,
  min: number
) =>
  i18n.t('shared:formValidation.invalid', '{{field}}: {{reason}}', {
    field: label(labelKey, defaultLabel),
    reason: i18n.t('errors:form.tooShort', 'Use at least {{min}} characters.', {
      min,
    }),
  });

export const requiredFieldsMissingMessage = () =>
  i18n.t(
    'errors:form.requiredFieldMissing',
    'Please fill in all required fields.'
  );

export const invalidDateMessage = () =>
  i18n.t('errors:form.invalidDate', 'Please enter a valid date.');

export const patientNotAvailableMessage = () =>
  i18n.t('errors:patientNotAvailable', 'Patient information not available');

export const patientNotSelectedMessage = () =>
  i18n.t('errors:form.patientNotSelected', 'Please select a patient.');

export const endBeforeStartMessage = () =>
  i18n.t('errors:form.endBeforeStart', 'End date cannot be before start date');

/** "Onset Date (2027-01-01) cannot be in the future. Please select ... (2026-11-24)." */
export const dateInFutureMessage = (
  labelKey: string,
  defaultLabel: string,
  date: string,
  today: string
) =>
  i18n.t(
    'errors:form.dateInFuture',
    '{{field}} ({{date}}) cannot be in the future. Please select a date on or before today ({{today}}).',
    { field: label(labelKey, defaultLabel), date, today }
  );

export const endBeforeOnsetMessage = () =>
  i18n.t('errors:form.endBeforeOnset', 'End date cannot be before onset date');
