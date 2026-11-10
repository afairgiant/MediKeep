/**
 * Regression tests for the lab test library search helpers.
 *
 * Issue #816: searches against `common_names` entries (e.g. "Thrombocytes"
 * for Platelet Count) must surface the corresponding test.
 */

import { describe, test, expect } from 'vitest';
import {
  searchTests,
  getMatchedCommonName,
  getAutocompleteOptions,
  getTestByName,
  TEST_CATEGORY_TO_FORM_CATEGORY,
} from '../testLibrary';

describe('searchTests', () => {
  test('matches Platelet Count when searching a common_names entry ("Thrombocytes")', () => {
    const results = searchTests('Thrombocytes');
    const names = results.map(r => r.test_name);
    expect(names).toContain('Platelet Count');
  });

  test('is case-insensitive on common_names matches', () => {
    const lower = searchTests('thrombocytes').map(r => r.test_name);
    const upper = searchTests('THROMBOCYTES').map(r => r.test_name);
    expect(lower).toContain('Platelet Count');
    expect(upper).toContain('Platelet Count');
  });

  test('still matches by abbreviation (PLT)', () => {
    const names = searchTests('PLT').map(r => r.test_name);
    expect(names).toContain('Platelet Count');
  });

  test('still matches by test_name substring (platelet)', () => {
    const names = searchTests('platelet').map(r => r.test_name);
    expect(names).toContain('Platelet Count');
  });

  test('empty query returns an alphabetically sorted list', () => {
    const results = searchTests('', 5);
    expect(results.length).toBe(5);
    const sorted = [...results].sort((a, b) =>
      a.test_name.localeCompare(b.test_name)
    );
    expect(results.map(r => r.test_name)).toEqual(
      sorted.map(r => r.test_name)
    );
  });

  test.each([
    ['Cholesterol/HDL Ratio', 'Total Cholesterol/HDL Ratio'],
    ['Cholesterol Ratio', 'Total Cholesterol/HDL Ratio'],
    ['T. Chol/HDL Ratio', 'Total Cholesterol/HDL Ratio'],
    ['CHOL', 'Total Cholesterol'],
    ['LDL/HDL Ratio', 'LDL/HDL Ratio'],
  ])('ranks "%s" to %s first (issue #1221)', (query, expected) => {
    expect(searchTests(query, 1)[0]?.test_name).toBe(expected);
  });

  test('bare "TC" does not prefix-match the cholesterol ratio abbreviation', () => {
    expect(searchTests('TC', 1)[0]?.test_name).not.toBe(
      'Total Cholesterol/HDL Ratio'
    );
  });

  test('unknown query returns no results', () => {
    expect(searchTests('zzzzznotarealtest')).toEqual([]);
  });
});

describe('getAutocompleteOptions', () => {
  test('surfaces Platelet Count entry when searching "Thrombocytes"', () => {
    const options = getAutocompleteOptions('Thrombocytes');
    expect(options).toContain('Platelet Count (PLT)');
  });
});

describe('getMatchedCommonName', () => {
  test('returns the matched common_name when the query only matches there', () => {
    expect(getMatchedCommonName('Platelet Count', 'Thrombocytes')).toBe(
      'Thrombocytes'
    );
  });

  test('returns undefined when the query also matches the test_name', () => {
    expect(getMatchedCommonName('Platelet Count', 'platelet')).toBeUndefined();
  });

  test('returns undefined when the query also matches the abbreviation', () => {
    expect(getMatchedCommonName('Platelet Count', 'PLT')).toBeUndefined();
  });

  test('returns undefined for an empty query', () => {
    expect(getMatchedCommonName('Platelet Count', '')).toBeUndefined();
    expect(getMatchedCommonName('Platelet Count', '   ')).toBeUndefined();
  });

  test('returns undefined when the test is unknown', () => {
    expect(
      getMatchedCommonName('Not A Real Test', 'anything')
    ).toBeUndefined();
  });

  test('is case-insensitive', () => {
    expect(getMatchedCommonName('Platelet Count', 'thrombocytes')).toBe(
      'Thrombocytes'
    );
  });
});

describe('biopsy entries', () => {
  it.each(['Biopsy', 'Skin Biopsy', 'Bone Marrow Biopsy'])(
    '%s is a qualitative pathology test with no unit',
    name => {
      const test = getTestByName(name);
      expect(test).toBeDefined();
      expect(test?.category).toBe('pathology');
      expect(test?.result_type).toBe('qualitative');
      expect(test?.default_unit).toBe('');
    }
  );

  it('are found when searching "biopsy"', () => {
    const names = searchTests('biopsy').map(r => r.test_name);
    expect(names).toEqual(
      expect.arrayContaining(['Biopsy', 'Skin Biopsy', 'Bone Marrow Biopsy'])
    );
  });

  it('are found through a common name (dermatopathology)', () => {
    const names = searchTests('dermatopathology').map(r => r.test_name);
    expect(names).toContain('Skin Biopsy');
  });

  it('lists the generic entry first when searching the exact name', () => {
    expect(searchTests('biopsy')[0].test_name).toBe('Biopsy');
  });

  it('fill the pathology category on the lab result form', () => {
    const test = getTestByName('Skin Biopsy');
    expect(TEST_CATEGORY_TO_FORM_CATEGORY[test!.category]).toBe('pathology');
  });
});

describe('cytology, IHC, molecular, flow and cytogenetics entries', () => {
  it.each([
    ['Cytology', 'qualitative'],
    ['Immunohistochemistry', 'qualitative'],
    ['Molecular Pathology', 'qualitative'],
    ['Flow Cytometry', 'textual'],
    ['Cytogenetics', 'textual'],
  ])('%s is a pathology test recorded as %s', (name, resultType) => {
    const test = getTestByName(name);
    expect(test).toBeDefined();
    expect(test?.category).toBe('pathology');
    expect(test?.result_type).toBe(resultType);
    expect(test?.default_unit).toBe('');
  });

  it.each([
    ['pap smear', 'Cytology'],
    ['fna', 'Cytology'],
    ['ihc', 'Immunohistochemistry'],
    ['karyotype', 'Cytogenetics'],
    ['immunophenotyping', 'Flow Cytometry'],
    ['fish', 'Molecular Pathology'],
  ])('search for "%s" finds %s', (query, name) => {
    expect(searchTests(query).map(r => r.test_name)).toContain(name);
  });

  it('gives Immunohistochemistry its IHC abbreviation', () => {
    expect(getTestByName('IHC')?.test_name).toBe('Immunohistochemistry');
  });
});

