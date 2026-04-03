/**
 * Shared configurations and utilities for medical form fields
 */

import { getTodayEndOfDay } from '../dateUtils';

// Tags field configuration used across all forms
export const tagsFieldConfig = {
  name: 'tags',
  type: 'custom',
  component: 'TagInput',
  labelKey: 'shared:labels.tags',
  placeholderKey: 'common:fields.tags.placeholder',
  descriptionKey: 'common:fields.tags.description',
  gridColumn: 12,
  maxTags: 15,
  required: false,
};

// Re-export for convenience
export { getTodayEndOfDay };
