import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestComponentTrendTable from '../TestComponentTrendTable';
import { TrendResponse } from '../../../../services/api/labTestComponentApi';

vi.mock('@mantine/core', () => ({
  Table: Object.assign(
    ({ children }: any) => <table>{children}</table>,
    {
      Thead: ({ children }: any) => <thead>{children}</thead>,
      Tbody: ({ children }: any) => <tbody>{children}</tbody>,
      Tr: ({ children }: any) => <tr>{children}</tr>,
      Th: ({ children }: any) => <th>{children}</th>,
      Td: ({ children }: any) => <td>{children}</td>,
    }
  ),
  Paper: ({ children }: any) => <div>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, lineClamp: _lc, ...rest }: any) => <span {...rest}>{children}</span>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Group: ({ children, onClick, style }: any) => (
    <div onClick={onClick} style={style}>{children}</div>
  ),
  ScrollArea: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <>{children}</>,
  ActionIcon: ({ children, onClick, disabled, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowUp: () => <span data-testid="icon-asc" />,
  IconArrowDown: () => <span data-testid="icon-desc" />,
  IconArrowsSort: () => <span data-testid="icon-unsorted" />,
  IconEdit: () => <span data-testid="icon-edit" />,
  IconTrash: () => <span data-testid="icon-trash" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'trendTable.historicalData') return `${opts?.count ?? 0} records`;
      const map: Record<string, string> = {
        'trendTable.clickToSort': 'Click to sort',
        'trendTable.labResult': 'Lab Result',
        'trendTable.noDataPoints': 'No data',
        'shared:labels.date': 'Date',
        'shared:labels.value': 'Value',
        'shared:fields.status': 'Status',
        'shared:labels.edit': 'Edit',
        'common:actions.delete': 'Delete',
        'labresults:testComponents.editModal.fields.unit': 'Unit',
        'labresults:testComponents.editModal.fields.referenceRange': 'Reference Range',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (d: string) => d }),
}));

const STATUS_SEVERITY_ORDER = ['low', 'normal', 'borderline', 'abnormal', 'high', 'critical'];

vi.mock('../../../../constants/labCategories', () => ({
  getQualitativeDisplayName: (v: string) => v,
  getQualitativeColor: () => 'green',
  getStatusBadgeColor: () => 'gray',
  statusSeverityRank: (status: string | null | undefined) => {
    if (!status) return Number.MAX_SAFE_INTEGER;
    const idx = STATUS_SEVERITY_ORDER.indexOf(status.toLowerCase());
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  },
}));

const makePoint = (id: number, labResultName: string, value: number) => ({
  id,
  value,
  unit: 'mg/dL',
  status: 'normal',
  ref_range_min: 70,
  ref_range_max: 100,
  ref_range_text: null,
  recorded_date: `2024-0${id}-01`,
  created_at: `2024-0${id}-01T00:00:00`,
  lab_result: { id, test_name: labResultName },
  result_type: 'quantitative' as const,
  qualitative_value: null,
  textual_value: null,
  is_legacy: false,
});

const makeStatusOnlyPoint = (id: number, status: string) => ({
  id,
  value: null,
  unit: null,
  status,
  ref_range_min: null,
  ref_range_max: null,
  ref_range_text: null,
  recorded_date: `2024-0${id}-01`,
  created_at: `2024-0${id}-01T00:00:00`,
  lab_result: { id, test_name: 'A1C' },
  result_type: 'status_only' as const,
  qualitative_value: null,
  textual_value: null,
  is_legacy: true,
});

const makeTrendData = (points: any[]): TrendResponse => ({
  test_name: 'Glucose',
  unit: 'mg/dL',
  category: 'chemistry',
  data_points: points,
  statistics: {
    count: points.length,
    trend_direction: 'stable',
    normal_count: points.length,
    abnormal_count: 0,
  },
  is_aggregated: false,
});

describe('TestComponentTrendTable — Lab Result sorting', () => {
  const points = [
    makePoint(1, 'Zebra Panel', 90),
    makePoint(2, 'Alpha Panel', 80),
    makePoint(3, 'Mango Panel', 85),
  ];
  const trendData = makeTrendData(points);

  const getLabResultCells = () =>
    screen.getAllByRole('cell').filter((_, i) => i % 6 === 5);

  it('Lab Result column header is present', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    expect(screen.getByText('Lab Result')).toBeTruthy();
  });

  it('clicking Lab Result header sorts descending (new field defaults to desc)', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    fireEvent.click(screen.getByText('Lab Result').closest('div')!);
    const cells = getLabResultCells();
    expect(cells[0].textContent).toBe('Zebra Panel');
    expect(cells[1].textContent).toBe('Mango Panel');
    expect(cells[2].textContent).toBe('Alpha Panel');
  });

  it('clicking Lab Result header twice reverses to ascending', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    const header = screen.getByText('Lab Result').closest('div')!;
    fireEvent.click(header);
    fireEvent.click(header);
    const cells = getLabResultCells();
    expect(cells[0].textContent).toBe('Alpha Panel');
    expect(cells[2].textContent).toBe('Zebra Panel');
  });

  it('Lab Result column shows unsorted icon when another field is active', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    // Default sort is 'date', so lab_result should show the unsorted icon
    const labResultHeader = screen.getByText('Lab Result').closest('div')!;
    expect(labResultHeader.querySelector('[data-testid="icon-unsorted"]')).toBeTruthy();
  });
});

