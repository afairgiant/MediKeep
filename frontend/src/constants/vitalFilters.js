/**
 * Constants for vital signs filtering types
 * Used to prevent typos and maintain consistency across vitals filtering
 */

export const VITAL_FILTER_TYPES = {
  ALL: 'all',
  WITH_BLOOD_PRESSURE: 'with_bp',
  WITH_HEART_RATE: 'with_heart_rate',
  WITH_TEMPERATURE: 'with_temperature',
  WITH_WEIGHT: 'with_weight',
  WITH_BLOOD_GLUCOSE: 'with_blood_glucose',
  WITH_A1C: 'with_a1c',
  WITH_VITALS: 'with_vitals',
  COMPLETE: 'complete',
};

export const VITAL_FILTER_LABELS = {
  [VITAL_FILTER_TYPES.ALL]: 'All Records',
  [VITAL_FILTER_TYPES.WITH_BLOOD_PRESSURE]: 'With Blood Pressure',
  [VITAL_FILTER_TYPES.WITH_HEART_RATE]: 'With Heart Rate',
  [VITAL_FILTER_TYPES.WITH_TEMPERATURE]: 'With Temperature',
  [VITAL_FILTER_TYPES.WITH_WEIGHT]: 'With Weight',
  [VITAL_FILTER_TYPES.WITH_BLOOD_GLUCOSE]: 'With Blood Glucose',
  [VITAL_FILTER_TYPES.WITH_A1C]: 'With A1C',
  [VITAL_FILTER_TYPES.WITH_VITALS]: 'With Core Vitals',
  [VITAL_FILTER_TYPES.COMPLETE]: 'Complete Records',
};