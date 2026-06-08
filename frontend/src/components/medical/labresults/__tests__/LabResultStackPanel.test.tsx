import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabResultStackPanel from '../LabResultStackPanel';
import { LabResultGroup } from '../LabResultStackCard';

vi.mock('@mantine/core', () => ({
  Drawer: ({ children, opened, title, ...props }: any) =>
    opened ? (
      <div data-testid="drawer" {...props}>
        <div data-testid="drawer-title">{title}</div>
        {children}
      </div>
    ) : null,
  Stack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Title: ({ children, ...props }: any) => <h6 {...props}>{children}</h6>,
  ActionIcon: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Paper: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Divider: () => <hr />,
}));

vi.mock('@tabler/icons-react', () => ({
  IconStack2: () => <span data-testid="icon-stack" />,
  IconEye: () => <span data-testid="icon-eye" />,
  IconPencil: () => <span data-testid="icon-pencil" />,
  IconTrash: () => <span data-testid="icon-trash" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${opts.count} results`;
      if (opts && 'text' in opts) return `Range: ${opts.text}`;
      if (opts && 'min' in opts && 'max' in opts) return `Range: ${opts.min}–${opts.max}`;
      if (opts && 'min' in opts) return `Range: ≥${opts.min}`;
      if (opts && 'max' in opts) return `Range: ≤${opts.max}`;
      return typeof fallback === 'string' ? fallback : key;
    },
  }),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d: string | null | undefined) => d || '',
    formatLongDate: (d: string | null | undefined) => d || '',
  }),
}));

vi.mock('../../StatusBadge', () => ({
  default: ({ status, ...props }: any) => (
    <span data-testid="status-badge" data-status={status} {...props}>{status}</span>
  ),
}));

vi.mock('../TestComponentTrendChart', () => ({
  default: ({ trendData }: any) => (
    <div
      data-testid="trend-chart"
      data-test-name={trendData.test_name}
      data-point-count={String(trendData.data_points.length)}
    />
  ),
}));

const group: LabResultGroup = {
  key: 'name:hemoglobin a1c',
  test_name: 'Hemoglobin A1C',
  results: [
    {
      id: 10,
      test_name: 'Hemoglobin A1C',
      labs_result: 'normal',
      ordered_date: '2025-01-01',
      completed_date: '2025-06-01',
      notes: 'Follow-up test',
      status: 'completed',
      facility: 'Quest',
      test_category: null,
    },
    {
      id: 11,
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
  latest_date: '2025-06-01',
  earliest_date: '2024-06-05',
  latest_status: 'normal',
};

const numericGroup: LabResultGroup = {
  key: 'name:hba1c',
  test_name: 'HbA1c',
  results: [
    {
      id: 20,
      test_name: 'HbA1c',
      labs_result: 'normal',
      ordered_date: '2025-01-01',
      completed_date: '2025-06-01',
      notes: null,
      status: 'completed',
      facility: null,
      test_category: null,
      value: 5.4,
      unit: '%',
      ref_range_min: 4.0,
      ref_range_max: 5.6,
      ref_range_text: null,
    },
    {
      id: 21,
      test_name: 'HbA1c',
      labs_result: 'high',
      ordered_date: '2024-06-01',
      completed_date: '2024-06-05',
      notes: null,
      status: 'completed',
      facility: null,
      test_category: null,
      value: 6.1,
      unit: '%',
      ref_range_min: 4.0,
      ref_range_max: 5.6,
      ref_range_text: null,
    },
  ],
  count: 2,
  latest_date: '2025-06-01',
  earliest_date: '2024-06-05',
  latest_status: 'normal',
};

describe('LabResultStackPanel', () => {
  it('does not render when opened is false', () => {
    render(
      <LabResultStackPanel
        opened={false}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
  });

  it('renders drawer when opened is true', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('renders the results list', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByTestId('view-result-10')).toBeInTheDocument();
    expect(screen.getByTestId('view-result-11')).toBeInTheDocument();
  });

  it('shows result dates in panel', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByText('2025-06-01')).toBeInTheDocument();
    expect(screen.getByText('2024-06-05')).toBeInTheDocument();
  });

  it('shows facility when present', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByText('Quest')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByText('Follow-up test')).toBeInTheDocument();
  });

  it('calls onViewResult and onClose when View button is clicked', () => {
    const onViewResult = vi.fn();
    const onClose = vi.fn();
    render(
      <LabResultStackPanel
        opened={true}
        onClose={onClose}
        group={group}
        patientId={1}
        onViewResult={onViewResult}
      />
    );
    fireEvent.click(screen.getByTestId('view-result-10'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onViewResult).toHaveBeenCalledWith(group.results[0]);
  });

  it('calls onEditResult and onClose when Edit button is clicked', () => {
    const onEditResult = vi.fn();
    const onClose = vi.fn();
    render(
      <LabResultStackPanel
        opened={true}
        onClose={onClose}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
        onEditResult={onEditResult}
      />
    );
    fireEvent.click(screen.getByTestId('edit-result-10'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEditResult).toHaveBeenCalledWith(group.results[0]);
  });

  it('calls onDeleteResult without closing panel when Delete button is clicked', () => {
    const onDeleteResult = vi.fn();
    const onClose = vi.fn();
    render(
      <LabResultStackPanel
        opened={true}
        onClose={onClose}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
        onDeleteResult={onDeleteResult}
      />
    );
    fireEvent.click(screen.getByTestId('delete-result-10'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleteResult).toHaveBeenCalledWith(group.results[0]);
  });

  it('hides all action buttons when disableActions is true', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
        disableActions={true}
      />
    );
    expect(screen.queryByTestId('view-result-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-result-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-result-10')).not.toBeInTheDocument();
  });

  it('renders null when group is null', () => {
    const { container } = render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={null}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not render trend chart when no results have a numeric value', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={group}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.queryByTestId('trend-chart')).not.toBeInTheDocument();
  });

  it('renders trend chart when results have numeric values', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={numericGroup}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    const chart = screen.getByTestId('trend-chart');
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute('data-test-name')).toBe('HbA1c');
    expect(chart.getAttribute('data-point-count')).toBe('2');
  });

  it('shows numeric value and unit in result row', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={numericGroup}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByTestId('numeric-value-20')).toBeInTheDocument();
    expect(screen.getByTestId('numeric-value-21')).toBeInTheDocument();
  });

  it('shows reference range inline with value when min and max are present', () => {
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={numericGroup}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByTestId('value-range-20')).toHaveTextContent('(4–5.6)');
  });

  it('shows ref_range_text inline with value when provided', () => {
    const textRangeGroup: LabResultGroup = {
      ...numericGroup,
      results: [
        {
          ...numericGroup.results[0],
          id: 30,
          ref_range_min: null,
          ref_range_max: null,
          ref_range_text: '<200',
        },
      ],
      count: 1,
    };
    render(
      <LabResultStackPanel
        opened={true}
        onClose={vi.fn()}
        group={textRangeGroup}
        patientId={1}
        onViewResult={vi.fn()}
      />
    );
    expect(screen.getByTestId('value-range-30')).toHaveTextContent('(<200)');
  });
});
