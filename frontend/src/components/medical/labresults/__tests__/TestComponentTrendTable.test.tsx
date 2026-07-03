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
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowUp: () => <span data-testid="icon-asc" />,
  IconArrowDown: () => <span data-testid="icon-desc" />,
  IconArrowsSort: () => <span data-testid="icon-unsorted" />,
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

vi.mock('../../../../constants/labCategories', () => ({
  getQualitativeDisplayName: (v: string) => v,
  getQualitativeColor: () => 'green',
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
});

const makeTrendData = (points: ReturnType<typeof makePoint>[]): TrendResponse => ({
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
