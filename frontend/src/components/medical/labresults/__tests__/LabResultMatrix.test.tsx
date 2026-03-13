import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LabResultMatrix from '../LabResultMatrix';

// Mock Mantine components
vi.mock('@mantine/core', () => ({
  Stack: ({ children, ...props }: any) => <div data-testid="mantine-stack" {...props}>{children}</div>,
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Paper: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Loader: ({ ...props }: any) => <div data-testid="loader" {...props} />,
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Alert: ({ children, title, ...props }: any) => (
    <div data-testid="alert" role="alert" {...props}>
      {title && <span>{title}</span>}
      {children}
    </div>
  ),
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
  SegmentedControl: ({ data, value, onChange, ...props }: any) => (
    <div data-testid="segmented-control" {...props}>
      {data.map((d: any) => (
        <button key={d.value} onClick={() => onChange(d.value)} data-active={value === d.value}>
          {d.label}
        </button>
      ))}
    </div>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  MultiSelect: ({ ...props }: any) => <div data-testid="multi-select" {...props} />,
}));

// Stable t function reference (avoid infinite useEffect loop)
const stableT = (key: string, fallback: string, opts?: Record<string, unknown>) => {
  if (typeof fallback === 'string') {
    if (opts) {
      return fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ''));
    }
    return fallback;
  }
  return key;
};

// Mock react-i18next with stable t reference
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Stable formatDate function
const stableFormatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const stableDateFormatResult = {
  formatDate: stableFormatDate,
  locale: 'en-US',
};

// Mock useDateFormat with stable reference
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => stableDateFormatResult,
}));

// Mock labCategories
vi.mock('../../../../constants/labCategories', () => ({
  CATEGORY_SELECT_OPTIONS: [
    { value: 'hematology', label: 'Hematology' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'other', label: 'Other' },
  ],
  getCategoryDisplayName: (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1),
  getCategoryColor: (cat: string) => {
    const map: Record<string, string> = { hematology: 'red', chemistry: 'blue', other: 'gray' };
    return map[cat] || 'gray';
  },
}));

// Mock labTestComponentApi
const mockGetByLabResult = vi.fn();
vi.mock('../../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: {
    getByLabResult: (...args: any[]) => mockGetByLabResult(...args),
  },
}));

// Mock logger
vi.mock('../../../../services/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// --- Test data ---

const sampleLabResults = [
  { id: 1, test_name: 'Blood Panel', completed_date: '2024-01-10' },
  { id: 2, test_name: 'Blood Panel', completed_date: '2024-03-15' },
];

const sampleComponents1 = [
  {
    test_name: 'Hemoglobin',
    category: 'hematology',
    unit: 'g/dL',
    display_order: 1,
    result_type: 'quantitative',
    value: 14.2,
    status: 'normal',
    ref_range_min: 12.0,
    ref_range_max: 17.5,
  },
  {
    test_name: 'Glucose',
    category: 'chemistry',
    unit: 'mg/dL',
    display_order: 1,
    result_type: 'quantitative',
    value: 110,
    status: 'high',
    ref_range_min: 70,
    ref_range_max: 100,
  },
];

const sampleComponents2 = [
  {
    test_name: 'Hemoglobin',
    category: 'hematology',
    unit: 'g/dL',
    display_order: 1,
    result_type: 'quantitative',
    value: 13.8,
    status: 'normal',
    ref_range_min: 12.0,
    ref_range_max: 17.5,
  },
  {
    test_name: 'Glucose',
    category: 'chemistry',
    unit: 'mg/dL',
    display_order: 1,
    result_type: 'quantitative',
    value: 95,
    status: 'normal',
    ref_range_min: 70,
    ref_range_max: 100,
  },
];

describe('LabResultMatrix', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetByLabResult.mockReturnValue(new Promise(() => {}));
    render(<LabResultMatrix labResults={sampleLabResults} />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.getByText('Loading matrix data...')).toBeInTheDocument();
  });

  it('renders empty state with no lab results', async () => {
    render(<LabResultMatrix labResults={[]} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/No test components found/)).toBeInTheDocument();
  });

  it('renders empty state when lab results have no completed_date', async () => {
    render(<LabResultMatrix labResults={[{ id: 1, test_name: 'Test' }]} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('renders matrix table with valid data', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    });

    expect(screen.getByText('Glucose')).toBeInTheDocument();
    expect(screen.getByText('14.2')).toBeInTheDocument();
    expect(screen.getByText('13.8')).toBeInTheDocument();
  });

  it('shows error state when all API calls fail', async () => {
    mockGetByLabResult.mockRejectedValue(new Error('Network error'));

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders category headers', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    expect(screen.getByText('Hematology')).toBeInTheDocument();
  });

  it('renders the segmented control for filter modes', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByTestId('segmented-control')).toBeInTheDocument();
    });

    expect(screen.getByText('All (2)')).toBeInTheDocument();
    expect(screen.getByText('Abnormal Only')).toBeInTheDocument();
  });

  it('filters to abnormal only when clicked', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    });

    // Click "Abnormal Only"
    const user = userEvent.setup();
    await user.click(screen.getByText('Abnormal Only'));

    // Glucose is high in the first result, should still show
    await waitFor(() => {
      expect(screen.getByText('Glucose')).toBeInTheDocument();
    });
  });

  it('renders legend with all status types including borderline', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('Legend:')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(6); // Normal, High, Low, Critical, Abnormal, Borderline
  });

  it('renders status indicators (arrows) for abnormal values', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('110')).toBeInTheDocument();
    });

    // Check for the up arrow indicator (Glucose has status 'high')
    const arrowSpan = screen.getByLabelText('high');
    expect(arrowSpan).toBeInTheDocument();
    expect(arrowSpan.textContent).toBe('\u2191');
  });

  it('uses proper table semantics with scope attributes', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    const { container } = render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    });

    // Check for scope="col" on header ths
    const colHeaders = container.querySelectorAll('th[scope="col"]');
    expect(colHeaders.length).toBeGreaterThan(0);

    // Check for scope="row" on row headers (test names)
    const rowHeaders = container.querySelectorAll('th[scope="row"]');
    expect(rowHeaders.length).toBeGreaterThan(0);

    // Check for table aria-label
    const table = container.querySelector('table');
    expect(table).toHaveAttribute('aria-label');
  });

  it('renders summary text with correct counts', async () => {
    mockGetByLabResult
      .mockResolvedValueOnce({ data: sampleComponents1 })
      .mockResolvedValueOnce({ data: sampleComponents2 });

    render(<LabResultMatrix labResults={sampleLabResults} />);

    await waitFor(() => {
      expect(screen.getByText(/2 results/)).toBeInTheDocument();
    });

    expect(screen.getByText(/2 parameters/)).toBeInTheDocument();
  });
});
