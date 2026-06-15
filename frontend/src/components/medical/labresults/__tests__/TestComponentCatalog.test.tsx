import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TestComponentCatalog from '../TestComponentCatalog';
import { LabTestComponentForStack } from '../../../../services/api/labTestComponentApi';

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
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  ActionIcon: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Mock DateInput adapter
vi.mock('../../../adapters/DateInput', () => ({
  DateInput: ({ placeholder, onChange, ...props }: any) => (
    <input
      type="text"
      placeholder={placeholder}
      data-testid={`date-input-${placeholder}`}
      onChange={e => onChange && onChange(e.target.value ? new Date(e.target.value) : null)}
      {...props}
    />
  ),
  default: ({ placeholder, onChange, ...props }: any) => (
    <input
      type="text"
      placeholder={placeholder}
      data-testid={`date-input-${placeholder}`}
      onChange={e => onChange && onChange(e.target.value ? new Date(e.target.value) : null)}
      {...props}
    />
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
  IconChevronUp: () => <span data-testid="icon-chevron-up" />,
  IconFilter: () => <span data-testid="icon-filter" />,
  IconX: () => <span data-testid="icon-x" />,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, _opts?: Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : _key,
  }),
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

// Mock TestComponentTrendsPanel
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

// Mock labChartKey
vi.mock('../../../../utils/labChartKey', () => ({
  labChartKey: (name: string, unit: string | null) =>
    unit ? `${name}||${unit}` : name,
}));

// Sample raw component data (LabTestComponentForStack shape)
const makeComponent = (
  overrides: Partial<LabTestComponentForStack> = {}
): LabTestComponentForStack => ({
  id: 1,
  lab_result_id: 10,
  test_name: 'Glucose',
  canonical_test_name: 'Glucose',
  abbreviation: 'GLU',
  test_code: 'GLU',
  value: 95,
  unit: 'mg/dL',
  ref_range_min: 70,
  ref_range_max: 100,
  ref_range_text: null,
  status: 'normal',
  category: 'chemistry',
  result_type: 'quantitative',
  qualitative_value: null,
  notes: null,
  completed_date: '2024-01-15',
  ordered_date: null,
  facility: 'Main Lab',
  ...overrides,
});

const sampleComponents: LabTestComponentForStack[] = [
  makeComponent({ id: 1, lab_result_id: 10, test_name: 'Glucose', canonical_test_name: 'Glucose', category: 'chemistry' }),
  makeComponent({ id: 2, lab_result_id: 11, test_name: 'Hemoglobin', canonical_test_name: 'Hemoglobin', abbreviation: 'HGB', unit: 'g/dL', value: 14.2, ref_range_min: 12.0, ref_range_max: 17.5, status: 'normal', category: 'hematology', completed_date: '2024-01-10' }),
];

const sampleLabResults = [
  { id: 10, test_name: 'CBC Panel', practitioner_id: 1 },
  { id: 11, test_name: 'Basic Metabolic Panel', practitioner_id: null },
];

const samplePractitioners = [
  { id: 1, name: 'Dr. Smith' },
];

const defaultProps = {
  components: sampleComponents,
  labResults: sampleLabResults,
  practitioners: samplePractitioners,
  loading: false,
  patientId: 1,
};

describe('TestComponentCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons when loading prop is true', () => {
    render(<TestComponentCatalog {...defaultProps} loading={true} components={[]} />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('renders catalog cards from provided components', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    expect(screen.getAllByTestId('catalog-card')).toHaveLength(2);
    expect(screen.getByText('Glucose')).toBeInTheDocument();
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
  });

  it('shows empty state when no components are provided', () => {
    render(<TestComponentCatalog {...defaultProps} components={[]} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Test Results Found')).toBeInTheDocument();
  });

  it('groups items by category with category headers', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    expect(screen.getByText('Display chemistry')).toBeInTheDocument();
    expect(screen.getByText('Display hematology')).toBeInTheDocument();
  });

  it('renders search input always visible', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('filters by search term (test name)', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'Glucose' },
    });

    const cards = screen.getAllByTestId('catalog-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Glucose');
  });

  it('filters by panel name (parent lab result test_name)', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    // "CBC Panel" is the test_name of lab_result_id=10, which has the Glucose component
    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'CBC Panel' },
    });

    const cards = screen.getAllByTestId('catalog-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Glucose');
  });

  it('renders the trends panel component', () => {
    render(<TestComponentCatalog {...defaultProps} />);

    expect(screen.getByTestId('trends-panel')).toBeInTheDocument();
  });

  it('passes both testName and unit to the trends panel when a card is clicked', async () => {
    const multiUnitComponents: LabTestComponentForStack[] = [
      makeComponent({ id: 3, test_name: 'Calcium', canonical_test_name: 'Calcium', unit: 'mg/L', category: 'chemistry', lab_result_id: 10 }),
      makeComponent({ id: 4, test_name: 'Calcium', canonical_test_name: 'Calcium', unit: 'mmol/L', value: 2.43, category: 'chemistry', lab_result_id: 11 }),
    ];

    render(
      <TestComponentCatalog
        {...defaultProps}
        components={multiUnitComponents}
      />
    );

    const cards = screen.getAllByTestId('catalog-card');
    expect(cards).toHaveLength(2);

    fireEvent.click(cards[1]);
    await waitFor(() => {
      const panel = screen.getByTestId('trends-panel');
      expect(panel.getAttribute('data-test-name')).toBe('Calcium');
      expect(panel.getAttribute('data-unit')).toBe('mmol/L');
    });
  });
});
