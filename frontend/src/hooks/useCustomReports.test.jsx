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

    it('keeps ids missing from the summary as stubs so they still reach the report', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 1,
        name: 'Beyond Summary',
        selected_records: [
          { category: 'medications', record_ids: [101, 999] },
        ],
        trend_charts: null,
        report_settings: {},
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      // Both the summary-known record and the stub must be retained.
      const meds = result.current.selectedRecords.medications;
      expect(Object.keys(meds).sort()).toEqual(['101', '999']);
      // Known id gets the full record; unknown id gets a minimal placeholder.
      expect(meds[101]).toMatchObject({ id: 101, title: 'Med A' });
      expect(meds[999]).toEqual({ id: 999 });
      // getSelectedRecordsForAPI must carry the stub id through to the
      // generation payload.
      expect(result.current.getSelectedRecordsForAPI()).toEqual([
        { category: 'medications', record_ids: [101, 999] },
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
      // Legacy templates (no unit field) must hydrate to unit: null so the UI
      // can surface the "unit not specified" warning instead of silently
      // dropping data.
      expect(result.current.trendCharts.lab_test_charts[0].unit).toBeNull();
      expect(result.current.trendChartCount).toBe(2);
    });

    it('preserves explicit units when rehydrating a modern template', () => {
      const { result } = renderHook(() => useCustomReports());

      const template = {
        id: 2,
        name: 'Calcium trends',
        selected_records: [],
        trend_charts: {
          vital_charts: [],
          lab_test_charts: [
            {
              test_name: 'Calcium',
              unit: 'mg/L',
              date_from: null,
              date_to: null,
            },
            {
              test_name: 'Calcium',
              unit: 'mmol/L',
              date_from: null,
              date_to: null,
            },
          ],
        },
        report_settings: {},
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      const charts = result.current.trendCharts.lab_test_charts;
      expect(charts).toHaveLength(2);
      expect(charts.map(c => c.unit).sort()).toEqual(['mg/L', 'mmol/L']);
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

    it('resets report_settings to defaults rather than merging prior in-progress edits', () => {
      const { result } = renderHook(() => useCustomReports());

      // Simulate user edits before applying the template.
      act(() => {
        result.current.updateReportSettings({
          report_title: 'Mid-edit Title',
          include_patient_info: false,
        });
      });

      const template = {
        id: 1,
        name: 'Partial',
        selected_records: [],
        trend_charts: null,
        // Template only defines report_title; everything else must fall back
        // to DEFAULT_REPORT_SETTINGS, not to the user's pre-apply values.
        report_settings: { report_title: 'From Template' },
      };

      act(() => {
        result.current.applyTemplate(template, dataSummary);
      });

      expect(result.current.reportSettings.report_title).toBe(
        'From Template'
      );
      // User had toggled this to false; applying the template must restore
      // the default of true because the template omitted the key.
      expect(result.current.reportSettings.include_patient_info).toBe(true);
      expect(result.current.reportSettings.include_summary).toBe(true);
      expect(result.current.reportSettings.include_profile_picture).toBe(true);
      expect(result.current.reportSettings.date_range).toBeNull();
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

  describe('lab test chart actions (unit-scoped)', () => {
    it('allows the same test_name with different units', () => {
      const { result } = renderHook(() => useCustomReports());

      act(() => {
        result.current.addLabTestChart('Calcium', 'mg/L');
        result.current.addLabTestChart('Calcium', 'mmol/L');
      });

      expect(result.current.trendCharts.lab_test_charts).toHaveLength(2);
      const pairs = result.current.trendCharts.lab_test_charts.map(c => [
        c.test_name,
        c.unit,
      ]);
      expect(pairs).toEqual([
        ['Calcium', 'mg/L'],
        ['Calcium', 'mmol/L'],
      ]);
    });

    it('dedupes same (test_name, unit) case-insensitively', () => {
      const { result } = renderHook(() => useCustomReports());

      act(() => {
        result.current.addLabTestChart('Calcium', 'mg/L');
        result.current.addLabTestChart('CALCIUM', 'MG/L');
      });

      expect(result.current.trendCharts.lab_test_charts).toHaveLength(1);
    });

    it('removes only the matching unit', () => {
      const { result } = renderHook(() => useCustomReports());

      act(() => {
        result.current.addLabTestChart('Calcium', 'mg/L');
        result.current.addLabTestChart('Calcium', 'mmol/L');
        result.current.removeLabTestChart('Calcium', 'mg/L');
      });

      expect(result.current.trendCharts.lab_test_charts).toHaveLength(1);
      expect(result.current.trendCharts.lab_test_charts[0].unit).toBe('mmol/L');
    });

    it('updates dates only on the matching unit', () => {
      const { result } = renderHook(() => useCustomReports());

      act(() => {
        result.current.addLabTestChart('Calcium', 'mg/L');
        result.current.addLabTestChart('Calcium', 'mmol/L');
        result.current.updateLabTestChartDates(
          'Calcium',
          'mg/L',
          '2025-01-01',
          '2025-12-31'
        );
      });

      const charts = result.current.trendCharts.lab_test_charts;
      const mg = charts.find(c => c.unit === 'mg/L');
      const mmol = charts.find(c => c.unit === 'mmol/L');
      expect(mg.date_from).toBe('2025-01-01');
      expect(mg.date_to).toBe('2025-12-31');
      // The mmol/L chart still has the defaults the hook set on add; what
      // matters is that updating mg/L didn't touch it.
      expect(mmol.date_from).not.toBe('2025-01-01');
    });
  });
});
