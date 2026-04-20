import { describe, it, expect } from 'vitest';
import {
  convertToChartData,
  AggregatedDataPoint,
} from './vitalDataAggregation';

const makePoint = (
  dateISO: string,
  overrides: Partial<AggregatedDataPoint> = {}
): AggregatedDataPoint => ({
  date: dateISO,
  periodLabel: 'Jan 2024',
  average: 72,
  min: 60,
  max: 85,
  count: 3,
  ...overrides,
});

describe('convertToChartData', () => {
  it('returns empty array for empty input', () => {
    expect(convertToChartData([])).toEqual([]);
  });

  it('includes a numeric timestamp for each point', () => {
    const points = [makePoint('2024-01-15T00:00:00.000Z')];
    const result = convertToChartData(points);
    expect(typeof result[0].timestamp).toBe('number');
    expect(result[0].timestamp).toBe(new Date('2024-01-15T00:00:00.000Z').getTime());
  });

  it('timestamp matches the date field', () => {
    const iso = '2024-06-01T12:00:00.000Z';
    const result = convertToChartData([makePoint(iso)]);
    expect(result[0].timestamp).toBe(new Date(iso).getTime());
    expect(result[0].date).toBe('2024-06-01');
  });

  it('preserves ordering and maps all fields', () => {
    const points = [
      makePoint('2024-01-01T00:00:00.000Z', { average: 70, min: 60, max: 80, count: 2, periodLabel: 'Jan 2024' }),
      makePoint('2024-02-01T00:00:00.000Z', { average: 75, min: 65, max: 85, count: 4, periodLabel: 'Feb 2024' }),
    ];
    const result = convertToChartData(points);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(70);
    expect(result[0].min).toBe(60);
    expect(result[0].max).toBe(80);
    expect(result[0].count).toBe(2);
    expect(result[0].periodLabel).toBe('Jan 2024');
    expect(result[1].value).toBe(75);
  });

  it('timestamps are ordered oldest-first matching input order', () => {
    const points = [
      makePoint('2024-01-01T00:00:00.000Z'),
      makePoint('2024-06-01T00:00:00.000Z'),
    ];
    const result = convertToChartData(points);
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
  });

  it('handles a single data point without throwing', () => {
    const points = [makePoint('2024-03-15T00:00:00.000Z')];
    expect(() => convertToChartData(points)).not.toThrow();
    expect(convertToChartData(points)).toHaveLength(1);
  });

  it('maps secondary value fields when present', () => {
    const points = [
      makePoint('2024-01-01T00:00:00.000Z', {
        secondaryAverage: 80,
        secondaryMin: 70,
        secondaryMax: 90,
      }),
    ];
    const result = convertToChartData(points);
    expect(result[0].secondaryValue).toBe(80);
    expect(result[0].secondaryMin).toBe(70);
    expect(result[0].secondaryMax).toBe(90);
  });

  it('secondary value fields are undefined when not provided', () => {
    const result = convertToChartData([makePoint('2024-01-01T00:00:00.000Z')]);
    expect(result[0].secondaryValue).toBeUndefined();
    expect(result[0].secondaryMin).toBeUndefined();
    expect(result[0].secondaryMax).toBeUndefined();
  });
});
