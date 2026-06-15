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

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d: string | null | undefined) => d ?? '—',
    dateInputFormat: 'MM/DD/YYYY',
  }),
}));

vi.mock('../../adapters/DateInput', () => ({
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

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
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
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <LabResultsComponentTable
        components={components}
        labResults={defaultLabResults}
        practitioners={defaultPractitioners}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
      { skipRouter: true }
    );

    fireEvent.click(screen.getByTestId('expand-btn-glucose'));
    const row = screen.getByTestId('history-row-5');
    fireEvent.click(row.querySelector('[aria-label="View"]')!);
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 5, lab_result_id: 99 }));
    fireEvent.click(row.querySelector('[aria-label="Edit"]')!);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 5, lab_result_id: 99 }));
    fireEvent.click(row.querySelector('[aria-label="Delete"]')!);
    expect(onDelete).toHaveBeenCalledWith(5); // comp.id, not comp.lab_result_id
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

  it('filters by facility', () => {
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
