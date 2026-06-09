import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabResultStackCard, { LabResultGroup } from '../LabResultStackCard';

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
    <span data-testid={props['data-testid'] || 'badge'} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('../../StatusBadge', () => ({
  default: ({ status, ...props }: any) => (
    <span data-testid="status-badge" data-status={status} {...props}>
      {status}
    </span>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconChevronRight: () => <span data-testid="icon-chevron-right" />,
  IconStack2: () => <span data-testid="icon-stack" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${opts.count} results`;
      if (opts && 'from' in opts) return `${opts.from} – ${opts.to}`;
      return typeof fallback === 'string' ? fallback : key;
    },
  }),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d: string | null | undefined) => d || '',
  }),
}));

const baseGroup: LabResultGroup = {
  key: 'name:hemoglobin a1c',
  test_name: 'Hemoglobin A1C',
  results: [
    {
      id: 1,
      test_name: 'Hemoglobin A1C',
      labs_result: 'normal',
      ordered_date: '2025-01-01',
      completed_date: '2025-01-05',
      notes: null,
      status: 'completed',
      facility: null,
      test_category: null,
    },
    {
      id: 2,
      test_name: 'Hemoglobin A1C',
      labs_result: 'high',
      ordered_date: '2024-06-01',
      completed_date: '2024-06-05',
      notes: null,
      status: 'completed',
      facility: null,
      test_category: null,
    },
  ],
  count: 2,
  latest_date: '2025-01-05',
  earliest_date: '2024-06-05',
  latest_status: 'normal',
};

describe('LabResultStackCard', () => {
  it('renders test name', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByText('Hemoglobin A1C')).toBeInTheDocument();
  });

  it('shows count badge when count > 1', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('count-badge')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('hides count badge when count is 1', () => {
    const onDrillDown = vi.fn();
    const singleGroup: LabResultGroup = {
      ...baseGroup,
      count: 1,
      results: [baseGroup.results[0]],
      earliest_date: '2025-01-05',
    };
    render(<LabResultStackCard group={singleGroup} onDrillDown={onDrillDown} />);
    expect(screen.queryByTestId('count-badge')).not.toBeInTheDocument();
  });

  it('shows latest status badge when status present', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
  });

  it('does not show status badge when latest_status is null', () => {
    const onDrillDown = vi.fn();
    const noStatusGroup = { ...baseGroup, latest_status: null };
    render(<LabResultStackCard group={noStatusGroup} onDrillDown={onDrillDown} />);
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('shows date range when latest and earliest differ', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByText('2024-06-05 – 2025-01-05')).toBeInTheDocument();
  });

  it('shows single date when latest equals earliest', () => {
    const onDrillDown = vi.fn();
    const sameDate: LabResultGroup = {
      ...baseGroup,
      latest_date: '2025-01-05',
      earliest_date: '2025-01-05',
    };
    render(<LabResultStackCard group={sameDate} onDrillDown={onDrillDown} />);
    expect(screen.getByText('2025-01-05')).toBeInTheDocument();
  });

  it('calls onDrillDown with the group when card is clicked', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    fireEvent.click(screen.getByTestId('stack-card'));
    expect(onDrillDown).toHaveBeenCalledTimes(1);
    expect(onDrillDown).toHaveBeenCalledWith(baseGroup);
  });

  it('shows critical status with correct label', () => {
    const onDrillDown = vi.fn();
    const criticalGroup = { ...baseGroup, latest_status: 'critical' };
    render(<LabResultStackCard group={criticalGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'critical');
  });

  it('shows latest numeric value when present', () => {
    const onDrillDown = vi.fn();
    const numericGroup: LabResultGroup = {
      ...baseGroup,
      results: [
        { ...baseGroup.results[0], value: 5.4, unit: '%' },
        baseGroup.results[1],
      ],
    };
    render(<LabResultStackCard group={numericGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('latest-value')).toBeInTheDocument();
    expect(screen.getByTestId('latest-value')).toHaveTextContent('5.4');
    expect(screen.getByTestId('latest-value')).toHaveTextContent('%');
  });

  it('shows reference range when min and max are present', () => {
    const onDrillDown = vi.fn();
    const numericGroup: LabResultGroup = {
      ...baseGroup,
      results: [
        { ...baseGroup.results[0], value: 5.4, unit: '%', ref_range_min: 4.0, ref_range_max: 5.6 },
        baseGroup.results[1],
      ],
    };
    render(<LabResultStackCard group={numericGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('latest-range')).toHaveTextContent('4–5.6');
  });

  it('shows ref_range_text when provided', () => {
    const onDrillDown = vi.fn();
    const numericGroup: LabResultGroup = {
      ...baseGroup,
      results: [
        { ...baseGroup.results[0], value: 150, ref_range_text: '<200' },
        baseGroup.results[1],
      ],
    };
    render(<LabResultStackCard group={numericGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('latest-range')).toHaveTextContent('<200');
  });

  it('does not show value section when latest result has no value', () => {
    const onDrillDown = vi.fn();
    render(<LabResultStackCard group={baseGroup} onDrillDown={onDrillDown} />);
    expect(screen.queryByTestId('latest-value')).not.toBeInTheDocument();
    expect(screen.queryByTestId('latest-range')).not.toBeInTheDocument();
  });

  it('shows value without range when no range fields are set', () => {
    const onDrillDown = vi.fn();
    const numericGroup: LabResultGroup = {
      ...baseGroup,
      results: [
        { ...baseGroup.results[0], value: 7.2, unit: 'mmol/L' },
        baseGroup.results[1],
      ],
    };
    render(<LabResultStackCard group={numericGroup} onDrillDown={onDrillDown} />);
    expect(screen.getByTestId('latest-value')).toBeInTheDocument();
    expect(screen.queryByTestId('latest-range')).not.toBeInTheDocument();
  });
});
