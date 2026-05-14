/**
 * Vaccine library — standardized vaccine names, WHO PCMT codes, brand names,
 * and combined-vaccine metadata. Powers the Immunization form autocomplete.
 *
 * Single source of truth: shared/data/vaccine_library.json
 */

import vaccineLibraryData from '../../../shared/data/vaccine_library.json';
import { VaccineLibraryItem, VaccineLibraryData } from './vaccineLibraryTypes';

const typedLibraryData = vaccineLibraryData as VaccineLibraryData;

export const VACCINE_LIBRARY: VaccineLibraryItem[] = typedLibraryData.vaccines;
export const VACCINE_LIBRARY_VERSION = typedLibraryData.version;
export const VACCINE_LIBRARY_LAST_UPDATED = typedLibraryData.lastUpdated;

export type { VaccineLibraryItem, VaccineCategory } from './vaccineLibraryTypes';

const byDisplayOrder = (
  a: VaccineLibraryItem,
  b: VaccineLibraryItem
): number => (a.display_order ?? 999) - (b.display_order ?? 999);

const SORTED_VACCINE_LIBRARY = [...VACCINE_LIBRARY].sort((a, b) =>
  a.vaccine_name.localeCompare(b.vaccine_name)
);

const COMMON_VACCINES_ORDERED = [...VACCINE_LIBRARY]
  .filter(v => v.is_common)
  .sort(byDisplayOrder);

const EMPTY_QUERY_RESULT: VaccineLibraryItem[] = [
  ...COMMON_VACCINES_ORDERED,
  ...SORTED_VACCINE_LIBRARY.filter(v => !v.is_common),
];

// O(1) lookups; getVaccineByName et al. are called per-option during dropdown
// renders, so the linear Array.find we used originally added up fast.
const VACCINES_BY_LOWER_NAME = new Map<string, VaccineLibraryItem>();
const VACCINES_BY_LOWER_SHORT = new Map<string, VaccineLibraryItem>();
const VACCINES_BY_LOWER_WHO_CODE = new Map<string, VaccineLibraryItem>();
for (const v of VACCINE_LIBRARY) {
  VACCINES_BY_LOWER_NAME.set(v.vaccine_name.toLowerCase(), v);
  if (v.short_name) {
    VACCINES_BY_LOWER_SHORT.set(v.short_name.toLowerCase(), v);
  }
  if (v.who_code) {
    VACCINES_BY_LOWER_WHO_CODE.set(v.who_code.toLowerCase(), v);
  }
}

export function searchVaccines(
  query: string,
  limit: number = 200
): VaccineLibraryItem[] {
  if (!query || query.trim().length === 0) {
    return EMPTY_QUERY_RESULT.slice(0, limit);
  }

  const searchTerm = query.toLowerCase().trim();

  return VACCINE_LIBRARY.map(vaccine => {
    let score = 0;

    if (
      vaccine.vaccine_name.toLowerCase() === searchTerm ||
      vaccine.short_name?.toLowerCase() === searchTerm ||
      vaccine.who_code?.toLowerCase() === searchTerm
    ) {
      score = 1000;
    } else if (
      vaccine.vaccine_name.toLowerCase().startsWith(searchTerm) ||
      vaccine.short_name?.toLowerCase().startsWith(searchTerm)
    ) {
      score = 500;
    } else if (vaccine.vaccine_name.toLowerCase().includes(searchTerm)) {
      score = 200;
    } else if (vaccine.short_name?.toLowerCase().includes(searchTerm)) {
      score = 150;
    } else if (
      vaccine.common_names?.some(name =>
        name.toLowerCase().includes(searchTerm)
      )
    ) {
      score = 100;
    }

    if (vaccine.is_common && score > 0) {
      score += 50;
    }

    return { vaccine, score };
  })
    .filter(result => result.score > 0)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.vaccine.vaccine_name.localeCompare(b.vaccine.vaccine_name);
    })
    .slice(0, limit)
    .map(result => result.vaccine);
}

export function getVaccinesByCategory(
  category: VaccineLibraryItem['category']
): VaccineLibraryItem[] {
  return VACCINE_LIBRARY.filter(v => v.category === category).sort(
    byDisplayOrder
  );
}

export function getCommonVaccines(): VaccineLibraryItem[] {
  return COMMON_VACCINES_ORDERED.slice();
}

export function getVaccineByName(
  vaccineName: string
): VaccineLibraryItem | undefined {
  const needle = vaccineName.toLowerCase();
  return (
    VACCINES_BY_LOWER_NAME.get(needle) ??
    VACCINES_BY_LOWER_SHORT.get(needle) ??
    VACCINES_BY_LOWER_WHO_CODE.get(needle)
  );
}

export function getVaccineByWhoCode(
  whoCode: string
): VaccineLibraryItem | undefined {
  return VACCINES_BY_LOWER_WHO_CODE.get(whoCode.toLowerCase());
}

function formatOptionValue(v: VaccineLibraryItem): string {
  return v.short_name && v.short_name !== v.vaccine_name
    ? `${v.vaccine_name} (${v.short_name})`
    : v.vaccine_name;
}

export interface VaccineAutocompleteEntry {
  value: string;
  entry: VaccineLibraryItem;
  matched: string | undefined;
}

/**
 * Returns autocomplete options enriched with the resolved library entry and
 * the matched common_name (if any). Lets the dropdown's renderer do a single
 * O(1) lookup per option instead of re-parsing the display string and calling
 * back into the lookup helpers.
 */
export function getAutocompleteEntries(
  query: string = '',
  limit: number = 200
): VaccineAutocompleteEntry[] {
  const vaccines = searchVaccines(query, limit);
  return vaccines.map(v => ({
    value: formatOptionValue(v),
    entry: v,
    matched: getMatchedCommonNameForEntry(v, query),
  }));
}

export function getAutocompleteOptions(
  query: string = '',
  limit: number = 200
): string[] {
  return searchVaccines(query, limit).map(formatOptionValue);
}

/**
 * Round-trips an autocomplete display string back to the canonical
 * vaccine_name. Strips a trailing parenthetical ONLY when it matches a known
 * short_name — vaccine names like "Hepatitis A (Human Diploid Cell), Inactivated
 * (Adult)" must pass through unmodified.
 */
export function extractVaccineName(selection: string): string {
  const trimmed = selection.trim();
  const trailingParen = trimmed.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!trailingParen) return trimmed;
  const [, name, candidate] = trailingParen;
  return VACCINES_BY_LOWER_SHORT.has(candidate.toLowerCase())
    ? name.trim()
    : trimmed;
}

/**
 * Returns the common_name that triggered the match when the query did NOT
 * also match vaccine_name or short_name. Lets the dropdown show "matched on:
 * Shingrix" when the user typed a brand the canonical name doesn't contain.
 */
export function getMatchedCommonNameForEntry(
  v: VaccineLibraryItem,
  query: string
): string | undefined {
  if (!query.trim()) return undefined;
  if (!v.common_names?.length) return undefined;
  const q = query.toLowerCase().trim();
  const nameOrShortMatches =
    v.vaccine_name.toLowerCase().includes(q) ||
    (v.short_name?.toLowerCase().includes(q) ?? false);
  if (nameOrShortMatches) return undefined;
  return v.common_names.find(name => name.toLowerCase().includes(q));
}

export function getMatchedCommonName(
  vaccineName: string,
  query: string
): string | undefined {
  const v = getVaccineByName(vaccineName);
  return v ? getMatchedCommonNameForEntry(v, query) : undefined;
}
