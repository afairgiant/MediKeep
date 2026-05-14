/**
 * Tests for the vaccine library search and autocomplete helpers.
 *
 * Covers exact matches, brand-name lookups via common_names, the is_common
 * boost on tie-breaks, autocomplete formatting, and the extractor that
 * round-trips "Vaccine Name (SHORT)" back to a canonical name.
 */

import { describe, test, expect } from 'vitest';
import {
  searchVaccines,
  getVaccineByName,
  getVaccineByWhoCode,
  getCommonVaccines,
  getAutocompleteOptions,
  extractVaccineName,
  getMatchedCommonName,
} from '../vaccineLibrary';

describe('searchVaccines', () => {
  test('exact short_name match ranks first ("MMR")', () => {
    const results = searchVaccines('MMR');
    expect(results[0].short_name).toBe('MMR');
  });

  test('common_names brand match surfaces vaccine ("Shingrix")', () => {
    const shorts = searchVaccines('Shingrix').map(v => v.short_name);
    expect(shorts).toContain('RZV');
  });

  test('common_names brand match surfaces vaccine ("Gardasil")', () => {
    const shorts = searchVaccines('Gardasil').map(v => v.short_name);
    expect(shorts).toContain('HPV4');
  });

  test('case-insensitive on common_names matches', () => {
    const lower = searchVaccines('priorix').map(v => v.short_name);
    const upper = searchVaccines('PRIORIX').map(v => v.short_name);
    expect(lower).toContain('MMR');
    expect(upper).toContain('MMR');
  });

  test('partial vaccine_name substring matches ("Rubella")', () => {
    const shorts = searchVaccines('Rubella').map(v => v.short_name);
    expect(shorts).toContain('MMR');
    expect(shorts).toContain('MMRV');
  });

  test('exact match (1000) outranks contains match (200)', () => {
    const results = searchVaccines('mmr');
    const shorts = results.map(v => v.short_name);
    expect(shorts.indexOf('MMR')).toBeLessThan(shorts.indexOf('MMRV'));
  });

  test('empty query lists common vaccines first', () => {
    const results = searchVaccines('', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(v => v.is_common)).toBe(true);
  });

  test('respects limit', () => {
    expect(searchVaccines('', 3).length).toBe(3);
  });

  test('returns empty array for nonsense query', () => {
    expect(searchVaccines('zzzz_no_such_vaccine')).toEqual([]);
  });
});

describe('lookups', () => {
  test('getVaccineByName matches vaccine_name', () => {
    expect(getVaccineByName('Covid-19')?.short_name).toBe('COVID-19');
  });

  test('getVaccineByName matches short_name', () => {
    expect(getVaccineByName('MMR')?.is_combined).toBe(true);
  });

  test('getVaccineByName is case-insensitive', () => {
    expect(getVaccineByName('rabies')?.vaccine_name).toBe('Rabies');
  });

  test('getVaccineByWhoCode looks up by WHO PCMT code', () => {
    expect(getVaccineByWhoCode('Covid19')?.short_name).toBe('COVID-19');
  });

  test('getCommonVaccines returns only is_common entries', () => {
    const common = getCommonVaccines();
    expect(common.length).toBeGreaterThan(0);
    expect(common.every(v => v.is_common)).toBe(true);
  });

  test('getCommonVaccines is sorted by display_order', () => {
    const orders = getCommonVaccines()
      .map(v => v.display_order)
      .filter((o): o is number => o !== null);
    const sortedCopy = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sortedCopy);
  });
});

describe('getAutocompleteOptions', () => {
  test('appends short_name in parentheses when distinct', () => {
    const opts = getAutocompleteOptions('Measles, Mumps and');
    expect(opts).toContain('Measles, Mumps and Rubella (MMR)');
  });

  test('omits short_name when it equals vaccine_name (BCG)', () => {
    const opts = getAutocompleteOptions('BCG');
    expect(opts).toContain('BCG');
    expect(opts).not.toContain('BCG (BCG)');
  });
});

describe('extractVaccineName', () => {
  test('strips a trailing parenthetical that matches a known short_name', () => {
    expect(extractVaccineName('Measles, Mumps and Rubella (MMR)')).toBe(
      'Measles, Mumps and Rubella'
    );
  });

  test('preserves parentheticals that are not short_names', () => {
    const input = 'Hepatitis A (Human Diploid Cell), Inactivated (Adult)';
    expect(extractVaccineName(input)).toBe(input);
  });

  test('passes through free text untouched', () => {
    expect(extractVaccineName('Regional Custom Vaccine')).toBe(
      'Regional Custom Vaccine'
    );
  });
});

describe('getMatchedCommonName', () => {
  test('returns the matching brand when query did not hit name/short_name', () => {
    expect(
      getMatchedCommonName('Zoster Recombinant (Shingles)', 'shingrix')
    ).toBe('Shingrix');
  });

  test('returns undefined when query also matches the vaccine_name', () => {
    expect(
      getMatchedCommonName('Measles, Mumps and Rubella', 'measles')
    ).toBeUndefined();
  });

  test('returns undefined for empty query', () => {
    expect(getMatchedCommonName('Covid-19', '   ')).toBeUndefined();
  });
});
