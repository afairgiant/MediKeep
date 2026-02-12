/**
 * Centralized exports for all custom hooks
 */

export * from './useApi.js';
export * from './useGlobalData';
export * from './useAdminData';

// Form handling hooks
export { useFormHandlers } from './useFormHandlers';

// Medical data hooks
export { useMedicalData } from './useMedicalData';
export { useAuth, AuthProvider, TokenManager } from './useAuth';
export { useLabResults } from './useLabResults';

// Timezone hook
export { useTimezone } from './useTimezone';

// Data management hooks
export { default as useFiltering } from './useFiltering';
export { default as useSorting } from './useSorting';
export { default as useDataManagement } from './useDataManagement';

// Activity tracking hooks
export { 
  useActivityTracker, 
  useApiActivityTracker, 
  useNavigationActivityTracker 
} from './useActivityTracker';

// Custom reports hooks
export { useCustomReports } from './useCustomReports';
export { useReportTemplates } from './useReportTemplates';

// File count management hooks
export { useEntityFileCounts } from './useEntityFileCounts';

// View modal navigation hooks
export { useViewModalNavigation } from './useViewModalNavigation';

// Treatment relationship management hooks
export { useTreatmentRelationships } from './useTreatmentRelationships';

// View mode persistence hooks
export { usePersistedViewMode } from './usePersistedViewMode';
