import BaseApiService from './baseApi';
import logger from '../logger';

/**
 * Symptom severity levels matching backend SymptomSeverity enum
 */
export type SymptomSeverity = 'mild' | 'moderate' | 'severe' | 'critical';

/**
 * Symptom status matching backend SymptomStatus enum
 */
export type SymptomStatus = 'active' | 'resolved' | 'recurring';

/**
 * Time of day for symptom occurrence
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Impact level for symptom occurrence
 */
export type ImpactLevel = 'no_impact' | 'mild' | 'moderate' | 'severe' | 'debilitating';

/**
 * Medication relationship types
 */
export type MedicationRelationshipType = 'side_effect' | 'helped_by' | 'related_to';

// ============================================================================
// Symptom (Parent Definition) Interfaces
// ============================================================================

/**
 * Symptom definition (parent record)
 */
export interface Symptom {
  id: number;
  patient_id: number;
  symptom_name: string;
  category?: string;
  status: SymptomStatus;
  is_chronic: boolean;
  typical_triggers?: string[];
  general_notes?: string;
  tags?: string[];
  first_occurrence_date: string; // ISO date string
  last_occurrence_date?: string; // ISO date string
  occurrence_count?: number;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * Data for creating a new symptom definition
 */
export interface SymptomCreate {
  patient_id: number;
  symptom_name: string;
  category?: string;
  status?: SymptomStatus;
  is_chronic?: boolean;
  typical_triggers?: string[];
  general_notes?: string;
  tags?: string[];
  first_occurrence_date: string; // ISO date string
}

/**
 * Data for updating a symptom definition
 */
export interface SymptomUpdate {
  symptom_name?: string;
  category?: string;
  status?: SymptomStatus;
  is_chronic?: boolean;
  typical_triggers?: string[];
  general_notes?: string;
  tags?: string[];
}

// ============================================================================
// Symptom Occurrence (Individual Episodes) Interfaces
// ============================================================================

/**
 * Symptom occurrence (individual episode)
 */
export interface SymptomOccurrence {
  id: number;
  symptom_id: number;
  occurrence_date: string; // ISO date string
  severity: SymptomSeverity;
  pain_scale?: number; // 0-10
  duration?: string;
  time_of_day?: TimeOfDay;
  location?: string;
  triggers?: string[];
  relief_methods?: string[];
  associated_symptoms?: string[];
  impact_level?: ImpactLevel;
  resolved_date?: string; // ISO date string
  resolution_notes?: string;
  notes?: string;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * Data for creating a new symptom occurrence
 */
export interface SymptomOccurrenceCreate {
  symptom_id: number;
  occurrence_date: string;
  severity: SymptomSeverity;
  pain_scale?: number;
  duration?: string;
  time_of_day?: TimeOfDay;
  location?: string;
  triggers?: string[];
  relief_methods?: string[];
  associated_symptoms?: string[];
  impact_level?: ImpactLevel;
  resolved_date?: string;
  resolution_notes?: string;
  notes?: string;
}

/**
 * Data for updating a symptom occurrence
 */
export interface SymptomOccurrenceUpdate {
  occurrence_date?: string;
  severity?: SymptomSeverity;
  pain_scale?: number;
  duration?: string;
  time_of_day?: TimeOfDay;
  location?: string;
  triggers?: string[];
  relief_methods?: string[];
  associated_symptoms?: string[];
  impact_level?: ImpactLevel;
  resolved_date?: string;
  resolution_notes?: string;
  notes?: string;
}

// ============================================================================
// Junction Table Interfaces
// ============================================================================

/**
 * Symptom-Condition relationship
 */
export interface SymptomCondition {
  id: number;
  symptom_id: number;
  condition_id: number;
  relevance_note?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating symptom-condition link
 */
export interface SymptomConditionCreate {
  symptom_id: number;
  condition_id: number;
  relevance_note?: string;
}

/**
 * Symptom-Medication relationship
 */
export interface SymptomMedication {
  id: number;
  symptom_id: number;
  medication_id: number;
  relationship_type: MedicationRelationshipType;
  relevance_note?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating symptom-medication link
 */
export interface SymptomMedicationCreate {
  symptom_id: number;
  medication_id: number;
  relationship_type?: MedicationRelationshipType;
  relevance_note?: string;
}

/**
 * Symptom-Treatment relationship
 */
export interface SymptomTreatment {
  id: number;
  symptom_id: number;
  treatment_id: number;
  relevance_note?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating symptom-treatment link
 */
export interface SymptomTreatmentCreate {
  symptom_id: number;
  treatment_id: number;
  relevance_note?: string;
}

// ============================================================================
// Stats & Timeline Interfaces
// ============================================================================

/**
 * Symptom statistics response
 */
export interface SymptomStats {
  total_symptoms: number;
  active_symptoms: number;
  resolved_symptoms: number;
  chronic_symptoms: number;
  total_occurrences: number;
  most_frequent_symptom?: string;
  most_frequent_count?: number;
}

/**
 * Timeline data point
 */
export interface TimelineDataPoint {
  date: string;
  symptom_name: string;
  severity: SymptomSeverity;
  pain_scale?: number;
  occurrence_id: number;
  symptom_id: number;
}

/**
 * Filter parameters for symptom queries
 */
export interface SymptomFilters {
  patient_id?: number;
  status?: SymptomStatus;
  search?: string;
  skip?: number;
  limit?: number;
}

/**
 * Symptom API Service
 * Handles all API calls related to symptom tracking with two-level hierarchy:
 * - Symptom (parent definition)
 * - SymptomOccurrence (individual episodes)
 */
class SymptomApiService extends BaseApiService {
  constructor() {
    super('/symptoms');
  }

