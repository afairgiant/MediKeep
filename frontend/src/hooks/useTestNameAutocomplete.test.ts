import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getMatchedNameAlias,
  getNameOptions,
  useTestNameAutocomplete,
} from './useTestNameAutocomplete';
import { PANEL_LIBRARY, getPanelAutocompleteOptions } from '../constants/panelLibrary';
import { getAutocompleteOptions } from '../constants/testLibrary';
import type { ComponentRowData } from '../utils/labTestComponentUtils';
import type { InlineTestComponentMethods } from '../components/medical/labresults/InlineTestComponentEntry';

function setup(testName = '') {
  const setComponents = vi.fn();
  const onFieldsChange = vi.fn();
  const inline = {
    getComponents: () => [] as ComponentRowData[],
    setComponents,
  } as unknown as InlineTestComponentMethods;

  const { result } = renderHook(() =>
    useTestNameAutocomplete({
      testName,
      getInlineMethods: () => inline,
      onFieldsChange,
    })
  );

  const submit = (option: string) =>
    act(() => {
      result.current.handleOptionSubmit(option);
    });
  const submittedRows = (): ComponentRowData[] =>
    setComponents.mock.calls[setComponents.mock.calls.length - 1][0];

  return { result, submit, submittedRows, onFieldsChange };
}

describe('useTestNameAutocomplete', () => {
  describe('options with nothing typed', () => {
    it.each([
      'Biopsy',
      'Skin Biopsy',
      'Bone Marrow Biopsy',
      'Pathology Report',
      'Cytology',
      'Immunohistochemistry',
      'Molecular Pathology',
      'Flow Cytometry',
      'Cytogenetics',
    ])(
      'list %s alongside the other panels',
      name => {
        const { result } = setup('');
        expect(result.current.nameOptions.some(o => o.startsWith(name))).toBe(true);
      }
    );

    it('still list the imaging entries', () => {
      const { result } = setup('');
      expect(result.current.nameOptions).toEqual(
        expect.arrayContaining(['MRI', 'X-Ray'])
      );
    });
  });

  describe('options when typing', () => {
    it('find the biopsy entries by "biopsy"', () => {
      const { result } = setup('biopsy');
      expect(result.current.nameOptions).toEqual(
        expect.arrayContaining(['Biopsy', 'Skin Biopsy', 'Bone Marrow Biopsy (BMB)'])
      );
    });

    it('find the pathology report by "pathology"', () => {
      const { result } = setup('pathology');
      expect(result.current.nameOptions).toContain('Pathology Report');
    });
  });

  describe('options for a test that shares an alias with a panel', () => {
    it('list the panel and then the test for "a1c"', () => {
      const { result } = setup('a1c');
      expect(result.current.nameOptions).toEqual([
        'Diabetes Monitoring Panel (DM Panel)',
        'Hemoglobin A1c (HbA1c)',
      ]);
    });

    it('fill the test row and its category when the A1c test is picked', () => {
      const { submit, submittedRows, onFieldsChange } = setup('a1c');
      submit('Hemoglobin A1c (HbA1c)');

      expect(onFieldsChange).toHaveBeenCalledWith(
        expect.objectContaining({ test_name: 'Hemoglobin A1c' })
      );
      expect(submittedRows()).toHaveLength(1);
      expect(submittedRows()[0]).toMatchObject({
        test_name: 'Hemoglobin A1c',
        canonical_test_name: 'Hemoglobin A1c',
        result_type: 'quantitative',
      });
    });

    it('list the pap smear entry once, as the cytology panel', () => {
      const { result } = setup('pap smear');
      expect(result.current.nameOptions).toEqual(['Cytology']);
    });

    it('still pick the panel row when the shared label is chosen', () => {
      const { submit, submittedRows, onFieldsChange } = setup('pap smear');
      submit('Cytology');

      expect(onFieldsChange).toHaveBeenCalledWith({
        test_name: 'Cytology',
        test_category: 'pathology',
      });
      expect(submittedRows()[0]).toMatchObject({
        test_name: 'Cytology',
        result_type: 'qualitative',
      });
    });
  });

  describe('picking a pathology entry', () => {
    it('fills the pathology category and a qualitative, library-linked row for Skin Biopsy', () => {
      const { submit, submittedRows, onFieldsChange } = setup();
      submit('Skin Biopsy');

      expect(onFieldsChange).toHaveBeenCalledWith({
        test_name: 'Skin Biopsy',
        test_category: 'pathology',
      });
      expect(submittedRows()).toHaveLength(1);
      expect(submittedRows()[0]).toMatchObject({
        test_name: 'Skin Biopsy',
        canonical_test_name: 'Skin Biopsy',
        category: 'pathology',
        result_type: 'qualitative',
        unit: '',
      });
    });

    it('keeps the abbreviation of Bone Marrow Biopsy', () => {
      const { submit, submittedRows, onFieldsChange } = setup();
      submit('Bone Marrow Biopsy (BMB)');

      expect(onFieldsChange).toHaveBeenCalledWith({
        test_name: 'Bone Marrow Biopsy',
        test_category: 'pathology',
      });
      expect(submittedRows()[0]).toMatchObject({
        abbreviation: 'BMB',
        result_type: 'qualitative',
      });
    });

    it('leaves the pathology report without a library link', () => {
      const { submit, submittedRows } = setup();
      submit('Pathology Report');

      expect(submittedRows()[0]).toMatchObject({
        test_name: 'Pathology Report',
        canonical_test_name: null,
        category: 'pathology',
        result_type: 'qualitative',
      });
    });
  });

  describe('picking a cytology, IHC, molecular, flow or cytogenetics entry', () => {
    it.each([
      ['Cytology', 'qualitative'],
      ['Flow Cytometry', 'textual'],
      ['Cytogenetics', 'textual'],
      ['Molecular Pathology', 'qualitative'],
    ])('fills the pathology category and a %s row for %s', (name, resultType) => {
      const { submit, submittedRows, onFieldsChange } = setup();
      submit(name);

      expect(onFieldsChange).toHaveBeenCalledWith({
        test_name: name,
        test_category: 'pathology',
      });
      expect(submittedRows()[0]).toMatchObject({
        test_name: name,
        canonical_test_name: name,
        category: 'pathology',
        result_type: resultType,
      });
    });

    it('keeps the IHC abbreviation on Immunohistochemistry', () => {
      const { submit, submittedRows } = setup();
      submit('Immunohistochemistry (IHC)');

      expect(submittedRows()[0]).toMatchObject({
        test_name: 'Immunohistochemistry',
        abbreviation: 'IHC',
        result_type: 'qualitative',
      });
    });

    it('finds Cytology by typing "pap"', () => {
      const { result } = setup('pap');
      expect(result.current.nameOptions).toContain('Cytology');
    });
  });

  describe('picking an imaging entry', () => {
    it('fills the imaging category and a qualitative row for MRI', () => {
      const { submit, submittedRows, onFieldsChange } = setup();
      submit('MRI');

      expect(onFieldsChange).toHaveBeenCalledWith({
        test_name: 'MRI',
        test_category: 'imaging',
      });
      expect(submittedRows()[0]).toMatchObject({
        test_name: 'MRI',
        category: 'imaging',
        result_type: 'qualitative',
      });
    });
  });

  describe('picking a numeric panel', () => {
    it('leaves numeric rows numeric', () => {
      const { submit, submittedRows } = setup();
      submit('Basic Metabolic Panel (BMP)');

      expect(submittedRows().length).toBeGreaterThan(1);
      submittedRows().forEach(row => expect(row.result_type).toBe('quantitative'));
    });
  });
});

