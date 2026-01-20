/**
 * TypeScript types for Vital Signs Trend Analysis
 */

export type VitalType =
  | 'blood_pressure'
  | 'heart_rate'
  | 'temperature'
  | 'weight'
  | 'oxygen_saturation'
  | 'respiratory_rate'
  | 'blood_glucose'
  | 'a1c'
  | 'bmi';

export interface VitalDataPoint {
  id: number;
  value: number;
  secondary_value?: number | null; // For blood pressure (diastolic)
  recorded_date: string;
}

export interface VitalTrendStatistics {
  count: number;
  latest: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  std_dev: number | null;
  // Secondary statistics for dual-value vitals like blood pressure
  secondary_latest?: number | null;
  secondary_average?: number | null;
  secondary_min?: number | null;
  secondary_max?: number | null;
  secondary_std_dev?: number | null;
}

export interface VitalReferenceRange {
  min: number | null;
  max: number | null;
  warning_min?: number | null;
  warning_max?: number | null;
}

export interface VitalTrendResponse {
  vital_type: VitalType;
  vital_type_label: string;
  unit: string;
  data_points: VitalDataPoint[];
  statistics: VitalTrendStatistics;
  reference_range: VitalReferenceRange | null;
}

export interface VitalTypeConfig {
  type: VitalType;
  label: string;
  unit: string;
  color: string;
  referenceRange: VitalReferenceRange | null;
  getValue: (vital: any) => number | null;
  getSecondaryValue?: (vital: any) => number | null;
}

// Vital type configurations with reference ranges
export const VITAL_TYPE_CONFIGS: Record<VitalType, VitalTypeConfig> = {
  blood_pressure: {
    type: 'blood_pressure',
    label: 'Blood Pressure (Systolic)',
    unit: 'mmHg',
    color: 'red',
    referenceRange: { min: 90, max: 120, warning_min: 60, warning_max: 180 },
    getValue: (vital) => vital.systolic_bp,
    getSecondaryValue: (vital) => vital.diastolic_bp,
  },
  heart_rate: {
    type: 'heart_rate',
    label: 'Heart Rate',
    unit: 'BPM',
    color: 'blue',
    referenceRange: { min: 60, max: 100, warning_min: 40, warning_max: 150 },
    getValue: (vital) => vital.heart_rate,
  },
  temperature: {
    type: 'temperature',
    label: 'Temperature',
    unit: '\u00B0F',
    color: 'green',
    referenceRange: { min: 97.0, max: 99.5, warning_min: 95.0, warning_max: 104.0 },
    getValue: (vital) => vital.temperature,
  },
  weight: {
    type: 'weight',
    label: 'Weight',
    unit: 'lbs',
    color: 'violet',
    referenceRange: null, // Varies by person
    getValue: (vital) => vital.weight,
  },
  oxygen_saturation: {
    type: 'oxygen_saturation',
    label: 'Oxygen Saturation',
    unit: '%',
    color: 'cyan',
    referenceRange: { min: 95, max: 100, warning_min: 85, warning_max: 100 },
    getValue: (vital) => vital.oxygen_saturation,
  },
  respiratory_rate: {
    type: 'respiratory_rate',
    label: 'Respiratory Rate',
    unit: '/min',
    color: 'yellow',
    referenceRange: { min: 12, max: 20, warning_min: 8, warning_max: 30 },
    getValue: (vital) => vital.respiratory_rate,
  },
  blood_glucose: {
    type: 'blood_glucose',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    color: 'orange',
    referenceRange: { min: 70, max: 100, warning_min: 54, warning_max: 180 },
    getValue: (vital) => vital.blood_glucose,
  },
  a1c: {
    type: 'a1c',
    label: 'Hemoglobin A1C',
    unit: '%',
    color: 'pink',
    referenceRange: { min: 4.0, max: 5.6, warning_min: 0, warning_max: 6.5 },
    getValue: (vital) => vital.a1c,
  },
  bmi: {
    type: 'bmi',
    label: 'BMI',
    unit: '',
    color: 'yellow',
    referenceRange: { min: 18.5, max: 24.9, warning_min: 16, warning_max: 30 },
    getValue: (vital) => vital.bmi,
  },
};
