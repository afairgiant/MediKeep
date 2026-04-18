import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TestComponentCatalog from '../TestComponentCatalog';

// Mock Mantine components to avoid MantineProvider requirement
vi.mock('@mantine/core', () => ({
  Stack: ({ children, ...props }: any) => (
    <div data-testid="mantine-stack" {...props}>
      {children}
    </div>
  ),
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TextInput: ({ placeholder, ...props }: any) => (
    <input placeholder={placeholder} data-testid="search-input" {...props} />
  ),
  Select: ({ placeholder, ...props }: any) => (
    <select data-testid={`select-${placeholder}`} {...props} />
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Skeleton: ({ ...props }: any) => <div data-testid="skeleton" {...props} />,
  Alert: ({ children, title, ...props }: any) => (
    <div data-testid="alert" role="alert" {...props}>
      {title && <span>{title}</span>}
      {children}
    </div>
  ),
  SimpleGrid: ({ children, ...props }: any) => (
    <div data-testid="simple-grid" {...props}>
      {children}
    </div>
  ),
  SegmentedControl: ({ ...props }: any) => (
    <div data-testid="segmented-control" {...props} />
  ),
  Collapse: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  UnstyledButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

// Mock tabler icons
vi.mock('@tabler/icons-react', () => ({
  IconSearch: () => <span data-testid="icon-search" />,
  IconAlertCircle: () => <span data-testid="icon-alert-circle" />,
  IconSortAscending: () => <span data-testid="icon-sort" />,
  IconAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  IconChevronDown: () => <span data-testid="icon-chevron-down" />,
  IconChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, _opts?: Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : _key,
  }),
}));

// Mock labTestComponentApi
const mockGetComponentCatalog = vi.fn();
vi.mock('../../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: {
    getComponentCatalog: (...args: any[]) => mockGetComponentCatalog(...args),
  },
}));

// Mock labCategories constants
vi.mock('../../../../constants/labCategories', () => ({
  CATEGORY_SELECT_OPTIONS: [
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'hematology', label: 'Hematology' },
  ],
  getCategoryDisplayName: (cat: string) => `Display ${cat}`,
  getCategoryColor: (cat: string) => `color-${cat}`,
}));

// Mock AnimatedCardGrid - render children via renderCard
vi.mock('../../../shared/AnimatedCardGrid', () => ({
  default: ({ items, renderCard }: any) => (
    <div data-testid="animated-card-grid">
      {items.map((item: any, i: number) => (
        <div key={i}>{renderCard(item)}</div>
      ))}
    </div>
  ),
}));

// Mock EmptyState
vi.mock('../../../shared/EmptyState', () => ({
  default: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

// Mock TestComponentCatalogCard
vi.mock('../TestComponentCatalogCard', () => ({
  default: ({ entry, onClick }: any) => (
    <div
      data-testid="catalog-card"
      data-test-name={entry.test_name}
      data-unit={entry.unit ?? ''}
      onClick={() => onClick(entry.trend_test_name, entry.unit ?? null)}
    >
      {entry.test_name}
    </div>
  ),
}));

// Mock TestComponentTrendsPanel — captures both testName and unit so tests
// can verify unit-scoped trend requests.
vi.mock('../TestComponentTrendsPanel', () => ({
  default: ({ opened, testName, unit }: any) => (
    <div
      data-testid="trends-panel"
      data-opened={opened}
      data-test-name={testName}
      data-unit={unit ?? ''}
    />
  ),
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

const sampleCatalogItems = [
  {
    test_name: 'Glucose',
    trend_test_name: 'Glucose',
    abbreviation: 'GLU',
    latest_value: 95,
    latest_qualitative_value: null,
    unit: 'mg/dL',
    status: 'normal',
    category: 'chemistry',
    result_type: 'quantitative',
    reading_count: 5,
    trend_direction: 'stable',
    latest_date: '2024-01-15',
    ref_range_min: 70,
    ref_range_max: 100,
    ref_range_text: null,
  },
  {
    test_name: 'Hemoglobin',
    trend_test_name: 'Hemoglobin',
    abbreviation: 'HGB',
    latest_value: 14.2,
    latest_qualitative_value: null,
    unit: 'g/dL',
    status: 'normal',
    category: 'hematology',
    result_type: 'quantitative',
    reading_count: 3,
    trend_direction: 'stable',
    latest_date: '2024-01-10',
    ref_range_min: 12.0,
    ref_range_max: 17.5,
    ref_range_text: null,
  },
];

describe('TestComponentCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons initially', () => {
    // Keep the promise pending so loading state persists
    mockGetComponentCatalog.mockReturnValue(new Promise(() => {}));

    render(<TestComponentCatalog patientId={1} />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('renders catalog cards after data loads', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: sampleCatalogItems,
      total: 2,
    });

    render(<TestComponentCatalog patientId={1} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('catalog-card')).toHaveLength(2);
    });

    expect(screen.getByText('Glucose')).toBeInTheDocument();
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
  });

  it('shows empty state when no items returned', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: [],
      total: 0,
    });

    render(<TestComponentCatalog patientId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No Test Components Found')).toBeInTheDocument();
  });

  it('shows error alert on fetch failure', async () => {
    mockGetComponentCatalog.mockRejectedValue(new Error('Network error'));

    render(<TestComponentCatalog patientId={1} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls getComponentCatalog with the correct patientId', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: [],
      total: 0,
    });

    render(<TestComponentCatalog patientId={42} />);

    await waitFor(() => {
      expect(mockGetComponentCatalog).toHaveBeenCalled();
    });

    expect(mockGetComponentCatalog).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ limit: 500 }),
      expect.any(AbortSignal)
    );
  });

  it('renders search input and filter selects', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: sampleCatalogItems,
      total: 2,
    });

    render(<TestComponentCatalog patientId={1} />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tests...')).toBeInTheDocument();
  });

  it('groups items by category with category headers', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: sampleCatalogItems,
      total: 2,
    });

    render(<TestComponentCatalog patientId={1} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('catalog-card')).toHaveLength(2);
    });

    // Category display names should appear as group headers
    expect(screen.getByText('Display chemistry')).toBeInTheDocument();
    expect(screen.getByText('Display hematology')).toBeInTheDocument();
  });

  it('renders the trends panel component', async () => {
    mockGetComponentCatalog.mockResolvedValue({
      items: sampleCatalogItems,
      total: 2,
    });

    render(<TestComponentCatalog patientId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('trends-panel')).toBeInTheDocument();
    });
  });

  it('passes both testName and unit to the trends panel when a card is clicked', async () => {
    const multiUnitItems = [
      {
        ...sampleCatalogItems[0],
        test_name: 'Calcium',
        trend_test_name: 'Calcium',
        unit: 'mg/L',
      },
      {
        ...sampleCatalogItems[0],
        test_name: 'Calcium',
        trend_test_name: 'Calcium',
        unit: 'mmol/L',
        latest_value: 2.43,
      },
    ];
    mockGetComponentCatalog.mockResolvedValue({
      items: multiUnitItems,
      total: 2,
    });

    render(<TestComponentCatalog patientId={1} />);

    const cards = await screen.findAllByTestId('catalog-card');
    expect(cards).toHaveLength(2);

    fireEvent.click(cards[1]); // mmol/L card
    await waitFor(() => {
      const panel = screen.getByTestId('trends-panel');
      expect(panel.getAttribute('data-test-name')).toBe('Calcium');
      expect(panel.getAttribute('data-unit')).toBe('mmol/L');
    });
  });
});
