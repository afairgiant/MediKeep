import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../../../test-utils/render';
import LabResultsComponentTable from '../LabResultsComponentTable';
import type { LabTestComponentForStack } from '../../../../services/api/labTestComponentApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
      const options = typeof fallback === 'object' && !Array.isArray(fallback) && typeof fallback !== 'string' ? fallback : opts;
      const str = typeof fallback === 'string' ? fallback : key;
      if (!options) return str;
      return Object.entries(options).reduce(
        (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
        str
      );
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d: string | null | undefined) => d ?? '—',
    dateInputFormat: 'MM/DD/YYYY',
  }),
}));

vi.mock('../../../adapters/DateInput', () => ({
  DateInput: ({ placeholder, onChange }: { placeholder?: string; onChange?: (_val: Date | null) => void }) => (
    <input
      placeholder={placeholder}
      data-testid={`date-input-${placeholder}`}
      onChange={e => onChange?.(e.target.value ? new Date(e.target.value) : null)}
    />
  ),
  default: ({ placeholder, onChange }: { placeholder?: string; onChange?: (_val: Date | null) => void }) => (
    <input
      placeholder={placeholder}
      data-testid={`date-input-${placeholder}`}
      onChange={e => onChange?.(e.target.value ? new Date(e.target.value) : null)}
    />
  ),
}));

