/**
 * Centralized exports for all custom hooks
 */

export * from './useApi';
export * from './useGlobalData';
export * from './useAdminData';

// Medical data hooks
export { useMedicalData } from './useMedicalData';
export { useAuth, AuthProvider, TokenManager } from './useAuth';
export { useLabResults } from './useLabResults';

// Data management hooks
export { default as useFiltering } from './useFiltering';
export { default as useSorting } from './useSorting';
export { default as useDataManagement } from './useDataManagement';
