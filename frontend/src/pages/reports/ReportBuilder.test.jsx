import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import ReportBuilder from './ReportBuilder';

const mockReports = vi.hoisted(() => ({ value: null }));

vi.mock('../../hooks/useCustomReports', () => ({
  useCustomReports: () => mockReports.value,
}));

vi.mock('../../hooks/useReportTemplates', () => ({
  useReportTemplates: () => ({
    templates: [],
    loading: false,
    error: null,
    isSaving: false,
    fetchTemplates: vi.fn(),
    loadTemplateForReport: vi.fn(),
    saveTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('../../components/reports/TrendChartSelector', () => ({
  default: () => <div>trend-chart-selector</div>,
}));

const dataSummary = {
  total_records: 2,
  categories: {
    medications: {
      count: 2,
      has_more: false,
      records: [
        { id: 1, title: 'Med A' },
        { id: 2, title: 'Med B' },
      ],
    },
  },
};

const buildReports = (overrides = {}) => ({
  dataSummary,
  selectedRecords: {},
  reportSettings: {},
  trendCharts: { vital_charts: [], lab_test_charts: [] },
  loading: false,
  error: null,
  isGenerating: false,
  selectedCount: 0,
  hasSelections: false,
  trendChartCount: 0,
  fetchDataSummary: vi.fn(),
  toggleRecordSelection: vi.fn(),
  toggleCategorySelection: vi.fn(),
  clearCategorySelection: vi.fn(),
  selectAllCategories: vi.fn(),
  clearRecordSelections: vi.fn(),
  clearTrendCharts: vi.fn(),
  updateReportSettings: vi.fn(),
  applyTemplate: vi.fn(),
  generateReport: vi.fn(),
  clearError: vi.fn(),
  addVitalChart: vi.fn(),
  removeVitalChart: vi.fn(),
  updateVitalChartDates: vi.fn(),
  addLabTestChart: vi.fn(),
  removeLabTestChart: vi.fn(),
  updateLabTestChartDates: vi.fn(),
  getSelectedRecordsForAPI: vi.fn(),
  ...overrides,
});

const position = (a, b) =>
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;

describe('ReportBuilder flow', () => {
  beforeEach(() => {
    mockReports.value = buildReports();
  });

  it('shows step headings with guidance text', () => {
    render(<ReportBuilder />);

    expect(screen.getByText('builder.flow.chooseTitle')).toBeTruthy();
    expect(screen.getByText('builder.flow.chooseDescription')).toBeTruthy();
    expect(screen.getByText('builder.flow.selectTitle')).toBeTruthy();
    expect(screen.getByText('builder.flow.recordsDescription')).toBeTruthy();
  });

  it('places the bulk controls above the record type tabs', () => {
    render(<ReportBuilder />);

    const selectAll = screen.getByRole('button', {
      name: 'builder.buttons.selectAllRecordTypes',
    });
    const firstTab = screen.getAllByRole('tab')[0];

    expect(position(selectAll, firstTab)).toBeTruthy();
  });

  it('select all record types calls selectAllCategories', () => {
    render(<ReportBuilder />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'builder.buttons.selectAllRecordTypes',
      })
    );

    expect(mockReports.value.selectAllCategories).toHaveBeenCalledWith(
      dataSummary.categories
    );
  });

  it('disables Clear when the active view has nothing selected', () => {
    // Charts are selected but records are not: Clear is for the records view.
    mockReports.value = buildReports({
      trendChartCount: 1,
      hasSelections: true,
    });
    render(<ReportBuilder />);

    expect(
      screen.getByRole('button', { name: 'builder.buttons.clearSelections' })
        .disabled
    ).toBe(true);
  });

  it('clears only records in the records view', () => {
    mockReports.value = buildReports({
      selectedCount: 1,
      hasSelections: true,
      trendChartCount: 1,
    });
    render(<ReportBuilder />);

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.buttons.clearSelections' })
    );

    expect(mockReports.value.clearRecordSelections).toHaveBeenCalledTimes(1);
    expect(mockReports.value.clearTrendCharts).not.toHaveBeenCalled();
  });

  it('clears only charts, and hides Select All, in the trend charts view', () => {
    mockReports.value = buildReports({
      selectedCount: 1,
      hasSelections: true,
      trendChartCount: 1,
    });
    render(<ReportBuilder />);

    fireEvent.click(screen.getByText('shared:labels.trendCharts'));

    expect(screen.getByText('builder.flow.chartsDescription')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: 'builder.buttons.selectAllRecordTypes',
      })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.buttons.clearSelections' })
    );

    expect(mockReports.value.clearTrendCharts).toHaveBeenCalledTimes(1);
    expect(mockReports.value.clearRecordSelections).not.toHaveBeenCalled();
  });

  it('has a single generate button, in the final step', () => {
    mockReports.value = buildReports({
      selectedCount: 1,
      hasSelections: true,
    });
    render(<ReportBuilder />);

    expect(screen.getByText('builder.flow.generateTitle')).toBeTruthy();

    const buttons = screen.getAllByRole('button', {
      name: /builder\.buttons\.generateReport/,
    });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(mockReports.value.generateReport).toHaveBeenCalledTimes(1);
  });

  it('disables the generate button when nothing is selected', () => {
    render(<ReportBuilder />);

    const buttons = screen.getAllByRole('button', {
      name: /builder\.buttons\.generateReport/,
    });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].disabled).toBe(true);
  });

  it('styles the view toggle as two distinct options', () => {
    render(<ReportBuilder />);

    const records = screen.getByRole('radio', {
      name: /shared:labels.medicalRecords/,
    });
    const charts = screen.getByRole('radio', {
      name: /shared:labels.trendCharts/,
    });

    expect(records.closest('.report-view-toggle')).not.toBeNull();
    expect(records.checked).toBe(true);
    expect(charts.checked).toBe(false);
  });
});
