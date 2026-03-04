/**
 * Vital Data Aggregation Utilities
 *
 * Provides smart aggregation for large vital sign datasets.
 * Aggregation is display-only - raw data is preserved for statistics and export.
 */

import { VitalDataPoint } from '../components/medical/vitals/types';

export type AggregationPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface AggregatedDataPoint {
  date: string;           // Start of period (ISO date string)
  periodLabel: string;    // Display label (e.g., "Jan 2020", "Week of Jan 1")
  average: number;
  min: number;
  max: number;
  count: number;          // Number of readings in period
  // For blood pressure, we also track secondary values
  secondaryAverage?: number | null;
  secondaryMin?: number | null;
  secondaryMax?: number | null;
}

export interface AggregationResult {
  aggregatedPoints: AggregatedDataPoint[];
  period: AggregationPeriod | null;
  totalRawPoints: number;
}

/**
 * Determine aggregation period based on data time span and density
 *
 * Thresholds (time-span based):
 * - < 6 months: No aggregation (raw data)
 * - 6 months - 2 years: Weekly aggregation
 * - 2 - 5 years: Bi-weekly aggregation
 * - 5+ years: Monthly aggregation
 *
 * Density override:
 * - Any day with > 10 readings (e.g., CGM data): Daily aggregation
 *   regardless of time span. Detected by peak day, not average,
 *   so it works even when CGM data covers only part of the range.
 */
export function getAggregationPeriod(dataPoints: VitalDataPoint[]): AggregationPeriod | null {
  if (dataPoints.length === 0) return null;

  const dates = dataPoints.map(p => new Date(p.recorded_date));
  const oldest = Math.min(...dates.map(d => d.getTime()));
  const newest = Math.max(...dates.map(d => d.getTime()));
  const spanDays = Math.max(1, (newest - oldest) / (1000 * 60 * 60 * 24));

  // Density check: count readings per calendar day (local timezone).
  // If ANY day has >10 readings (e.g., CGM data), aggregate to daily.
  // This works regardless of total time span or how many days have CGM data.
  // Uses local date parts to avoid UTC midnight date-shift issues.
  const countsByDay = new Map<string, number>();
  for (const p of dataPoints) {
    const d = new Date(p.recorded_date);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
  }
  const maxPerDay = Math.max(...countsByDay.values());
  if (maxPerDay > 10) {
    return 'daily';
  }

  // Less than 6 months: no aggregation needed
  if (spanDays <= 180) return null;

  // 6 months to 2 years: weekly
  if (spanDays <= 730) return 'weekly';

  // 2 to 5 years: bi-weekly
  if (spanDays <= 1825) return 'biweekly';

  // 5+ years: monthly
  return 'monthly';
}

/**
 * Get the start of period for a given date
 */
