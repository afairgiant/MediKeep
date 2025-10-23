/**
 * Environment variable helper for Vite
 * Provides type-safe access to environment variables
 */

/**
 * Get environment variables with proper typing
 */
export const env = {
  API_URL: import.meta.env.VITE_API_URL || '/api/v1',
  NAME: import.meta.env.VITE_NAME || 'MediKeep',
  DEBUG: import.meta.env.VITE_DEBUG === 'true',
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
};

/**
 * Check if running in development mode
 */
export const isDevelopment = () => import.meta.env.DEV;

/**
 * Check if running in production mode
 */
export const isProduction = () => import.meta.env.PROD;

/**
 * Get API base URL
 */
export const getApiUrl = () => env.API_URL;