  // ============================================================================
  // Symptom Definition (Parent) Methods
  // ============================================================================

  /**
   * Get all symptom definitions with optional filters
   */
  async getAll(filters: SymptomFilters = {}, signal?: AbortSignal): Promise<Symptom[]> {
    try {
      logger.debug('symptom_api_get_all', {
        filters,
        component: 'SymptomApiService',
      });

      const params: Record<string, string> = {};

      if (filters.patient_id !== undefined) params.patient_id = String(filters.patient_id);
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.skip !== undefined) params.skip = String(filters.skip);
      if (filters.limit !== undefined) params.limit = String(filters.limit);

      const url = this.buildUrl('/', params);
      const response = await this.get(url, { signal });

      logger.info('symptom_api_get_all_success', {
        count: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_all_error', {
        error: error.message,
        filters,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get a single symptom definition by ID
   */
  async getById(id: number, signal?: AbortSignal): Promise<Symptom> {
    try {
      logger.debug('symptom_api_get_by_id', {
        id,
        component: 'SymptomApiService',
      });

      const response = await this.get(`/${id}`, { signal });

      logger.info('symptom_api_get_by_id_success', {
        id,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_by_id_error', {
        id,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Create a new symptom definition
   */
  async create(data: SymptomCreate, signal?: AbortSignal): Promise<Symptom> {
    try {
      logger.info('symptom_api_create', {
        symptomName: data.symptom_name,
        isChronic: data.is_chronic,
        component: 'SymptomApiService',
      });

      const response = await this.post('/', data, { signal });

      logger.info('symptom_api_create_success', {
        id: response?.id,
        symptomName: data.symptom_name,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_create_error', {
        symptomName: data.symptom_name,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Update an existing symptom definition
   */
  async update(id: number, data: SymptomUpdate, signal?: AbortSignal): Promise<Symptom> {
    try {
      logger.info('symptom_api_update', {
        id,
        updates: Object.keys(data),
        component: 'SymptomApiService',
      });

      const response = await this.put(`/${id}`, data, { signal });

      logger.info('symptom_api_update_success', {
        id,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_update_error', {
        id,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Delete a symptom definition (and all its occurrences via cascade)
   */
  async delete(id: number, signal?: AbortSignal): Promise<void> {
    try {
      logger.info('symptom_api_delete', {
        id,
        component: 'SymptomApiService',
      });

      await super.delete(`/${id}`, { signal });

      logger.info('symptom_api_delete_success', {
        id,
        component: 'SymptomApiService',
      });
    } catch (error: any) {
      logger.error('symptom_api_delete_error', {
        id,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  // ============================================================================
  // Symptom Occurrence (Individual Episodes) Methods
  // ============================================================================

  /**
   * Log a new occurrence/episode of a symptom
   */
  async createOccurrence(
    symptomId: number,
    data: Omit<SymptomOccurrenceCreate, 'symptom_id'>,
    signal?: AbortSignal
  ): Promise<SymptomOccurrence> {
    try {
      logger.info('symptom_api_create_occurrence', {
        symptomId,
        severity: data.severity,
        component: 'SymptomApiService',
      });

      const response = await this.post(`/${symptomId}/occurrences`, data, { signal });

      logger.info('symptom_api_create_occurrence_success', {
        symptomId,
        occurrenceId: response?.id,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_create_occurrence_error', {
        symptomId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get all occurrences for a specific symptom
   */
  async getOccurrences(
    symptomId: number,
    skip: number = 0,
    limit: number = 100,
    signal?: AbortSignal
  ): Promise<SymptomOccurrence[]> {
    try {
      logger.debug('symptom_api_get_occurrences', {
        symptomId,
        skip,
        limit,
        component: 'SymptomApiService',
      });

      const params: Record<string, string> = {
        skip: String(skip),
        limit: String(limit),
      };

      const url = this.buildUrl(`/${symptomId}/occurrences`, params);
      const response = await this.get(url, { signal });

      logger.info('symptom_api_get_occurrences_success', {
        symptomId,
        count: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_occurrences_error', {
        symptomId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get a specific symptom occurrence by ID
   */
  async getOccurrence(
    symptomId: number,
    occurrenceId: number,
    signal?: AbortSignal
  ): Promise<SymptomOccurrence> {
    try {
      logger.debug('symptom_api_get_occurrence', {
        symptomId,
        occurrenceId,
        component: 'SymptomApiService',
      });

      const response = await this.get(`/${symptomId}/occurrences/${occurrenceId}`, { signal });

      logger.info('symptom_api_get_occurrence_success', {
        symptomId,
        occurrenceId,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_occurrence_error', {
        symptomId,
        occurrenceId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Update a symptom occurrence
   */
  async updateOccurrence(
    symptomId: number,
    occurrenceId: number,
    data: SymptomOccurrenceUpdate,
    signal?: AbortSignal
  ): Promise<SymptomOccurrence> {
    try {
      logger.info('symptom_api_update_occurrence', {
        symptomId,
        occurrenceId,
        updates: Object.keys(data),
        component: 'SymptomApiService',
      });

      const response = await this.put(`/${symptomId}/occurrences/${occurrenceId}`, data, { signal });

      logger.info('symptom_api_update_occurrence_success', {
        symptomId,
        occurrenceId,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_update_occurrence_error', {
        symptomId,
        occurrenceId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Delete a symptom occurrence
   */
  async deleteOccurrence(
    symptomId: number,
    occurrenceId: number,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      logger.info('symptom_api_delete_occurrence', {
        symptomId,
        occurrenceId,
        component: 'SymptomApiService',
      });

      await super.delete(`/${symptomId}/occurrences/${occurrenceId}`, { signal });

      logger.info('symptom_api_delete_occurrence_success', {
        symptomId,
        occurrenceId,
        component: 'SymptomApiService',
      });
    } catch (error: any) {
      logger.error('symptom_api_delete_occurrence_error', {
        symptomId,
        occurrenceId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  // ============================================================================
  // Stats & Timeline Methods
  // ============================================================================

  /**
   * Get symptom statistics for a patient
   */
  async getStats(patientId?: number, signal?: AbortSignal): Promise<SymptomStats> {
    try {
      logger.debug('symptom_api_get_stats', {
        patientId,
        component: 'SymptomApiService',
      });

      const params: Record<string, string> = {};
      if (patientId !== undefined) params.patient_id = String(patientId);

      const url = this.buildUrl('/stats', params);
      const response = await this.get(url, { signal });

      logger.info('symptom_api_get_stats_success', {
        totalSymptoms: response?.total_symptoms,
        activeSymptoms: response?.active_symptoms,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_stats_error', {
        patientId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get symptom timeline data for visualization
   */
  async getTimeline(
    patientId?: number,
    startDate?: string,
    endDate?: string,
    signal?: AbortSignal
  ): Promise<TimelineDataPoint[]> {
    try {
      logger.debug('symptom_api_get_timeline', {
        patientId,
        startDate,
        endDate,
        component: 'SymptomApiService',
      });

      const params: Record<string, string> = {};
      if (patientId !== undefined) params.patient_id = String(patientId);
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const url = this.buildUrl('/timeline', params);
      const response = await this.get(url, { signal });

      logger.info('symptom_api_get_timeline_success', {
        patientId,
        dataPointCount: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_timeline_error', {
        patientId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  // ============================================================================
  // Junction Table Relationship Methods
  // ============================================================================

  /**
   * Link a symptom to a condition
   */
  async linkCondition(
    symptomId: number,
    conditionId: number,
    relevanceNote?: string,
    signal?: AbortSignal
  ): Promise<SymptomCondition> {
    try {
      logger.info('symptom_api_link_condition', {
        symptomId,
        conditionId,
        component: 'SymptomApiService',
      });

      const data: SymptomConditionCreate = {
        symptom_id: symptomId,
        condition_id: conditionId,
        relevance_note: relevanceNote,
      };

      const response = await this.post(`/${symptomId}/link-condition`, data, { signal });

      logger.info('symptom_api_link_condition_success', {
        symptomId,
        conditionId,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_link_condition_error', {
        symptomId,
        conditionId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get all conditions linked to a symptom
   */
  async getLinkedConditions(symptomId: number, signal?: AbortSignal): Promise<SymptomCondition[]> {
    try {
      logger.debug('symptom_api_get_linked_conditions', {
        symptomId,
        component: 'SymptomApiService',
      });

      const response = await this.get(`/${symptomId}/conditions`, { signal });

      logger.info('symptom_api_get_linked_conditions_success', {
        symptomId,
        count: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_linked_conditions_error', {
        symptomId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Unlink a symptom from a condition
   */
  async unlinkCondition(
    symptomId: number,
    conditionId: number,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      logger.info('symptom_api_unlink_condition', {
        symptomId,
        conditionId,
        component: 'SymptomApiService',
      });

      await super.delete(`/${symptomId}/unlink-condition/${conditionId}`, { signal });

      logger.info('symptom_api_unlink_condition_success', {
        symptomId,
        conditionId,
        component: 'SymptomApiService',
      });
    } catch (error: any) {
      logger.error('symptom_api_unlink_condition_error', {
        symptomId,
        conditionId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Link a symptom to a medication
   */
  async linkMedication(
    symptomId: number,
    medicationId: number,
    relationshipType: MedicationRelationshipType = 'related_to',
    relevanceNote?: string,
    signal?: AbortSignal
  ): Promise<SymptomMedication> {
    try {
      logger.info('symptom_api_link_medication', {
        symptomId,
        medicationId,
        relationshipType,
        component: 'SymptomApiService',
      });

      const data: SymptomMedicationCreate = {
        symptom_id: symptomId,
        medication_id: medicationId,
        relationship_type: relationshipType,
        relevance_note: relevanceNote,
      };

      const response = await this.post(`/${symptomId}/link-medication`, data, { signal });

      logger.info('symptom_api_link_medication_success', {
        symptomId,
        medicationId,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_link_medication_error', {
        symptomId,
        medicationId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get all medications linked to a symptom
   */
  async getLinkedMedications(symptomId: number, signal?: AbortSignal): Promise<SymptomMedication[]> {
    try {
      logger.debug('symptom_api_get_linked_medications', {
        symptomId,
        component: 'SymptomApiService',
      });

      const response = await this.get(`/${symptomId}/medications`, { signal });

      logger.info('symptom_api_get_linked_medications_success', {
        symptomId,
        count: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_linked_medications_error', {
        symptomId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Unlink a symptom from a medication
   */
  async unlinkMedication(
    symptomId: number,
    medicationId: number,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      logger.info('symptom_api_unlink_medication', {
        symptomId,
        medicationId,
        component: 'SymptomApiService',
      });

      await super.delete(`/${symptomId}/unlink-medication/${medicationId}`, { signal });

      logger.info('symptom_api_unlink_medication_success', {
        symptomId,
        medicationId,
        component: 'SymptomApiService',
      });
    } catch (error: any) {
      logger.error('symptom_api_unlink_medication_error', {
        symptomId,
        medicationId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Link a symptom to a treatment
   */
  async linkTreatment(
    symptomId: number,
    treatmentId: number,
    relevanceNote?: string,
    signal?: AbortSignal
  ): Promise<SymptomTreatment> {
    try {
      logger.info('symptom_api_link_treatment', {
        symptomId,
        treatmentId,
        component: 'SymptomApiService',
      });

      const data: SymptomTreatmentCreate = {
        symptom_id: symptomId,
        treatment_id: treatmentId,
        relevance_note: relevanceNote,
      };

      const response = await this.post(`/${symptomId}/link-treatment`, data, { signal });

      logger.info('symptom_api_link_treatment_success', {
        symptomId,
        treatmentId,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_link_treatment_error', {
        symptomId,
        treatmentId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Get all treatments linked to a symptom
   */
  async getLinkedTreatments(symptomId: number, signal?: AbortSignal): Promise<SymptomTreatment[]> {
    try {
      logger.debug('symptom_api_get_linked_treatments', {
        symptomId,
        component: 'SymptomApiService',
      });

      const response = await this.get(`/${symptomId}/treatments`, { signal });

      logger.info('symptom_api_get_linked_treatments_success', {
        symptomId,
        count: response?.length || 0,
        component: 'SymptomApiService',
      });

      return response;
    } catch (error: any) {
      logger.error('symptom_api_get_linked_treatments_error', {
        symptomId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  /**
   * Unlink a symptom from a treatment
   */
  async unlinkTreatment(
    symptomId: number,
    treatmentId: number,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      logger.info('symptom_api_unlink_treatment', {
        symptomId,
        treatmentId,
        component: 'SymptomApiService',
      });

      await super.delete(`/${symptomId}/unlink-treatment/${treatmentId}`, { signal });

      logger.info('symptom_api_unlink_treatment_success', {
        symptomId,
        treatmentId,
        component: 'SymptomApiService',
      });
    } catch (error: any) {
      logger.error('symptom_api_unlink_treatment_error', {
        symptomId,
        treatmentId,
        error: error.message,
        component: 'SymptomApiService',
      });
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Helper method to build URL with query parameters
   */
  private buildUrl(path: string, params: Record<string, string>): string {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return queryString ? `${path}?${queryString}` : path;
  }
}

// Export singleton instance
export const symptomApi = new SymptomApiService();
export default symptomApi;
