/**
 * Medical Form Fields Module
 *
 * This module exports field configurations for all medical forms.
 * Re-exports everything for backward compatibility with existing imports.
 */

// Shared utilities
export { tagsFieldConfig } from './shared';

// Form field configurations
export { allergyFormFields } from './allergy';
export { conditionFormFields } from './condition';
export { medicationFormFields } from './medication';
export { labResultFormFields } from './labResult';
export { immunizationFormFields } from './immunization';
export { procedureFormFields } from './procedure';
export { practitionerFormFields } from './practitioner';
export { emergencyContactFormFields } from './emergencyContact';
export { visitFormFields } from './visit';
export { pharmacyFormFields } from './pharmacy';
export { treatmentFormFields } from './treatment';
export { familyMemberFormFields } from './familyMember';
export { familyConditionFormFields } from './familyCondition';
export { insuranceFormFields } from './insurance';
export { symptomParentFormFields } from './symptomParent';
export { symptomOccurrenceFormFields } from './symptomOccurrence';

// Utility function
export { getFormFields } from './getFormFields';
