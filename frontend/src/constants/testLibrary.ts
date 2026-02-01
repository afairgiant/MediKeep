/**
 * Comprehensive Lab Test Library
 * Contains standardized test names, units, categories, and metadata
 * Used for autocomplete and auto-fill functionality
 *
 * Single source of truth: shared/data/test_library.json
 */

import testLibraryData from '@shared/data/test_library.json';
import { TestLibraryItem, TestLibraryData } from './testLibraryTypes';

// Cast the imported JSON data to our typed interface
const typedLibraryData = testLibraryData as TestLibraryData;

// Export the test library array for backward compatibility
export const TEST_LIBRARY: TestLibraryItem[] = typedLibraryData.tests;

// Export library metadata
export const TEST_LIBRARY_VERSION = typedLibraryData.version;
export const TEST_LIBRARY_LAST_UPDATED = typedLibraryData.lastUpdated;

// Re-export types for convenience
export type { TestLibraryItem, TestCategory } from './testLibraryTypes';

/**
 * Helper Functions
 */

// Pre-sorted test library for performance (avoid repeated sorting)
const SORTED_TEST_LIBRARY = [...TEST_LIBRARY].sort((a, b) =>
  a.test_name.localeCompare(b.test_name)
);

/**
 * Search tests by name, abbreviation, or common names
 * Supports fuzzy matching for better UX
 */
export function searchTests(query: string, limit: number = 200): TestLibraryItem[] {
  if (!query || query.trim().length === 0) {
    // Return pre-sorted tests (performance optimization)
    return SORTED_TEST_LIBRARY.slice(0, limit);
  }

  const searchTerm = query.toLowerCase().trim();

  return TEST_LIBRARY
    .map(test => {
      let score = 0;

      // Exact match on test name or abbreviation (highest priority)
      if (test.test_name.toLowerCase() === searchTerm || test.abbreviation?.toLowerCase() === searchTerm) {
        score = 1000;
      }
      // Starts with query
      else if (test.test_name.toLowerCase().startsWith(searchTerm) || test.abbreviation?.toLowerCase().startsWith(searchTerm)) {
        score = 500;
      }
      // Contains query in test name
      else if (test.test_name.toLowerCase().includes(searchTerm)) {
        score = 200;
      }
      // Contains query in abbreviation
      else if (test.abbreviation?.toLowerCase().includes(searchTerm)) {
        score = 150;
      }
      // Match common names
      else if (test.common_names?.some(name => name.toLowerCase().includes(searchTerm))) {
        score = 100;
      }

      // Boost score for common tests
      if (test.is_common && score > 0) {
        score += 50;
      }

      return { test, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => {
      // First sort by score (descending)
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      // Then sort alphabetically by test name
      return a.test.test_name.localeCompare(b.test.test_name);
    })
    .slice(0, limit)
    .map(result => result.test);
}

/**
 * Get tests by category
 */
export function getTestsByCategory(category: TestLibraryItem['category']): TestLibraryItem[] {
  return TEST_LIBRARY
    .filter(test => test.category === category)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
}

/**
 * Get only common tests (for default suggestions)
 */
export function getCommonTests(): TestLibraryItem[] {
  return TEST_LIBRARY
    .filter(test => test.is_common)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
}

/**
 * Get test by exact name match
 */
export function getTestByName(testName: string): TestLibraryItem | undefined {
  return TEST_LIBRARY.find(
    test => test.test_name.toLowerCase() === testName.toLowerCase() ||
            test.abbreviation?.toLowerCase() === testName.toLowerCase()
  );
}

/**
 * Get autocomplete options formatted for Mantine Autocomplete
 */
export function getAutocompleteOptions(query: string = '', limit: number = 200): string[] {
  const tests = searchTests(query, limit);
  return tests.map(test => {
    if (test.abbreviation) {
      return `${test.test_name} (${test.abbreviation})`;
    }
    return test.test_name;
  });
}

/**
 * Extract test name from autocomplete selection
 * Handles format: "Test Name (ABBR)" -> "Test Name"
 */
export function extractTestName(selection: string): string {
  const match = selection.match(/^(.+?)\s*(?:\([^)]+\))?$/);
  return match ? match[1].trim() : selection;
}