vi.mock('../StatusBadge', () => ({
  default: ({ status }: { status?: string }) =>
    status ? <span data-testid="status-badge">{status}</span> : null,
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// TestComponentTrendsPanel fetches real trend data on open, which this file
// doesn't mock. Stub it down to a button that invokes the one prop under
// test here - onEditLegacyResult - so the panel's own behavior (covered by
// TestComponentTrendTable.test.tsx) doesn't need to be re-exercised, while
// still proving LabResultsComponentTable wires that prop correctly (#1025
// follow-up: Edit on a status_only point in the trend panel's Data Table
// must route to the same edit flow as a legacy row in the main table).
vi.mock('../TestComponentTrendsPanel', () => ({
  default: ({ onEditLegacyResult, onDeleteLegacyResult }: any) => (
    <>
      <button
        data-testid="fake-trends-panel-edit-trigger"
        onClick={() =>
          onEditLegacyResult?.({
            id: -42,
            result_type: 'status_only',
            status: 'abnormal',
            lab_result: { id: 42, test_name: 'A1C' },
          })
        }
      >
        fake trends panel edit
      </button>
      <button
        data-testid="fake-trends-panel-delete-trigger"
        onClick={() =>
          onDeleteLegacyResult?.({
            id: -42,
            result_type: 'status_only',
            status: 'abnormal',
            lab_result: { id: 42, test_name: 'A1C' },
          })
        }
      >
        fake trends panel delete
      </button>
    </>
  ),
}));

const makeComponent = (overrides: Partial<LabTestComponentForStack> = {}): LabTestComponentForStack => ({
  id: Math.floor(Math.random() * 10000),
  lab_result_id: 1,
  test_name: 'Glucose',
  canonical_test_name: 'Glucose',
  value: 95,
  unit: 'mg/dL',
  status: 'normal',
  ref_range_min: 70,
  ref_range_max: 100,
  completed_date: '2024-01-15',
  ...overrides,
});

const defaultLabResults = [
  { id: 1, test_name: 'CBC Panel', practitioner_id: 10 },
  { id: 2, test_name: 'Metabolic Panel', practitioner_id: 20 },
];

const defaultPractitioners = [
  { id: 10, name: 'Dr. Smith' },
  { id: 20, name: 'Dr. Jones' },
];

describe('LabResultsComponentTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no components provided', () => {
    render(
      <LabResultsComponentTable
        components={[]}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );
    expect(
      screen.getByText(/No test results match the current filters/i)
    ).toBeInTheDocument();
  });

  it('groups components by canonical_test_name and shows one summary row per unique test', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
      makeComponent({ id: 3, test_name: 'Hemoglobin', canonical_test_name: 'Hemoglobin', lab_result_id: 2, value: 14.5, completed_date: '2024-01-10' }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-hemoglobin')).toBeInTheDocument();
  });

  it('shows latest value in summary row (sorted by completed_date DESC)', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    const summaryRow = screen.getByTestId('summary-row-glucose');
    expect(summaryRow).toHaveTextContent('95 mg/dL');
  });

  it('shows expand button with count badge for all test groups', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('expand-btn-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('count-badge-glucose')).toHaveTextContent('1');
  });

  it('shows count badge with correct count for multi-reading groups', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('count-badge-glucose')).toHaveTextContent('2');
  });

  it('expands to show all readings (including latest) on expand button click', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.queryByTestId('history-row-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-row-2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    expect(screen.getByTestId('history-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-2')).toBeInTheDocument();
  });

  it('collapses individual test when expand button clicked again', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    expect(screen.getByTestId('history-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    expect(screen.queryByTestId('history-row-1')).not.toBeInTheDocument();
  });

  it('shows action icons in expanded rows when callbacks provided', () => {
    const components = [
      makeComponent({ id: 5, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95, lab_result_id: 99 }),
    ];
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    const row = screen.getByTestId('history-row-5');
    fireEvent.click(row.querySelector('[aria-label="Edit"]')!);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 5, lab_result_id: 99 }));
    fireEvent.click(row.querySelector('[aria-label="Delete"]')!);
    // onDelete takes the whole component (not just an id) so the caller can
    // branch on is_legacy the same way onEdit already does (#1025).
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 5, lab_result_id: 99 }));
  });

  it('shows both edit and delete for legacy (component-less) entries - delete routes through onDelete with is_legacy set, same as edit (#1025)', () => {
    const components = [
      makeComponent({
        id: -99,
        canonical_test_name: 'Ferritin',
        completed_date: '2024-01-15',
        value: 50,
        lab_result_id: 99,
        is_legacy: true,
      }),
    ];
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-btn-ferritin'));
    const row = screen.getByTestId('history-row--99');
    fireEvent.click(row.querySelector('[aria-label="Edit"]')!);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: -99, is_legacy: true }));
    fireEvent.click(row.querySelector('[aria-label="Delete"]')!);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: -99, lab_result_id: 99, is_legacy: true }));
  });

  it('wires the trends panel so editing a status_only trend point routes to the same onEdit as a legacy row in this table (#1025 follow-up)', () => {
    const onEdit = vi.fn();
    render(
      <LabResultsComponentTable
        components={[]}
        labResults={[...defaultLabResults, { id: 42, test_name: 'A1C', practitioner_id: 10 }]}
        practitioners={defaultPractitioners}
        onEdit={onEdit}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('fake-trends-panel-edit-trigger'));

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: -42,
        lab_result_id: 42,
        test_name: 'A1C',
        is_legacy: true,
      })
    );
  });

  it('wires the trends panel so deleting a legacy trend point routes to the same onDelete as a legacy row in this table (#1025 follow-up)', () => {
    const onDelete = vi.fn();
    render(
      <LabResultsComponentTable
        components={[]}
        labResults={[...defaultLabResults, { id: 42, test_name: 'A1C', practitioner_id: 10 }]}
        practitioners={defaultPractitioners}
        onDelete={onDelete}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('fake-trends-panel-delete-trigger'));

    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: -42,
        lab_result_id: 42,
        test_name: 'A1C',
        is_legacy: true,
      })
    );
  });

  it('does not wire the trends panel edit route when no onEdit is provided', () => {
    render(
      <LabResultsComponentTable
        components={[]}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    // Should not throw when clicked with no onEditLegacyResult wired through.
    expect(() =>
      fireEvent.click(screen.getByTestId('fake-trends-panel-edit-trigger'))
    ).not.toThrow();
  });

  it('expands all tests via Expand All button', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
      makeComponent({ id: 3, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2024-01-10', value: 14.5 }),
      makeComponent({ id: 4, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2023-06-01', value: 13.9 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-all-btn'));
    // All readings (including latest) appear as expanded rows
    expect(screen.getByTestId('history-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-3')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-4')).toBeInTheDocument();
  });

  it('collapses all tests via Collapse All button after expand-all', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-all-btn'));
    expect(screen.getByTestId('history-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('expand-all-btn'));
    expect(screen.queryByTestId('history-row-1')).not.toBeInTheDocument();
  });

  it('header button stays Collapse All after individually collapsing one test when expand-all is active', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Glucose', completed_date: '2023-06-01', value: 88 }),
      makeComponent({ id: 3, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2024-01-10', value: 14.5 }),
      makeComponent({ id: 4, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2023-06-01', value: 13.9 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-all-btn'));
    // Collapse just Glucose — Hemoglobin remains expanded
    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    // Header must still read "Collapse All" because Hemoglobin is still expanded
    expect(screen.getByTestId('expand-all-btn')).toHaveTextContent('Collapse All');
    // Glucose rows gone, Hemoglobin rows still present
    expect(screen.queryByTestId('history-row-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-row-3')).toBeInTheDocument();
  });

  it('filters by search term', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2024-01-10', value: 14.5 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-hemoglobin')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'gluc' } });

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.queryByTestId('summary-row-hemoglobin')).not.toBeInTheDocument();
  });

  it('category filter "Other Tests" includes legacy entries with no category set', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', category: 'chemistry', completed_date: '2024-01-15', value: 95 }),
      makeComponent({
        id: -2,
        canonical_test_name: 'Ferritin',
        category: null,
        lab_result_id: 2,
        completed_date: '2024-01-10',
        value: 50,
        is_legacy: true,
      }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-ferritin')).toBeInTheDocument();

    const categoryInput = screen.getByPlaceholderText('Category');
    fireEvent.click(categoryInput);
    fireEvent.focus(categoryInput);
    fireEvent.click(screen.getByRole('option', { name: 'Other Tests' }));

    expect(screen.queryByTestId('summary-row-glucose')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-row-ferritin')).toBeInTheDocument();
  });

  it('filters by facility — initial state shows all, filter inputs are rendered', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', facility: 'Lab A' }),
      makeComponent({ id: 2, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2024-01-10', facility: 'Lab B' }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    // Both visible initially
    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-hemoglobin')).toBeInTheDocument();

    // Date filter inputs are in the DOM (inside Mantine Collapse, rendered even when collapsed)
    expect(screen.getByTestId('date-input-Date from')).toBeInTheDocument();
    expect(screen.getByTestId('date-input-Date to')).toBeInTheDocument();
  });

  it('date filter excludes components without a date when from-date is set', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15' }),
      makeComponent({ id: 2, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: null, ordered_date: null }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    // Both visible initially
    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-hemoglobin')).toBeInTheDocument();

    // Set a from-date — the dateless Hemoglobin should be excluded
    fireEvent.change(screen.getByTestId('date-input-Date from'), { target: { value: '2024-01-01' } });

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.queryByTestId('summary-row-hemoglobin')).not.toBeInTheDocument();
  });

  it('shows result count', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Hemoglobin', lab_result_id: 2, completed_date: '2024-01-10', value: 14.5 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
  });

  it('groups by test_name when canonical_test_name is absent', () => {
    const components = [
      makeComponent({ id: 1, test_name: 'WBC', canonical_test_name: undefined, completed_date: '2024-01-15', value: 7.5 }),
      makeComponent({ id: 2, test_name: 'WBC', canonical_test_name: undefined, completed_date: '2023-06-01', value: 6.8 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('summary-row-wbc')).toBeInTheDocument();
    expect(screen.getByTestId('count-badge-wbc')).toHaveTextContent('2');
  });

  it('groups tests by category and shows category header rows', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', category: 'chemistry', completed_date: '2024-01-15', value: 95 }),
      makeComponent({ id: 2, canonical_test_name: 'Hemoglobin', category: 'hematology', lab_result_id: 2, completed_date: '2024-01-10', value: 14.5 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('category-row-chemistry')).toBeInTheDocument();
    expect(screen.getByTestId('category-row-hematology')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-hemoglobin')).toBeInTheDocument();
  });

  it('sorts tests within a category alphabetically by name, not by date', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Zinc', category: 'chemistry', completed_date: '2024-03-01', value: 90, lab_result_id: 1 }),
      makeComponent({ id: 2, canonical_test_name: 'Albumin', category: 'chemistry', completed_date: '2024-01-01', value: 4.2, lab_result_id: 1 }),
      makeComponent({ id: 3, canonical_test_name: 'Magnesium', category: 'chemistry', completed_date: '2024-02-01', value: 2.0, lab_result_id: 1 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    const summaryRows = screen.getAllByTestId(/^summary-row-/);
    const order = summaryRows.map(row => row.getAttribute('data-testid'));
    expect(order).toEqual([
      'summary-row-albumin',
      'summary-row-magnesium',
      'summary-row-zinc',
    ]);
  });

  it('collapses category group when category header is clicked', () => {
    const components = [
      makeComponent({ id: 1, canonical_test_name: 'Glucose', category: 'chemistry', completed_date: '2024-01-15', value: 95 }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('category-row-chemistry'));
    expect(screen.queryByTestId('summary-row-glucose')).not.toBeInTheDocument();
    // Click again to expand
    fireEvent.click(screen.getByTestId('category-row-chemistry'));
    expect(screen.getByTestId('summary-row-glucose')).toBeInTheDocument();
  });

  it('shows qualitative value for qualitative result type', () => {
    const components = [
      makeComponent({
        id: 1,
        canonical_test_name: 'HIV Test',
        result_type: 'qualitative',
        qualitative_value: 'negative',
        value: null,
        unit: null,
        completed_date: '2024-01-15',
      }),
    ];

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
      />,
      { skipRouter: true }
    );

    const summaryRow = screen.getByTestId('summary-row-hiv test');
    expect(summaryRow).toHaveTextContent('Negative');
  });
});