describe('TestComponentTrendTable — legacy points with no date', () => {
  it('renders without crashing when a point has neither recorded_date nor created_at (#1014)', () => {
    const undatedPoint = {
      ...makePoint(1, 'Undated Legacy', 90),
      recorded_date: null,
      created_at: null,
    };
    const trendData = makeTrendData([undatedPoint, makePoint(2, 'Dated Panel', 80)]);
    expect(() => render(<TestComponentTrendTable trendData={trendData} />)).not.toThrow();
    const dateCells = screen.getAllByRole('cell').filter((_, i) => i % 6 === 0);
    expect(dateCells.map(c => c.textContent)).toContain('');
  });
});

describe('TestComponentTrendTable — Status column severity sort (#1025 follow-up)', () => {
  // Deliberately out of both alphabetical and insertion order.
  const points = [
    makeStatusOnlyPoint(1, 'critical'),
    makeStatusOnlyPoint(2, 'low'),
    makeStatusOnlyPoint(3, 'normal'),
    makeStatusOnlyPoint(4, 'abnormal'),
    makeStatusOnlyPoint(5, 'high'),
  ];
  const trendData = makeTrendData(points);

  const getStatusCells = () =>
    screen.getAllByRole('cell').filter((_, i) => i % 6 === 3);

  it('sorts ascending as Low -> Normal -> Abnormal -> High -> Critical, not alphabetically', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    const header = screen.getByText('Status').closest('div')!;
    fireEvent.click(header); // first click -> desc (new field default)
    fireEvent.click(header); // second click -> asc
    const cells = getStatusCells();
    expect(cells.map(c => c.textContent)).toEqual([
      'low',
      'normal',
      'abnormal',
      'high',
      'critical',
    ]);
  });

  it('descending click reverses the severity order, not the alphabetical one', () => {
    render(<TestComponentTrendTable trendData={trendData} />);
    const header = screen.getByText('Status').closest('div')!;
    fireEvent.click(header); // desc
    const cells = getStatusCells();
    expect(cells.map(c => c.textContent)).toEqual([
      'critical',
      'high',
      'abnormal',
      'normal',
      'low',
    ]);
  });
});

describe('TestComponentTrendTable — actions for legacy points (#1025 follow-up)', () => {
  it('hides both Edit and Delete for legacy points when neither legacy route is wired', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([
      makeStatusOnlyPoint(1, 'abnormal'),
      makeStatusOnlyPoint(2, 'normal'),
    ]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.queryByText('shared:labels.actions')).toBeNull();
    expect(screen.queryByLabelText('Edit')).toBeNull();
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('shows only Edit when canEditLegacy is set but canDeleteLegacy is not', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([
      makeStatusOnlyPoint(1, 'abnormal'),
      makeStatusOnlyPoint(2, 'normal'),
    ]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
        canEditLegacy
      />
    );
    expect(screen.getAllByLabelText('Edit')).toHaveLength(2);
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('shows only Delete when canDeleteLegacy is set but canEditLegacy is not', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([
      makeStatusOnlyPoint(1, 'abnormal'),
      makeStatusOnlyPoint(2, 'normal'),
    ]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
        canDeleteLegacy
      />
    );
    expect(screen.queryByLabelText('Edit')).toBeNull();
    expect(screen.getAllByLabelText('Delete')).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText('Delete')[0]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('still shows Edit/Delete for a real quantitative point with no legacy wiring at all', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([makePoint(1, 'Panel', 90)]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByLabelText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('a series mixing legacy and real points gets actions on the real row regardless of legacy wiring', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([
      makePoint(1, 'Panel', 90),
      makeStatusOnlyPoint(2, 'abnormal'),
    ]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.getAllByLabelText('Edit')).toHaveLength(1);
    expect(screen.getAllByLabelText('Delete')).toHaveLength(1);
  });

  it('with both canEditLegacy and canDeleteLegacy, an all-legacy series gets both actions on every row', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const trendData = makeTrendData([
      makeStatusOnlyPoint(1, 'abnormal'),
      makeStatusOnlyPoint(2, 'normal'),
    ]);
    render(
      <TestComponentTrendTable
        trendData={trendData}
        onEdit={onEdit}
        onDelete={onDelete}
        canEditLegacy
        canDeleteLegacy
      />
    );
    expect(screen.getAllByLabelText('Edit')).toHaveLength(2);
    expect(screen.getAllByLabelText('Delete')).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText('Edit')[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByLabelText('Delete')[0]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
