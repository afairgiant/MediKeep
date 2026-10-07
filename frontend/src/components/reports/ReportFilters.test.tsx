import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../test-utils/render';
import { ReportFilters } from './ReportFilters';

vi.mock('../common/TagInput', () => ({
  TagInput: ({ value }: { value: string[] }) => (
    <div data-testid="tag-input">{value.join(',')}</div>
  ),
}));

describe('ReportFilters', () => {
  it('renders the saved tags', () => {
    render(
      <ReportFilters
        dateRange={null}
        tags={['diabetes', 'cardio']}
        onDateRangeChange={vi.fn()}
        onTagsChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('tag-input')).toHaveTextContent(
      'diabetes,cardio'
    );
  });

  it('flags an end date before the start date', () => {
    render(
      <ReportFilters
        dateRange={{ start_date: '2024-06-01', end_date: '2024-01-01' }}
        tags={[]}
        onDateRangeChange={vi.fn()}
        onTagsChange={vi.fn()}
      />
    );
    expect(screen.getByText(/invalidRange/)).toBeInTheDocument();
  });
});
