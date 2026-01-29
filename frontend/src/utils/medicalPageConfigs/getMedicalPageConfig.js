/**
 * Combined medical page configurations and accessor function
 */

import { conditionsPageConfig } from './conditions.js';
import { insurancesPageConfig } from './insurance.js';
import { medicationsPageConfig } from './medications.js';
import { proceduresPageConfig } from './procedures.js';
import { treatmentsPageConfig } from './treatments.js';
import { visitsPageConfig } from './visits.js';
import { immunizationsPageConfig } from './immunizations.js';
import { allergiesPageConfig } from './allergies.js';
import { symptomsPageConfig } from './symptoms.js';
import { practitionersPageConfig } from './practitioners.js';
import { pharmaciesPageConfig } from './pharmacies.js';
import { labresultsPageConfig } from './labResults.js';
import { vitalsPageConfig } from './vitals.js';
import { emergencyContactsPageConfig } from './emergencyContacts.js';
import { familyMembersPageConfig } from './familyMembers.js';
import { injuriesPageConfig } from './injuries.js';

/**
 * Standardized configuration templates for medical pages filtering and sorting
 */
export const medicalPageConfigs = {
  conditions: conditionsPageConfig,
  insurances: insurancesPageConfig,
  medications: medicationsPageConfig,
  procedures: proceduresPageConfig,
  treatments: treatmentsPageConfig,
  visits: visitsPageConfig,
  immunizations: immunizationsPageConfig,
  allergies: allergiesPageConfig,
  symptoms: symptomsPageConfig,
  practitioners: practitionersPageConfig,
  pharmacies: pharmaciesPageConfig,
  labresults: labresultsPageConfig,
  vitals: vitalsPageConfig,
  emergency_contacts: emergencyContactsPageConfig,
  family_members: familyMembersPageConfig,
  injuries: injuriesPageConfig,
};

/**
 * Default page config for fallback
 */
const defaultPageConfig = {
  filtering: {
    searchFields: ['name'],
    statusField: 'status',
  },
  sorting: {
    defaultSortBy: 'name',
    defaultSortOrder: 'asc',
    sortOptions: [{ value: 'name', label: 'Name' }],
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.generic',
    title: 'Filters',
  },
};

/**
 * Get configuration for a specific medical page
 * @param {string} pageName - Name of the medical page
 * @returns {Object} Configuration object
 */
export function getMedicalPageConfig(pageName) {
  return medicalPageConfigs[pageName] || defaultPageConfig;
}
