import { describe, test, expect } from 'vitest';
import {
  getFilteredInsuranceFields,
  getInsuranceFieldsBySection,
  INSURANCE_COVERAGE_PERIOD_FIELD_NAMES,
} from './insuranceFieldSections';

describe('getFilteredInsuranceFields', () => {
  test('with no insurance type, only shows universal fields (plus insurance_type itself)', () => {
    const fields = getFilteredInsuranceFields(undefined);

    expect(fields.some(f => f.name === 'insurance_type')).toBe(true);
    expect(fields.some(f => f.name === 'company_name')).toBe(true);
    // Type-specific fields must not leak through before a type is chosen
    expect(fields.some(f => f.name === 'bin_number')).toBe(false);
    expect(fields.some(f => f.name === 'deductible_individual')).toBe(false);
  });

  test('includes only fields relevant to the selected insurance type', () => {
    const prescriptionFields = getFilteredInsuranceFields('prescription');
    expect(prescriptionFields.some(f => f.name === 'bin_number')).toBe(true);
    expect(
      prescriptionFields.some(f => f.name === 'deductible_individual')
    ).toBe(false);

    const medicalFields = getFilteredInsuranceFields('medical');
    expect(medicalFields.some(f => f.name === 'deductible_individual')).toBe(
      true
    );
    expect(medicalFields.some(f => f.name === 'bin_number')).toBe(false);
  });

  test('marks requiredFor fields as required for that type only', () => {
    const prescriptionFields = getFilteredInsuranceFields('prescription');
    const binField = prescriptionFields.find(f => f.name === 'bin_number');
    expect(binField.required).toBe(true);

    // bin_number isn't shown at all for medical, so there's nothing to
    // mark required - the field itself must be absent.
    const medicalFields = getFilteredInsuranceFields('medical');
    expect(medicalFields.some(f => f.name === 'bin_number')).toBe(false);
  });
});

describe('getInsuranceFieldsBySection', () => {
  test('groups universal basic/member/coverage-period fields regardless of type', () => {
    const { basicFields, memberFields, coverageFields } =
      getInsuranceFieldsBySection('medical');

    expect(basicFields.map(f => f.name)).toEqual(
      expect.arrayContaining([
        'insurance_type',
        'company_name',
        'plan_name',
        'employer_group',
        'group_number',
      ])
    );
    expect(memberFields.map(f => f.name)).toEqual(
      expect.arrayContaining([
        'member_name',
        'member_id',
        'policy_holder_name',
        'relationship_to_holder',
      ])
    );
    expect(memberFields.some(f => f.name === 'group_number')).toBe(false);
    expect(coverageFields.map(f => f.name)).toEqual(
      expect.arrayContaining(INSURANCE_COVERAGE_PERIOD_FIELD_NAMES)
    );
  });

  test('places the type-specific Primary Care Physician field in the coverage section, not member', () => {
    const { memberFields, coverageFields } =
      getInsuranceFieldsBySection('medical');

    expect(coverageFields.some(f => f.name === 'practitioner_id')).toBe(true);
    expect(memberFields.some(f => f.name === 'practitioner_id')).toBe(false);
  });

  test('places pharmacy_network_info in the contact section, not coverage, for prescription plans', () => {
    const { coverageFields, contactFields } =
      getInsuranceFieldsBySection('prescription');

    expect(contactFields.some(f => f.name === 'pharmacy_network_info')).toBe(
      true
    );
    expect(
      coverageFields.some(f => f.name === 'pharmacy_network_info')
    ).toBe(false);
  });

  test('only includes contact fields that apply to the selected type', () => {
    const prescriptionContact = getInsuranceFieldsBySection(
      'prescription'
    ).contactFields.map(f => f.name);
    expect(prescriptionContact).toContain('customer_service_phone');
    expect(prescriptionContact).not.toContain('preauth_phone');
    expect(prescriptionContact).not.toContain('claims_address');

    const medicalContact =
      getInsuranceFieldsBySection('medical').contactFields.map(f => f.name);
    expect(medicalContact).toContain('preauth_phone');
    expect(medicalContact).toContain('claims_address');
    expect(medicalContact).not.toContain('pharmacy_network_info');
  });

  test('groups notes and tags into the notes section', () => {
    const { notesField } = getInsuranceFieldsBySection('medical');
    expect(notesField.map(f => f.name)).toEqual(
      expect.arrayContaining(['notes', 'tags'])
    );
  });
});
