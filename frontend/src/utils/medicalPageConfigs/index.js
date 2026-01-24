/**
 * Medical Page Configs - Modular Configuration System
 *
 * This module provides standardized configuration templates for medical pages
 * filtering and sorting. Each entity has its own configuration file for better
 * maintainability and tree-shaking.
 *
 * Re-exports everything for backward compatibility with existing imports.
 */

// Shared utilities and constants
export { SEARCH_TERM_MAX_LENGTH, logger } from './shared.js';

// Individual page configs
export { conditionsPageConfig } from './conditions.js';
export { insurancesPageConfig } from './insurance.js';
export { medicationsPageConfig } from './medications.js';
export { proceduresPageConfig } from './procedures.js';
export { treatmentsPageConfig } from './treatments.js';
export { visitsPageConfig } from './visits.js';
export { immunizationsPageConfig } from './immunizations.js';
export { allergiesPageConfig } from './allergies.js';
export { symptomsPageConfig } from './symptoms.js';
export { practitionersPageConfig } from './practitioners.js';
export { pharmaciesPageConfig } from './pharmacies.js';
export { labresultsPageConfig } from './labResults.js';
export { vitalsPageConfig } from './vitals.js';
export { emergencyContactsPageConfig } from './emergencyContacts.js';
export { familyMembersPageConfig } from './familyMembers.js';

// Combined config object and accessor function
export { medicalPageConfigs, getMedicalPageConfig } from './getMedicalPageConfig.js';
