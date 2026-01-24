/**
 * Shared configurations and utilities for medical form fields
 */

import { getTodayEndOfDay } from '../dateUtils';

// Tags field configuration used across all forms
export const tagsFieldConfig = {
  name: 'tags',
  type: 'custom',
  component: 'TagInput',
  label: 'Tags',
  placeholder: 'Add tags to organize and find this record',
  description: 'Add tags to help organize and search for this record later',
  gridColumn: 12,
  maxTags: 15,
  required: false,
};

// Re-export for convenience
export { getTodayEndOfDay };
