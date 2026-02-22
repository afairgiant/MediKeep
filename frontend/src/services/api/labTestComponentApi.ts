import { apiService } from './index';
import logger from '../logger';

// Types for Lab Test Components
export type ResultType = 'quantitative' | 'qualitative';
export type QualitativeValue = 'positive' | 'negative' | 'detected' | 'undetected';

export interface LabTestComponent {
  id?: number;
  lab_result_id: number;
  test_name: string;
  abbreviation?: string | null;
  test_code?: string | null;
  value?: number | null;
  unit?: string | null;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string | null;
  status?: 'normal' | 'high' | 'low' | 'critical' | 'abnormal' | 'borderline' | null;
  category?: 'chemistry' | 'hematology' | 'hepatology' | 'immunology' | 'microbiology' | 'endocrinology' |
             'cardiology' | 'toxicology' | 'genetics' | 'molecular' | 'pathology' | 'lipids' | 'hearing' | 'stomatology' | 'other' | null;
  display_order?: number | null;
  canonical_test_name?: string | null;  // Links to standardized test name for trend matching
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  result_type?: ResultType | null;
  qualitative_value?: QualitativeValue | null;
}

export interface LabTestComponentCreate extends Omit<LabTestComponent, 'id' | 'created_at' | 'updated_at' | 'lab_result_id'> {
  lab_result_id?: number; // Optional here since it's set from URL
}

export interface LabTestComponentUpdate extends Partial<Omit<LabTestComponent, 'id' | 'lab_result_id' | 'created_at' | 'updated_at'>> {}

export interface LabTestComponentFilters {
  category?: string;
  status?: string;
  search?: string;
}

export interface LabTestComponentBulkCreate {
  components: LabTestComponentCreate[];
}

export interface LabTestComponentBulkResponse {
  created_count: number;
  components: LabTestComponent[];
  errors: string[];
}

export interface LabTestComponentStatistics {
  total_components: number;
  status_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  abnormal_count: number;
  critical_count: number;
  normal_count: number;
}

// Trend tracking types
export interface TrendDataPoint {
  id: number;
  value?: number | null;
  unit?: string | null;
  status?: string | null;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string | null;
  recorded_date?: string | null;
  created_at: string;
  lab_result: {
    id: number;
    test_name: string;
    completed_date?: string | null;
  };
  result_type?: ResultType | null;
  qualitative_value?: QualitativeValue | null;
}

export interface TrendStatistics {
  count: number;
  latest?: number | null;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  std_dev?: number | null;
  trend_direction: 'increasing' | 'decreasing' | 'stable' | 'worsening' | 'improving';
  time_in_range_percent?: number | null;
  normal_count: number;
  abnormal_count: number;
  result_type?: ResultType | null;
  qualitative_summary?: Record<string, number> | null;
}

export interface TrendResponse {
  test_name: string;
  unit?: string | null;
  category?: string | null;
  data_points: TrendDataPoint[];
  statistics: TrendStatistics;
  is_aggregated: boolean;
  aggregation_period?: string | null;
  result_type?: ResultType | null;
}

export interface TestTemplate {
  name: string;
  description: string;
  tests: TestTemplateItem[];
}

export interface TestTemplateItem {
  test_name: string;
  abbreviation?: string;
  unit: string;
  category: string;
  display_order?: number;
  result_type?: ResultType;
  // No hardcoded reference ranges - user will enter these based on their lab report
}

// Interface for template entry form
export interface TestTemplateEntry extends TestTemplateItem {
  value?: number | null;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string | null;
  notes?: string | null;
  qualitative_value?: QualitativeValue | null;
}

