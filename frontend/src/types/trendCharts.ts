/**
 * Types for trend chart reports feature.
 * Matches backend schemas in app/schemas/trend_charts.py.
 */

export interface VitalChartRequest {
  vital_type: string;
  date_from: string | null;
  date_to: string | null;
}

export interface LabTestChartRequest {
  test_name: string;
  date_from: string | null;
  date_to: string | null;
}

export interface TrendChartSelection {
  vital_charts: VitalChartRequest[];
  lab_test_charts: LabTestChartRequest[];
}

export interface AvailableVitalType {
  vital_type: string;
  display_name: string;
  unit: string;
  count: number;
}

export interface AvailableLabTest {
  test_name: string;
  unit: string;
  count: number;
}

export interface AvailableTrendData {
  vital_types: AvailableVitalType[];
  lab_test_names: AvailableLabTest[];
}
