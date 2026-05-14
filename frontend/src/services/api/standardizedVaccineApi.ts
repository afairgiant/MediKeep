/**
 * API service for the standardized vaccine library.
 *
 * The Immunization autocomplete uses the local vaccineLibrary.ts JSON for
 * instant, synchronous matching. This API service is provided for backend
 * consumers, batch tooling, and future database-backed query scenarios.
 */
import { apiService } from './index';

export interface StandardizedVaccine {
  id: number;
  who_code: string | null;
  vaccine_name: string;
  short_name: string | null;
  category: string | null;
  common_names: string[] | null;
  is_combined: boolean;
  components: string[] | null;
  default_manufacturer: string | null;
  is_common: boolean;
}

export interface VaccineSearchResponse {
  vaccines: StandardizedVaccine[];
  total: number;
}

export interface VaccineAutocompleteOption {
  value: string;
  label: string;
  who_code: string | null;
  short_name: string | null;
  category: string | null;
  is_combined: boolean;
  components: string[] | null;
}

class StandardizedVaccineApi {
  private basePath = '/standardized-vaccines';

  async search(
    query: string,
    category?: string,
    limit: number = 200
  ): Promise<VaccineSearchResponse> {
    const params: Record<string, unknown> = { limit };
    if (query) params.query = query;
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/search`, {
      params,
    });
    return response.data;
  }

  async autocomplete(
    query: string,
    category?: string,
    limit: number = 50
  ): Promise<VaccineAutocompleteOption[]> {
    const params: Record<string, unknown> = { query, limit };
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/autocomplete`, {
      params,
    });
    return response.data;
  }

  async getCommon(
    category?: string,
    limit: number = 100
  ): Promise<StandardizedVaccine[]> {
    const params: Record<string, unknown> = { limit };
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/common`, {
      params,
    });
    return response.data;
  }

  async getByCategory(category: string): Promise<StandardizedVaccine[]> {
    const response = await apiService.get(
      `${this.basePath}/by-category/${category}`
    );
    return response.data;
  }

  async getByWhoCode(whoCode: string): Promise<StandardizedVaccine> {
    const response = await apiService.get(
      `${this.basePath}/by-who-code/${whoCode}`
    );
    return response.data;
  }

  async getByName(vaccineName: string): Promise<StandardizedVaccine> {
    const response = await apiService.get(
      `${this.basePath}/by-name/${vaccineName}`
    );
    return response.data;
  }

  async count(
    category?: string
  ): Promise<{ category: string | null; count: number }> {
    const params: Record<string, unknown> = {};
    if (category) params.category = category;

    const response = await apiService.get(`${this.basePath}/count`, {
      params,
    });
    return response.data;
  }
}

export const standardizedVaccineApi = new StandardizedVaccineApi();
