/**
 * Types for trend chart reports feature.
 * Matches backend schemas in app/schemas/trend_charts.py.
 */

export type TrendChartTimeRange =
  | 'all'
  | '3months'
  | '6months'
  | '1year'
  | '2years'
  | '5years';

export interface VitalChartRequest {
  vital_type: string;
  time_range: TrendChartTimeRange;
}

export interface LabTestChartRequest {
  test_name: string;
  time_range: TrendChartTimeRange;
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
