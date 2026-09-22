/**
 * Shared insurance field grouping logic, used by both the Add/Edit form
 * (InsuranceFormWrapper) and the read-only view (InsuranceViewModal) so the
 * two stay structurally identical - same tabs, same fields per tab.
 */

import { getFormFields } from './medicalFormFields';

const CONTACT_FIELD_NAMES = [
  'customer_service_phone',
  'preauth_phone',
  'provider_services_phone',
  'website_url',
  'claims_address',
  'pharmacy_network_info',
];

const BASIC_FIELD_NAMES = [
  'insurance_type',
  'company_name',
  'plan_name',
  'employer_group',
  'group_number',
];

const MEMBER_FIELD_NAMES = [
  'member_name',
  'member_id',
  'policy_holder_name',
  'relationship_to_holder',
];

export const INSURANCE_COVERAGE_PERIOD_FIELD_NAMES = [
  'effective_date',
  'expiration_date',
  'status',
  'is_primary',
];

/**
 * Filters the full insurance field list down to the fields relevant for the
 * given insurance type, applying conditional `required` overrides.
 */
export const getFilteredInsuranceFields = insuranceType => {
  const fields = getFormFields('insurance');

  if (!insuranceType) {
    return fields.filter(field => !field.showFor || field.name === 'insurance_type');
  }

  return fields
    .filter(field => !field.showFor || field.showFor.includes(insuranceType))
    .map(field => {
      if (field.requiredFor && field.requiredFor.includes(insuranceType)) {
        return { ...field, required: true };
      }
      return field;
    });
};

/**
 * Groups the filtered insurance fields into the same sections/tabs used by
 * both the form and the view modal: basic, member, coverage, contact, notes.
 */
export const getInsuranceFieldsBySection = insuranceType => {
  const filteredFields = getFilteredInsuranceFields(insuranceType);

  const basicFields = filteredFields.filter(
    f => !f.type || f.type === 'divider' || BASIC_FIELD_NAMES.includes(f.name)
  );

  const memberFields = filteredFields.filter(f =>
    MEMBER_FIELD_NAMES.includes(f.name)
  );

  const coverageFields = filteredFields.filter(
    f =>
      INSURANCE_COVERAGE_PERIOD_FIELD_NAMES.includes(f.name) ||
      (f.showFor && !CONTACT_FIELD_NAMES.includes(f.name))
  );

  const contactFields = filteredFields.filter(f =>
    CONTACT_FIELD_NAMES.includes(f.name)
  );

  const notesField = filteredFields.filter(
    f => f.name === 'notes' || f.name === 'tags'
  );

  return {
    basicFields,
    memberFields,
    coverageFields,
    contactFields,
    notesField,
  };
};
