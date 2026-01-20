/**
 * Vitals Trend Analysis Components
 *
 * Extensible system for visualizing vital sign trends over time.
 *
 * To add a new vital type:
 * 1. Add the type to the VitalType union in types.ts
 * 2. Add configuration to VITAL_TYPE_CONFIGS in types.ts:
 *    - type: The vital type key
 *    - label: Display name
 *    - unit: Unit of measurement
 *    - color: Mantine color name for UI elements
 *    - referenceRange: Normal range { min, max, warning_min?, warning_max? } or null
 *    - getValue: Function to extract the value from a vitals record
 *    - getSecondaryValue?: Optional function for dual values (like blood pressure)
 *
 * Example adding a new vital:
 * ```typescript
 * // In types.ts
 * export type VitalType = ... | 'new_vital';
 *
 * export const VITAL_TYPE_CONFIGS: Record<VitalType, VitalTypeConfig> = {
 *   ...existing,
 *   new_vital: {
 *     type: 'new_vital',
 *     label: 'New Vital Name',
 *     unit: 'units',
 *     color: 'teal',
 *     referenceRange: { min: 0, max: 100 },
 *     getValue: (vital) => vital.new_vital_field,
 *   },
 * };
 * ```
 */

export { default as VitalTrendChart } from './VitalTrendChart';
export { default as VitalTrendTable } from './VitalTrendTable';
export { default as VitalTrendsPanel } from './VitalTrendsPanel';

export type {
  VitalType,
  VitalDataPoint,
  VitalTrendStatistics,
  VitalReferenceRange,
  VitalTrendResponse,
  VitalTypeConfig
} from './types';

export { VITAL_TYPE_CONFIGS } from './types';