function getPeriodStart(date: Date, period: AggregationPeriod): Date {
  const d = new Date(date);

  switch (period) {
    case 'daily':
      d.setHours(0, 0, 0, 0);
      return d;

    case 'weekly': {
      // Start of week (Sunday)
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    case 'biweekly': {
      // Start of bi-weekly period (aligned to year start)
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const daysSinceYearStart = Math.floor((d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const biweekNumber = Math.floor(daysSinceYearStart / 14);
      const biweekStart = new Date(startOfYear);
      biweekStart.setDate(biweekStart.getDate() + biweekNumber * 14);
      biweekStart.setHours(0, 0, 0, 0);
      return biweekStart;
    }

    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth(), 1);

    default:
      return d;
  }
}

/**
 * Get display label for a period
 */
function getPeriodLabel(date: Date, period: AggregationPeriod): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (period) {
    case 'daily':
      return date.toISOString().split('T')[0];

    case 'weekly':
      return `Week of ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

    case 'biweekly': {
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 13);
      if (date.getMonth() === endDate.getMonth()) {
        return `${months[date.getMonth()]} ${date.getDate()}-${endDate.getDate()}, ${date.getFullYear()}`;
      }
      // Handle month boundary crossing
      return `${months[date.getMonth()]} ${date.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }

    case 'monthly':
      return `${months[date.getMonth()]} ${date.getFullYear()}`;

    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Aggregate data points by period
 *
 * Groups data points by time period and calculates statistics for each group.
 * For vitals with secondary values (like blood pressure), aggregates both.
 */
export function aggregateDataPoints(
  dataPoints: VitalDataPoint[],
  period: AggregationPeriod
): AggregatedDataPoint[] {
  if (dataPoints.length === 0) return [];

  // Group data points by period
  const groups = new Map<string, VitalDataPoint[]>();

  for (const point of dataPoints) {
    const date = new Date(point.recorded_date);
    const periodStart = getPeriodStart(date, period);
    const key = periodStart.toISOString();

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(point);
  }

  // Calculate aggregated values for each group
  const aggregatedPoints: AggregatedDataPoint[] = [];

  for (const [key, points] of groups) {
    const periodDate = new Date(key);
    const values = points.map(p => p.value);
    const secondaryValues = points
      .map(p => p.secondary_value)
      .filter((v): v is number => v !== null && v !== undefined);

    const aggregatedPoint: AggregatedDataPoint = {
      date: periodDate.toISOString(),
      periodLabel: getPeriodLabel(periodDate, period),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: points.length
    };

    // Add secondary value statistics if present
    if (secondaryValues.length > 0) {
      aggregatedPoint.secondaryAverage = secondaryValues.reduce((a, b) => a + b, 0) / secondaryValues.length;
      aggregatedPoint.secondaryMin = Math.min(...secondaryValues);
      aggregatedPoint.secondaryMax = Math.max(...secondaryValues);
    }

    aggregatedPoints.push(aggregatedPoint);
  }

  // Sort by date (oldest first for chart display)
  return aggregatedPoints.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Smart aggregation based on data time span
 *
 * Automatically determines the appropriate aggregation period based on the
 * time span of the data and aggregates accordingly.
 *
 * @returns Aggregation result with aggregated points, period used, and total raw points
 */
export function smartAggregateVitalData(dataPoints: VitalDataPoint[]): AggregationResult {
  const period = getAggregationPeriod(dataPoints);

  if (period === null) {
    // No aggregation needed - return empty aggregated points
    return {
      aggregatedPoints: [],
      period: null,
      totalRawPoints: dataPoints.length
    };
  }

  const aggregatedPoints = aggregateDataPoints(dataPoints, period);

  return {
    aggregatedPoints,
    period,
    totalRawPoints: dataPoints.length
  };
}

/**
 * Convert aggregated data points to chart-compatible format
 *
 * Creates data points suitable for Recharts with min/max ranges for area display.
 */
export function convertToChartData(aggregatedPoints: AggregatedDataPoint[]): {
  date: string;
  value: number;
  min: number;
  max: number;
  secondaryValue?: number | null;
  secondaryMin?: number | null;
  secondaryMax?: number | null;
  count: number;
  periodLabel: string;
}[] {
  // Data is already sorted oldest-first from aggregateDataPoints
  return aggregatedPoints.map(point => ({
    date: point.date.split('T')[0],
    value: point.average,
    min: point.min,
    max: point.max,
    secondaryValue: point.secondaryAverage,
    secondaryMin: point.secondaryMin,
    secondaryMax: point.secondaryMax,
    count: point.count,
    periodLabel: point.periodLabel
  }));
}

/**
 * Get human-readable description of aggregation
 */
export function getAggregationDescription(
  period: AggregationPeriod | null,
  rawCount: number,
  aggregatedCount: number
): string {
  if (period === null) {
    return `${rawCount} data points`;
  }

  const periodLabels: Record<AggregationPeriod, string> = {
    daily: 'daily',
    weekly: 'weekly',
    biweekly: 'bi-weekly',
    monthly: 'monthly'
  };

  return `${rawCount} data points (${aggregatedCount} ${periodLabels[period]} averages displayed)`;
}