class LabTestComponentApi {
  /**
   * Get all test components for a specific lab result
   */
  async getByLabResult(
    labResultId: number,
    filters?: LabTestComponentFilters,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<{ data: LabTestComponent[] }> {
    try {
      const params = {
        ...(patientId !== null && patientId !== undefined ? { patient_id: patientId } : {}),
        ...(filters || {})
      };

      const response = await apiService.get(
        `/lab-test-components/lab-result/${labResultId}/components`,
        { params, signal }
      );

      logger.debug('lab_test_components_fetched', {
        labResultId,
        componentCount: response?.length || 0,
        component: 'LabTestComponentApi'
      });

      return { data: response || [] };
    } catch (error: any) {
      logger.error('lab_test_components_fetch_error', {
        labResultId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get a specific test component by ID
   */
  async getComponent(
    componentId: number,
    signal?: AbortSignal
  ): Promise<LabTestComponent> {
    try {
      const response = await apiService.get(
        `/lab-test-components/components/${componentId}`,
        { signal }
      );

      logger.debug('lab_test_component_fetched', {
        componentId,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_component_fetch_error', {
        componentId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Create a single test component for a lab result
   */
  async createForLabResult(
    labResultId: number,
    data: LabTestComponentCreate,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponent> {
    try {
      const params = patientId !== null && patientId !== undefined
        ? { patient_id: patientId }
        : {};

      const response = await apiService.post(
        `/lab-test-components/lab-result/${labResultId}/components`,
        data,
        { params, signal }
      );

      logger.info('lab_test_component_created', {
        labResultId,
        testName: data.test_name,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_component_create_error', {
        labResultId,
        testName: data?.test_name,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Create multiple test components for a lab result in bulk
   *
   * Response structure:
   * {
   *   created_count: number,
   *   components: LabTestComponent[],
   *   errors: string[]
   * }
   */
  async createBulkForLabResult(
    labResultId: number,
    components: LabTestComponentCreate[],
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponentBulkResponse> {
    try {
      const params = patientId !== null && patientId !== undefined
        ? { patient_id: patientId }
        : {};

      const response = await apiService.post(
        `/lab-test-components/lab-result/${labResultId}/components/bulk`,
        {
          lab_result_id: labResultId,
          components
        },
        { params, signal }
      );

      logger.info('lab_test_components_bulk_created', {
        labResultId,
        componentCount: components.length,
        createdCount: response?.created_count || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_components_bulk_create_error', {
        labResultId,
        componentCount: components?.length || 0,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Update an existing test component
   */
  async update(
    componentId: number,
    data: LabTestComponentUpdate,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponent> {
    try {
      const params = patientId !== null && patientId !== undefined
        ? { patient_id: patientId }
        : {};

      const response = await apiService.put(
        `/lab-test-components/components/${componentId}`,
        data,
        { params, signal }
      );

      logger.info('lab_test_component_updated', {
        componentId,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_component_update_error', {
        componentId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Delete a test component
   */
  async delete(
    componentId: number,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<{ success: boolean }> {
    try {
      const params = patientId !== null && patientId !== undefined
        ? { patient_id: patientId }
        : {};

      await apiService.delete(
        `/lab-test-components/components/${componentId}`,
        { params, signal }
      );

      logger.info('lab_test_component_deleted', {
        componentId,
        component: 'LabTestComponentApi'
      });

      return { success: true };
    } catch (error: any) {
      logger.error('lab_test_component_delete_error', {
        componentId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Search test components
   */
  async searchComponents(
    query: string,
    filters: {
      lab_result_id?: number;
      category?: string;
      status?: string;
      skip?: number;
      limit?: number;
    } = {},
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponent[]> {
    try {
      const params: any = {
        q: query,
        ...(filters.lab_result_id && { lab_result_id: filters.lab_result_id }),
        ...(filters.category && { category: filters.category }),
        ...(filters.status && { status: filters.status }),
        ...(filters.skip !== undefined && { skip: filters.skip }),
        ...(filters.limit !== undefined && { limit: filters.limit }),
        ...(patientId !== null && patientId !== undefined && { patient_id: patientId })
      };

      const response = await apiService.get(
        '/lab-test-components/components/search',
        { params, signal }
      );

      logger.debug('lab_test_components_searched', {
        query,
        resultCount: response?.length || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_components_search_error', {
        query,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get abnormal test results
   */
  async getAbnormalResults(
    labResultId?: number | null,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponent[]> {
    try {
      const params: any = {
        ...(labResultId && { lab_result_id: labResultId }),
        ...(patientId !== null && patientId !== undefined && { patient_id: patientId })
      };

      const response = await apiService.get(
        '/lab-test-components/components/abnormal',
        { params, signal }
      );

      logger.debug('lab_test_abnormal_results_fetched', {
        labResultId,
        abnormalCount: response?.length || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_abnormal_results_error', {
        labResultId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get statistics for test components in a lab result
   */
  async getStatistics(
    labResultId: number,
    patientId?: number | null,
    signal?: AbortSignal
  ): Promise<LabTestComponentStatistics> {
    try {
      const params = patientId !== null && patientId !== undefined
        ? { patient_id: patientId }
        : {};

      const response = await apiService.get(
        `/lab-test-components/lab-result/${labResultId}/statistics`,
        { params, signal }
      );

      logger.debug('lab_test_statistics_fetched', {
        labResultId,
        totalComponents: response?.total_components || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('lab_test_statistics_error', {
        labResultId,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get test name suggestions for autocomplete
   */
  async getTestNameSuggestions(
    limit: number = 50,
    signal?: AbortSignal
  ): Promise<string[]> {
    try {
      const params = { limit };
      const response = await apiService.get(
        '/lab-test-components/suggestions/test-names',
        { params, signal }
      );

      logger.debug('test_name_suggestions_fetched', {
        suggestionCount: response?.length || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('test_name_suggestions_error', {
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get abbreviation suggestions for autocomplete
   */
  async getAbbreviationSuggestions(
    limit: number = 50,
    signal?: AbortSignal
  ): Promise<string[]> {
    try {
      const params = { limit };
      const response = await apiService.get(
        '/lab-test-components/suggestions/abbreviations',
        { params, signal }
      );

      logger.debug('abbreviation_suggestions_fetched', {
        suggestionCount: response?.length || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('abbreviation_suggestions_error', {
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get trend data for a specific test component across all lab results
   */
  async getTrendsByPatientAndTest(
    patientId: number,
    testName: string,
    options?: {
      dateFrom?: string;  // YYYY-MM-DD
      dateTo?: string;    // YYYY-MM-DD
      limit?: number;
    },
    signal?: AbortSignal
  ): Promise<TrendResponse> {
    try {
      const params: any = {};

      if (options?.dateFrom) params.date_from = options.dateFrom;
      if (options?.dateTo) params.date_to = options.dateTo;
      if (options?.limit) params.limit = options.limit;

      // Normalize test name by removing trailing punctuation
      const normalizedTestName = testName.trim().replace(/[,;:]+$/, '');

      // Add test_name as a query parameter to avoid issues with special characters in path
      params.test_name = normalizedTestName;

      const response = await apiService.get(
        `/lab-test-components/patient/${patientId}/trends`,
        { params, signal }
      );

      logger.debug('trend_data_fetched', {
        patientId,
        testName,
        dataPointCount: response?.data_points?.length || 0,
        component: 'LabTestComponentApi'
      });

      return response;
    } catch (error: any) {
      logger.error('trend_data_fetch_error', {
        patientId,
        testName,
        error: error.message,
        component: 'LabTestComponentApi'
      });
      throw error;
    }
  }

  /**
   * Get predefined test templates (CBC, BMP, Lipid Panel, etc.)
   * Templates provide test structure but users enter values AND reference ranges
   */
  async getTemplates(): Promise<Record<string, TestTemplate>> {
    // Return static templates without reference ranges
    // Users will enter both values and ranges when using templates
    return Promise.resolve({
      cbc: {
        name: "Complete Blood Count (CBC)",
        description: "Common blood cell tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "White Blood Cell Count", abbreviation: "WBC", unit: "K/uL", category: "hematology", display_order: 1 },
          { test_name: "Red Blood Cell Count", abbreviation: "RBC", unit: "M/uL", category: "hematology", display_order: 2 },
          { test_name: "Hemoglobin", abbreviation: "HGB", unit: "g/dL", category: "hematology", display_order: 3 },
          { test_name: "Hematocrit", abbreviation: "HCT", unit: "%", category: "hematology", display_order: 4 },
          { test_name: "Platelet Count", abbreviation: "PLT", unit: "K/uL", category: "hematology", display_order: 5 },
          { test_name: "Mean Corpuscular Volume", abbreviation: "MCV", unit: "fL", category: "hematology", display_order: 6 },
          { test_name: "Mean Corpuscular Hemoglobin", abbreviation: "MCH", unit: "pg", category: "hematology", display_order: 7 },
          { test_name: "Mean Corpuscular Hemoglobin Concentration", abbreviation: "MCHC", unit: "g/dL", category: "hematology", display_order: 8 }
        ]
      },
      bmp: {
        name: "Basic Metabolic Panel (BMP)",
        description: "Common chemistry tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Glucose", abbreviation: "GLU", unit: "mg/dL", category: "endocrinology", display_order: 1 },
          { test_name: "Sodium", abbreviation: "Na", unit: "mmol/L", category: "chemistry", display_order: 2 },
          { test_name: "Potassium", abbreviation: "K", unit: "mmol/L", category: "chemistry", display_order: 3 },
          { test_name: "Chloride", abbreviation: "Cl", unit: "mmol/L", category: "chemistry", display_order: 4 },
          { test_name: "Carbon Dioxide", abbreviation: "CO2", unit: "mmol/L", category: "chemistry", display_order: 5 },
          { test_name: "Blood Urea Nitrogen", abbreviation: "BUN", unit: "mg/dL", category: "chemistry", display_order: 6 },
          { test_name: "Creatinine", abbreviation: "CREA", unit: "mg/dL", category: "chemistry", display_order: 7 },
          { test_name: "Calcium", abbreviation: "Ca", unit: "mg/dL", category: "chemistry", display_order: 8 }
        ]
      },
      cmp: {
        name: "Comprehensive Metabolic Panel (CMP)",
        description: "Extended chemistry tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Glucose", abbreviation: "GLU", unit: "mg/dL", category: "endocrinology", display_order: 1 },
          { test_name: "Sodium", abbreviation: "Na", unit: "mmol/L", category: "chemistry", display_order: 2 },
          { test_name: "Potassium", abbreviation: "K", unit: "mmol/L", category: "chemistry", display_order: 3 },
          { test_name: "Chloride", abbreviation: "Cl", unit: "mmol/L", category: "chemistry", display_order: 4 },
          { test_name: "Carbon Dioxide", abbreviation: "CO2", unit: "mmol/L", category: "chemistry", display_order: 5 },
          { test_name: "Blood Urea Nitrogen", abbreviation: "BUN", unit: "mg/dL", category: "chemistry", display_order: 6 },
          { test_name: "Creatinine", abbreviation: "CREA", unit: "mg/dL", category: "chemistry", display_order: 7 },
          { test_name: "Calcium", abbreviation: "Ca", unit: "mg/dL", category: "chemistry", display_order: 8 },
          { test_name: "Total Protein", abbreviation: "TP", unit: "g/dL", category: "hepatology", display_order: 9 },
          { test_name: "Albumin", abbreviation: "ALB", unit: "g/dL", category: "hepatology", display_order: 10 },
          { test_name: "Total Bilirubin", abbreviation: "TBIL", unit: "mg/dL", category: "hepatology", display_order: 11 },
          { test_name: "Alkaline Phosphatase", abbreviation: "ALP", unit: "U/L", category: "hepatology", display_order: 12 },
          { test_name: "Alanine Aminotransferase", abbreviation: "ALT", unit: "U/L", category: "hepatology", display_order: 13 },
          { test_name: "Aspartate Aminotransferase", abbreviation: "AST", unit: "U/L", category: "hepatology", display_order: 14 }
        ]
      },
      lipid: {
        name: "Lipid Panel",
        description: "Cholesterol and triglyceride tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Total Cholesterol", abbreviation: "CHOL", unit: "mg/dL", category: "lipids", display_order: 1 },
          { test_name: "LDL Cholesterol", abbreviation: "LDL", unit: "mg/dL", category: "lipids", display_order: 2 },
          { test_name: "HDL Cholesterol", abbreviation: "HDL", unit: "mg/dL", category: "lipids", display_order: 3 },
          { test_name: "Triglycerides", abbreviation: "TRIG", unit: "mg/dL", category: "lipids", display_order: 4 }
        ]
      },
      liver: {
        name: "Liver Function Panel",
        description: "Liver enzyme and function tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Alanine Aminotransferase", abbreviation: "ALT", unit: "U/L", category: "hepatology", display_order: 1 },
          { test_name: "Aspartate Aminotransferase", abbreviation: "AST", unit: "U/L", category: "hepatology", display_order: 2 },
          { test_name: "Alkaline Phosphatase", abbreviation: "ALP", unit: "U/L", category: "hepatology", display_order: 3 },
          { test_name: "Gamma-glutamyl Transferase", abbreviation: "GGT", unit: "U/L", category: "hepatology", display_order: 4 },
          { test_name: "Total Bilirubin", abbreviation: "TBIL", unit: "mg/dL", category: "hepatology", display_order: 5 },
          { test_name: "Direct Bilirubin", abbreviation: "DBIL", unit: "mg/dL", category: "hepatology", display_order: 6 },
          { test_name: "Total Protein", abbreviation: "TP", unit: "g/dL", category: "hepatology", display_order: 7 },
          { test_name: "Albumin", abbreviation: "ALB", unit: "g/dL", category: "hepatology", display_order: 8 },
          { test_name: "Somatomedin C", abbreviation: "IGF-1", unit: "ng/mL", category: "endocrinology", display_order: 9 }
        ]
      },
      thyroid: {
        name: "Thyroid Panel",
        description: "Thyroid hormone tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Thyroid Stimulating Hormone", abbreviation: "TSH", unit: "mIU/L", category: "endocrinology", display_order: 1 },
          { test_name: "Free T4", abbreviation: "FT4", unit: "ng/dL", category: "endocrinology", display_order: 2 },
          { test_name: "Free T3", abbreviation: "FT3", unit: "pg/mL", category: "endocrinology", display_order: 3 },
          { test_name: "Total T4", abbreviation: "T4", unit: "μg/dL", category: "endocrinology", display_order: 4 },
          { test_name: "Total T3", abbreviation: "T3", unit: "ng/dL", category: "endocrinology", display_order: 5 }
        ]
      },
      renal: {
        name: "Renal Function Panel",
        description: "Kidney function tests - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Blood Urea Nitrogen", abbreviation: "BUN", unit: "mg/dL", category: "chemistry", display_order: 1 },
          { test_name: "Creatinine", abbreviation: "CREA", unit: "mg/dL", category: "chemistry", display_order: 2 },
          { test_name: "Estimated GFR", abbreviation: "eGFR", unit: "mL/min/1.73m²", category: "chemistry", display_order: 3 },
          { test_name: "Sodium", abbreviation: "Na", unit: "mmol/L", category: "chemistry", display_order: 4 },
          { test_name: "Potassium", abbreviation: "K", unit: "mmol/L", category: "chemistry", display_order: 5 },
          { test_name: "Chloride", abbreviation: "Cl", unit: "mmol/L", category: "chemistry", display_order: 6 }
        ]
      },
      diabetes: {
        name: "Diabetes Panel",
        description: "Blood sugar and diabetes markers - enter your lab's values and reference ranges",
        tests: [
          { test_name: "Glucose", abbreviation: "GLU", unit: "mg/dL", category: "endocrinology", display_order: 1 },
          { test_name: "Hemoglobin A1c", abbreviation: "HbA1c", unit: "%", category: "endocrinology", display_order: 2 },
          { test_name: "Estimated Average Glucose", abbreviation: "eAG", unit: "mg/dL", category: "endocrinology", display_order: 3 }
        ]
      }
    });
  }
}

// Create and export singleton instance
export const labTestComponentApi = new LabTestComponentApi();
export default labTestComponentApi;