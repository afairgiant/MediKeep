import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestComponentCatalogCard from '../TestComponentCatalogCard';

// Mock Mantine components to avoid MantineProvider requirement
vi.mock('@mantine/core', () => ({
  Card: ({ children, onClick, ...props }: any) => (
    <div data-testid={props['data-testid']} onClick={onClick} {...props}>
      {children}
    </div>
  ),
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Stack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

// Mock tabler icons
vi.mock('@tabler/icons-react', () => ({
  IconTrendingUp: () => <span data-testid="icon-trending-up" />,
  IconTrendingDown: () => <span data-testid="icon-trending-down" />,
  IconMinus: () => <span data-testid="icon-minus" />,
  IconArrowBigUpFilled: () => <span data-testid="icon-arrow-up" />,
  IconArrowBigDownFilled: () => <span data-testid="icon-arrow-down" />,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, _opts?: Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : _key,
  }),
}));

// Mock useDateFormat hook
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d: string | null | undefined) => d || '',
  }),
}));

// Mock labCategories constants
vi.mock('../../../../constants/labCategories', () => ({
  getCategoryColor: (cat: string) => `color-${cat}`,
  getCategoryDisplayName: (cat: string) => `Display ${cat}`,
}));

const quantEntry = {
  test_name: 'Glucose',
  trend_test_name: 'Glucose',
  abbreviation: 'GLU',
  latest_value: 95,
  latest_qualitative_value: null,
  unit: 'mg/dL',
  status: 'normal' as const,
  category: 'chemistry',
  result_type: 'quantitative' as const,
  reading_count: 5,
  trend_direction: 'stable' as const,
  latest_date: '2024-01-15',
  ref_range_min: 70,
  ref_range_max: 100,
  ref_range_text: null,
};

const qualEntry = {
  test_name: 'HIV Antibody',
  trend_test_name: 'HIV Antibody',
  abbreviation: null,
  latest_value: null,
  latest_qualitative_value: 'negative',
  unit: null,
  status: 'normal' as const,
  category: 'immunology',
  result_type: 'qualitative' as const,
  reading_count: 2,
  trend_direction: 'stable' as const,
  latest_date: '2024-02-10',
  ref_range_min: null,
  ref_range_max: null,
  ref_range_text: null,
};

describe('TestComponentCatalogCard', () => {
  it('renders test name and abbreviation', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    expect(screen.getByText('Glucose')).toBeInTheDocument();
    expect(screen.getByText('GLU')).toBeInTheDocument();
  });

  it('renders quantitative value with unit', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
  });

  it('renders qualitative value when result_type is qualitative', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={qualEntry} onClick={onClick} />);

    expect(screen.getByText('negative')).toBeInTheDocument();
    // Should not render unit for qualitative
    expect(screen.queryByText('mg/dL')).not.toBeInTheDocument();
  });

  it('renders status badge with correct label', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('renders status badge for high status', () => {
    const onClick = vi.fn();
    const highEntry = {
      ...quantEntry,
      status: 'high' as const,
      latest_value: 110,
    };

    render(<TestComponentCatalogCard entry={highEntry} onClick={onClick} />);

    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders status badge for critical status', () => {
    const onClick = vi.fn();
    const criticalEntry = {
      ...quantEntry,
      status: 'critical' as const,
      latest_value: 250,
    };

    render(
      <TestComponentCatalogCard entry={criticalEntry} onClick={onClick} />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('shows reading count', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    // The translated fallback is "{{count}} readings"
    expect(screen.getByText('{{count}} readings')).toBeInTheDocument();
  });

  it('calls onClick with trend_test_name when card is clicked', () => {
    const onClick = vi.fn();
    const entry = {
      ...quantEntry,
      test_name: 'Glucose (Fasting)',
      trend_test_name: 'Glucose',
    };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('catalog-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith('Glucose');
  });

  it('handles missing abbreviation gracefully', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, abbreviation: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    expect(screen.getByText('Glucose')).toBeInTheDocument();
    // Abbreviation badge should not be rendered
    expect(screen.queryByText('GLU')).not.toBeInTheDocument();
  });

  it('handles missing unit gracefully', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, unit: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.queryByText('mg/dL')).not.toBeInTheDocument();
  });

  it('handles null latest_value by showing placeholder', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, latest_value: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('handles missing status gracefully', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, status: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    // Should still render the card without a status badge
    expect(screen.getByText('Glucose')).toBeInTheDocument();
  });

  it('handles missing category gracefully', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, category: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    // Card should still render without the category badge
    expect(screen.getByText('Glucose')).toBeInTheDocument();
  });

  it('renders reference range when ref_range_min and ref_range_max are set', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    expect(screen.getByText(/70 - 100/)).toBeInTheDocument();
  });

  it('renders reference range text when provided', () => {
    const onClick = vi.fn();
    const entry = {
      ...quantEntry,
      ref_range_min: null,
      ref_range_max: null,
      ref_range_text: '< 200',
    };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    expect(screen.getByText(/< 200/)).toBeInTheDocument();
  });

  it('does not render reference range when none provided', () => {
    const onClick = vi.fn();
    const entry = {
      ...quantEntry,
      ref_range_min: null,
      ref_range_max: null,
      ref_range_text: null,
    };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    expect(screen.queryByText(/Ref/)).not.toBeInTheDocument();
  });

  it('renders latest_date using formatDate', () => {
    const onClick = vi.fn();

    render(<TestComponentCatalogCard entry={quantEntry} onClick={onClick} />);

    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('handles missing latest_date gracefully', () => {
    const onClick = vi.fn();
    const entry = { ...quantEntry, latest_date: null };

    render(<TestComponentCatalogCard entry={entry} onClick={onClick} />);

    // Should still render without date
    expect(screen.getByText('Glucose')).toBeInTheDocument();
  });
});
