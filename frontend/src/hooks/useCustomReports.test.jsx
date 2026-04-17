import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomReports } from './useCustomReports';

vi.mock('../services/api/index.js', () => ({
  apiService: {
    getCustomReportSummary: vi.fn(),
    generateCustomReport: vi.fn(),
  },
}));

vi.mock('../services/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

// Minimal dataSummary mimicking the shape returned by the backend. Each
// category has a `records` list with id + fields the builder uses.
const dataSummary = {
  total_records: 3,
  categories: {
    medications: {
      count: 2,
      has_more: false,
      records: [
        { id: 101, title: 'Med A', key_info: '100mg' },
        { id: 102, title: 'Med B', key_info: '50mg' },
      ],
    },
    lab_results: {
      count: 1,
      has_more: false,
      records: [{ id: 201, title: 'Glucose', key_info: 'mg/dL' }],
    },
  },
};

describe('useCustomReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyTemplate', () => {
    it('hydrates selectedRecords from record_ids using the data summary', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 1,
        name: 'Test Template',
        selected_records: [
          { category: 'medications', record_ids: [101, 102] },
          { category: 'lab_results', record_ids: [201] },
        ],
        trend_charts: null,
        report_settings: {},
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      expect(result.current.selectedRecords.medications).toEqual({
        101: { id: 101, title: 'Med A', key_info: '100mg' },
        102: { id: 102, title: 'Med B', key_info: '50mg' },
      });
      expect(result.current.selectedRecords.lab_results).toEqual({
        201: { id: 201, title: 'Glucose', key_info: 'mg/dL' },
      });
      expect(result.current.selectedCount).toBe(3);
    });

    it('silently drops record ids that no longer exist in the summary', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 1,
        name: 'Stale',
        selected_records: [
          { category: 'medications', record_ids: [101, 999] },
        ],
        trend_charts: null,
        report_settings: {},
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      // Only the still-existing record should appear in state.
      expect(Object.keys(result.current.selectedRecords.medications)).toEqual([
        '101',
      ]);
    });

    it('restores trend charts from the template', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 1,
        name: 'Trends',
        selected_records: [],
        trend_charts: {
          vital_charts: [
            {
              vital_type: 'blood_pressure',
              date_from: '2025-01-01',
              date_to: '2025-06-30',
            },
          ],
          lab_test_charts: [
            {
              test_name: 'Glucose',
              date_from: '2025-01-01',
              date_to: '2025-06-30',
            },
          ],
        },
        report_settings: {},
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      expect(result.current.trendCharts.vital_charts).toHaveLength(1);
      expect(result.current.trendCharts.vital_charts[0].vital_type).toBe(
        'blood_pressure'
      );
      expect(result.current.trendCharts.lab_test_charts).toHaveLength(1);
      expect(result.current.trendChartCount).toBe(2);
    });

    it('applies report_settings without leaking a nested trend_charts blob', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 1,
        name: 'Settings',
        selected_records: [],
        trend_charts: null,
        // Older saved blobs may still have trend_charts nested here. The
        // apply step must strip it so it doesn't pollute reportSettings.
        report_settings: {
          report_title: 'Quarterly Review',
          include_patient_info: false,
          include_summary: true,
          trend_charts: { vital_charts: [], lab_test_charts: [] },
        },
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      expect(result.current.reportSettings.report_title).toBe(
        'Quarterly Review'
      );
      expect(result.current.reportSettings.include_patient_info).toBe(false);
      expect(result.current.reportSettings.include_summary).toBe(true);
      expect(result.current.reportSettings).not.toHaveProperty('trend_charts');
    });

    it('is a no-op when template is falsy', () => {
      const { result } = renderHook(() => useCustomReports());
      const before = result.current.selectedRecords;

      act(() => {
        result.current.applyTemplate(null, dataSummary);
      });

      expect(result.current.selectedRecords).toBe(before);
    });
  });
});
