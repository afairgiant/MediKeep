/**
 * Lightweight form field translation utility.
 *
 * Resolves `labelKey`, `placeholderKey`, and `descriptionKey` properties
 * on form field config objects using the provided i18next `t()` function.
 * Also resolves `labelKey` on option items.
 *
 * Replaces the former formFieldTranslations.js bridge file.
 */

/**
 * Translate a form field config object by resolving *Key properties.
 *
 * @param {Object} fieldConfig - Field config with labelKey, placeholderKey, descriptionKey
 * @param {Function} t - i18next t() function (with namespace support)
 * @returns {Object} - Field config with resolved label, placeholder, description
 */
export const translateField = (fieldConfig, t) => {
  const translated = { ...fieldConfig };

  if (translated.labelKey) {
    translated.label = t(translated.labelKey);
  }
  if (translated.placeholderKey) {
    translated.placeholder = t(translated.placeholderKey);
  }
  if (translated.descriptionKey) {
    translated.description = t(translated.descriptionKey);
  }

  // Translate option labels
  if (translated.options && Array.isArray(translated.options)) {
    translated.options = translated.options.map((option) => {
      if (option.labelKey) {
        return { ...option, label: t(option.labelKey) };
      }
      return option;
    });
  }

  return translated;
};
