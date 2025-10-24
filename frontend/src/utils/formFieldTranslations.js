/**
 * Form Field Translation Helper
 *
 * Maps hardcoded field configuration strings to translation keys
 * This allows BaseMedicalForm to automatically translate labels, placeholders, and descriptions
 * without modifying the medicalFormFields.js file immediately
 */

/**
 * Check if a string is a translation key (format: "namespace:key.path")
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a translation key
 */
export const isTranslationKey = (str) => {
  if (!str || typeof str !== 'string') return false;
  // Translation keys follow pattern: "namespace:category.subcategory.field"
  return str.includes(':') && str.split(':').length === 2;
};

/**
 * Map hardcoded strings to translation keys for common fields
 * This mapping allows us to translate existing forms without changing medicalFormFields.js
 */
const fieldTranslationMap = {
  // Common labels (NO namespace prefix - we're using medical namespace)
  'Tags': 'common.labels.tags',
  'Notes': 'common.labels.notes',
  'Status': 'common.labels.status',
  'Severity': 'common.labels.severity',
  'Onset Date': 'common.labels.onsetDate',
  'End Date': 'common.labels.endDate',

  // Allergy form
  'Allergen': 'allergies.allergen.label',
  'Reaction': 'allergies.reaction.label',
  'Related Medication (Optional)': 'allergies.relatedMedication.label',

  // Placeholders
  'Add tags to organize and find this record': 'common.fields.tags.placeholder',
  'Additional information about this allergy...': 'common.fields.notes.placeholder',
  'e.g., Penicillin, Peanuts, Latex': 'allergies.allergen.placeholder',
  'e.g., Rash, Anaphylaxis, Swelling': 'allergies.reaction.placeholder',
  'Select severity level': 'allergies.severity.placeholder',
  'When did this allergy first occur': 'allergies.onsetDate.placeholder',
  'Select a medication this allergy is related to': 'allergies.relatedMedication.placeholder',

  // Descriptions
  'Add tags to help organize and search for this record later': 'common.fields.tags.description',
  'Any additional details, triggers, or treatment notes': 'common.fields.notes.description',
  'What substance causes the allergic reaction': 'allergies.allergen.description',
  'How severe is this allergy': 'allergies.severity.description',
  'What happens when exposed to this allergen': 'allergies.reaction.description',
  'When this allergy was first discovered': 'allergies.onsetDate.description',
  'Link this allergy to a specific medication if applicable': 'allergies.relatedMedication.description',
  'Current status of this allergy': 'allergies.status.description',

  // Status options
  'Active - Currently allergic': 'common.status.active',
  'Inactive - No longer allergic': 'common.status.inactive',
  'Resolved - Outgrown the allergy': 'common.status.resolved',

  // Severity options (these have emojis in source, map to translation keys)
  '💛 Mild - Minor discomfort': 'common.severity.mild',
  '⚡ Moderate - Noticeable symptoms': 'common.severity.moderate',
  '⚠️ Severe - Significant reaction': 'common.severity.severe',
  '🚨 Life-threatening - Anaphylaxis risk': 'common.severity.lifeThreatening',
};

/**
 * Get translation key for a hardcoded string
 * @param {string} text - The hardcoded text
 * @returns {string|null} - Translation key or null if no mapping exists
 */
export const getTranslationKey = (text) => {
  if (!text) return null;

  // Already a translation key
  if (isTranslationKey(text)) {
    return text;
  }

  // Look up in mapping
  return fieldTranslationMap[text] || null;
};

/**
 * Translate a field configuration property (label, placeholder, description)
 * @param {string} text - The text to translate
 * @param {Function} t - The translation function from useTranslation
 * @returns {string} - Translated text or original if no translation found
 */
export const translateFieldProperty = (text, t) => {
  if (!text) return text;

  // If it's already a translation key, use it directly
  if (isTranslationKey(text)) {
    const translated = t(text);
    console.log('[Translation] Key:', text, '→', translated);
    return translated;
  }

  // Try to find a translation key
  const translationKey = getTranslationKey(text);
  if (translationKey) {
    const translated = t(translationKey);
    console.log('[Translation] Mapped:', text, '→', translationKey, '→', translated);
    return translated;
  }

  // No translation found, return original
  console.log('[Translation] No mapping for:', text);
  return text;
};

/**
 * Translate an entire field configuration object
 * @param {Object} fieldConfig - The field configuration
 * @param {Function} t - The translation function from useTranslation
 * @returns {Object} - Field configuration with translated properties
 */
export const translateFieldConfig = (fieldConfig, t) => {
  const translated = { ...fieldConfig };

  // Translate label
  if (translated.label) {
    translated.label = translateFieldProperty(translated.label, t);
  }

  // Translate placeholder
  if (translated.placeholder) {
    translated.placeholder = translateFieldProperty(translated.placeholder, t);
  }

  // Translate description
  if (translated.description) {
    translated.description = translateFieldProperty(translated.description, t);
  }

  // Translate options if present
  if (translated.options && Array.isArray(translated.options)) {
    translated.options = translated.options.map(option => ({
      ...option,
      label: translateFieldProperty(option.label, t),
    }));
  }

  return translated;
};
