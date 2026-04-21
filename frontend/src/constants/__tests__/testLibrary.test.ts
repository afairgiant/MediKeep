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
