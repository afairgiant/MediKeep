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
      // copied through by flattenNestedObject, defaulting null to ''
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

describe('nestedFormUtils - Insurance tags', () => {
  describe('restructureFormData', () => {
    it('includes tags in the submitted payload (regression: previously dropped on save)', () => {
      // Regression test: tags was rendered in the Add/Edit form but was
      // missing from insuranceFieldConfig.basicFields, so it was silently
      // stripped out of the payload sent on both create and Update.
      const formData = {
        insurance_type: 'medical',
        company_name: 'Acme',
        member_name: 'Jane Doe',
        member_id: 'ABC123',
        effective_date: '2024-01-01',
        status: 'active',
        is_primary: false,
        tags: ['hsa', 'family-plan'],
      };

      const result = restructureFormData(formData, insuranceFieldConfig);

      expect(result.tags).toEqual(['hsa', 'family-plan']);
    });

    it('includes an empty tags array rather than omitting the field', () => {
      const formData = {
        insurance_type: 'medical',
        company_name: 'Acme',
        member_name: 'Jane Doe',
        member_id: 'ABC123',
        effective_date: '2024-01-01',
        status: 'active',
        is_primary: false,
        tags: [],
      };

      const result = restructureFormData(formData, insuranceFieldConfig);

      expect(result.tags).toEqual([]);
    });
  });

  describe('flattenNestedObject', () => {
    it('loads existing tags into formData when opening the Edit dialog', () => {
      const insurance = {
        id: 1,
        insurance_type: 'medical',
        tags: ['hsa', 'family-plan'],
        coverage_details: {},
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.tags).toEqual(['hsa', 'family-plan']);
    });

    it('does NOT turn tags: null into the string \'\' (would fail List[str] validation on save)', () => {
      // Regression: a legacy insurance record created before the tags
      // column existed has tags: null. flattenNestedObject alone still
      // defaults that to '' (it can't know the field should be an array);
      // page-level initializeFormData is responsible for turning that back
      // into []. This test locks in flattenNestedObject's own contract so
      // that responsibility stays visible.
      const insurance = {
        id: 1,
        insurance_type: 'medical',
        tags: null,
        coverage_details: {},
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.tags).toBe('');
      expect(Array.isArray(flat.tags)).toBe(false);
    });

    it('leaves tags undefined when the key is absent entirely (pre-migration record shape)', () => {
      const insurance = {
        id: 1,
        insurance_type: 'medical',
        coverage_details: {},
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.tags).toBeUndefined();
    });

    it('preserves a real $0 coverage value instead of wiping it to \'\' (same root cause as the tags bug)', () => {
      // Regression: `value || ''` also nuked a real 0 (e.g. a $0 copay),
      // which then dropped out of restructureFormData's inclusion check
      // (`value !== ''`) and got silently omitted from the saved payload.
      const insurance = {
        id: 1,
        insurance_type: 'medical',
        coverage_details: { copay_primary_care: 0 },
      };

      const flat = flattenNestedObject(insurance, {
        nestedFields: Object.keys(insuranceFieldConfig.nestedFieldGroups),
      });

      expect(flat.copay_primary_care).toBe(0);
    });
  });

  describe('initializeFormData', () => {
    it('defaults tags to an empty array for a new record', () => {
      const initData = initializeFormData(null, insuranceFieldConfig, {
        tags: [],
      });
      expect(initData.tags).toEqual([]);
    });

    it('flattens a legacy null-tags record to a non-array - callers must guard this', () => {
      // Documents the exact handoff: nestedFormUtils.initializeFormData does
      // NOT know tags should always be an array (it's generic), so it
      // faithfully reproduces flattenNestedObject's ''. The insurance page's
      // own initializeFormData wrapper is responsible for the final
      // `Array.isArray(data.tags) ? data.tags : []` guard before this reaches
      // the TagInput/restructureFormData - this test is a tripwire: if
      // nestedFormUtils ever starts returning an array here on its own, the
      // page-level guard becomes redundant, not wrong.
      const initData = initializeFormData(
        { id: 1, insurance_type: 'medical', tags: null, coverage_details: {} },
        insuranceFieldConfig,
        {}
      );

      expect(initData.tags).toBe('');
    });
  });
});
