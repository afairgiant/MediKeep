import {
  flattenNestedObject,
  restructureFormData,
  initializeFormData,
  insuranceFieldConfig,
} from './nestedFormUtils';

describe('nestedFormUtils - Insurance PCP practitioner linking', () => {
  describe('flattenNestedObject', () => {
    it('flattens a legacy free-text primary_care_physician value from coverage_details', () => {
      const insurance = {
        id: 1,
        insurance_type: 'medical',
        practitioner_id: null,
        coverage_details: { primary_care_physician: 'Dr. Legacy' },
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.primary_care_physician).toBe('Dr. Legacy');
      // practitioner_id is a real top-level column, not nested, so it is
      // copied through by flattenNestedObject's `item[key] || ''` fallback
      // (page-level code is responsible for stringifying a real id).
      expect(flat.practitioner_id).toBe('');
    });

    it('copies a linked practitioner_id through untouched', () => {
      const insurance = {
        id: 2,
        insurance_type: 'medical',
        practitioner_id: 42,
        coverage_details: {},
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.practitioner_id).toBe(42);
      // No legacy value was ever recorded in coverage_details, so nothing
      // to flatten for this key (never defaults to '' when the key is absent).
      expect(flat.primary_care_physician).toBeUndefined();
    });
  });

  describe('restructureFormData', () => {
    it('does not wipe a legacy primary_care_physician string when only practitioner_id changes', () => {
      // Regression test: previously, removing the free-text PCP input from the
      // form would risk dropping this value on save if it were also removed
      // from the nested field group. It must stay in insuranceFieldConfig so
      // it keeps round-tripping through formData untouched.
      const formData = {
        insurance_type: 'medical',
        company_name: 'Acme',
        member_name: 'Jane Doe',
        member_id: 'ABC123',
        effective_date: '2024-01-01',
        status: 'active',
        is_primary: false,
        practitioner_id: '42',
        primary_care_physician: 'Dr. Legacy',
      };

      const result = restructureFormData(formData, insuranceFieldConfig);

      expect(result.practitioner_id).toBe('42');
      expect(result.coverage_details.primary_care_physician).toBe('Dr. Legacy');
    });

    it('omits primary_care_physician from coverage_details when never set', () => {
      const formData = {
        insurance_type: 'medical',
        company_name: 'Acme',
        member_name: 'Jane Doe',
        member_id: 'ABC123',
        effective_date: '2024-01-01',
        status: 'active',
        is_primary: false,
        practitioner_id: '42',
        primary_care_physician: '',
      };

      const result = restructureFormData(formData, insuranceFieldConfig);

      expect(result.coverage_details.primary_care_physician).toBeUndefined();
    });
  });

  describe('initializeFormData', () => {
    it('defaults practitioner_id to empty string for a new record', () => {
      const initData = initializeFormData(null, insuranceFieldConfig, {});
      expect(initData.practitioner_id).toBe('');
    });
  });
});