describe('getNameOptions', () => {
  it('lists only panels when nothing has been typed', () => {
    const options = getNameOptions('');
    expect(options).toHaveLength(PANEL_LIBRARY.length);
    expect(options).not.toContain('Hemoglobin A1c (HbA1c)');
    expect(getNameOptions('   ')).toEqual(options);
  });

  it('lists matching panels before matching tests', () => {
    const options = getNameOptions('glucose');
    const firstTest = options.indexOf('Glucose (GLU)');
    expect(options.indexOf('Glucose Tolerance Test (GTT)')).toBeLessThan(firstTest);
    expect(options.indexOf('Diabetes Monitoring Panel (DM Panel)')).toBeLessThan(
      firstTest
    );
  });

  it('lists tests alone when no panel matches', () => {
    const options = getNameOptions('hemoglobin a1c');
    expect(options).toEqual(['Hemoglobin A1c (HbA1c)']);
  });

  it('never lists the same suggestion twice', () => {
    ['biopsy', 'cytology', 'immuno', 'glucose', 'a', 'e'].forEach(query => {
      const options = getNameOptions(query);
      expect(new Set(options).size, query).toBe(options.length);
    });
  });

  it('lists what filtering the untruncated panels and tests would', () => {
    const untruncated = (query: string): string[] => {
      const panels = getPanelAutocompleteOptions(query, Infinity);
      const listed = new Set(panels);
      const tests = getAutocompleteOptions(query, Infinity).filter(
        option => !listed.has(option)
      );
      return [...panels, ...tests].slice(0, 50);
    };

    [...'abcdefghijklmnopqrstuvwxyz', 'biopsy', 'cyto', 'glucose', 'panel'].forEach(
      query => expect(getNameOptions(query), query).toEqual(untruncated(query))
    );
  });

  it('stops at the limit', () => {
    expect(getNameOptions('a', 10)).toHaveLength(10);
    expect(getNameOptions('e').length).toBeLessThanOrEqual(50);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(getNameOptions('zzzzznotathing')).toEqual([]);
  });
});

describe('getMatchedNameAlias', () => {
  it('names the alias that listed a panel', () => {
    expect(getMatchedNameAlias('Cytology', 'pap smear')).toBe('Pap Smear');
    expect(getMatchedNameAlias('Diabetes Monitoring Panel (DM Panel)', 'a1c')).toBeDefined();
  });

  it('names the alias that listed a test', () => {
    expect(getMatchedNameAlias('Platelet Count (PLT)', 'thrombocytes')).toBe(
      'Thrombocytes'
    );
  });

  it('is empty when the typed text is part of the suggestion itself', () => {
    expect(getMatchedNameAlias('Cytology', 'cyto')).toBeUndefined();
    expect(getMatchedNameAlias('Platelet Count (PLT)', 'platelet')).toBeUndefined();
  });

  it('is empty when nothing has been typed', () => {
    expect(getMatchedNameAlias('Cytology', '')).toBeUndefined();
  });
});

