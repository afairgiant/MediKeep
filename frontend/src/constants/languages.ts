/**
 * Shared language configuration for the UI language switcher and preference sync.
 * Keep in sync with SUPPORTED_LANGUAGES in app/schemas/user_preferences.py, which
 * validates the API, and in app/services/report_translations.py, which renders PDFs.
 */

export interface Language {
  value: string;
  label: string;
  shortLabel: string;
}

export const LANGUAGES: readonly Language[] = [
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'de', label: 'Deutsch', shortLabel: 'DE' },
  { value: 'es', label: 'Español', shortLabel: 'ES' },
  { value: 'it', label: 'Italiano', shortLabel: 'IT' },
  { value: 'pt', label: 'Português', shortLabel: 'PT' },
  { value: 'ru', label: 'Русский', shortLabel: 'RU' },
  { value: 'sv', label: 'Svenska', shortLabel: 'SV' },
  { value: 'nl', label: 'Nederlands', shortLabel: 'NL' },
  { value: 'pl', label: 'Polski', shortLabel: 'PL' },
  { value: 'zh', label: '中文', shortLabel: 'ZH' },
  { value: 'el', label: 'Ελληνικά', shortLabel: 'EL' },
];

export const SUPPORTED_LANGUAGE_CODES: readonly string[] = LANGUAGES.map(
  l => l.value
);

export const DEFAULT_LANGUAGE = 'en';

/** Reduces a locale code to its primary subtag, e.g. 'de-AT' to 'de'. */
export const extractPrimaryLanguage = (lang: string): string =>
  (lang || DEFAULT_LANGUAGE).split('-')[0].toLowerCase();

/**
 * Reduces a locale code to a supported language code.
 *
 * Falls back to DEFAULT_LANGUAGE for empty or unsupported input, so callers that
 * need to tell "unsupported" apart from "English" must compare the raw code too.
 */
export const normalizeLanguage = (lang: string): string => {
  const primaryLang = extractPrimaryLanguage(lang);

  return SUPPORTED_LANGUAGE_CODES.includes(primaryLang)
    ? primaryLang
    : DEFAULT_LANGUAGE;
};
