/**
 * API service for standardized test library
 */
import { apiService } from './index';

export interface StandardizedTest {
  id: number;
  loinc_code: string | null;
  test_name: string;
  short_name: string | null;
  default_unit: string | null;
  category: string | null;
  common_names: string[] | null;
  is_common: boolean;
}

export interface TestSearchResponse {
  tests: StandardizedTest[];
  total: number;
}

export interface AutocompleteOption {
  value: string;
  label: string;
  loinc_code: string | null;
  default_unit: string | null;
  category: string | null;
}

class StandardizedTestApi {
  private basePath = '/standardized-tests';

  /**
   * Search for standardized tests
   */
  async search(query: string, category?: string, limit: number = 200): Promise<TestSearchResponse> {
    const params: any = { limit };
    if (query) params.query = query;
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/search`, { params });
    return response.data;
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(query: string, category?: string, limit: number = 50): Promise<AutocompleteOption[]> {
    const params: any = { query, limit };
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/autocomplete`, { params });
    return response.data;
  }

  /**
   * Get common/frequently used tests
   */
  async getCommon(category?: string, limit: number = 100): Promise<StandardizedTest[]> {
    const params: any = { limit };
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/common`, { params });
    return response.data;
  }

  /**
   * Get tests by category
   */
  async getByCategory(category: string): Promise<StandardizedTest[]> {
    const response = await apiService.get(`${this.basePath}/by-category/${category}`);
    return response.data;
  }

  /**
   * Get test by LOINC code
   */
  async getByLoinc(loincCode: string): Promise<StandardizedTest> {
    const response = await apiService.get(`${this.basePath}/by-loinc/${loincCode}`);
    return response.data;
  }

  /**
   * Get test by name (exact match)
   */
  async getByName(testName: string): Promise<StandardizedTest> {
    const response = await apiService.get(`${this.basePath}/by-name/${testName}`);
    return response.data;
  }

  /**
   * Get test count
   */
  async count(category?: string): Promise<{ category: string | null; count: number }> {
    const params: any = {};
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/count`, { params });
    return response.data;
  }

  /**
   * Match a test name to standardized test (fuzzy matching)
   * Returns the best match or null
   *
   * NOTE: This API-based matching is currently UNUSED.
   * The app uses testLibrary.ts static file for faster, simpler matching.
   * Keeping this code commented for future reference if we want to switch back.
   */
  /*
  async matchTestName(testName: string): Promise<StandardizedTest | null> {
    try {
      // First try exact match
      try {
        const exact = await this.getByName(testName);
        if (exact) return exact;
      } catch {
        // Not an exact match, continue with search
      }

      // Then try search for fuzzy matching
      const searchResult = await this.search(testName, undefined, 10);

      if (searchResult.tests.length === 0) {
        return null;
      }

      // Return the first result (best match from full-text search)
      return searchResult.tests[0];
    } catch (error) {
      // Silently return null on error
      return null;
    }
  }
  */

  /**
   * Batch match multiple test names at once (much faster than individual calls)
   * Returns a map of test_name -> StandardizedTest (or null if not found)
   *
   * NOTE: This API-based batch matching is currently UNUSED.
   * The app uses testLibrary.ts static file for instant, synchronous matching.
   * Keeping this code commented for future reference if we want to switch back.
   *
   * Backend endpoint: POST /api/v1/standardized-tests/batch-match
   */
  /*
  async batchMatchTestNames(testNames: string[]): Promise<Map<string, StandardizedTest | null>> {
    try {
      const response = await apiService.post(`${this.basePath}/batch-match`, {
        test_names: testNames
      });

      const resultMap = new Map<string, StandardizedTest | null>();

      for (const result of response.data.results) {
        resultMap.set(result.test_name, result.matched_test);
      }

      return resultMap;
    } catch (error) {
      // Return empty map on error
      return new Map();
    }
  }
  */
}

export const standardizedTestApi = new StandardizedTestApi();
