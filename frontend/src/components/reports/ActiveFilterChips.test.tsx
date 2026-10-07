import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import { ActiveFilterChips } from './ActiveFilterChips';

const renderChips = (props = {}) => {
  const onDateRangeChange = vi.fn();
  const onTagsChange = vi.fn();
  render(
    <ActiveFilterChips
      dateRange={null}
      tags={[]}
      onDateRangeChange={onDateRangeChange}
      onTagsChange={onTagsChange}
      {...props}
    />
  );
  return { onDateRangeChange, onTagsChange };
};

describe('ActiveFilterChips', () => {
  it('says no filters are applied when none are set', () => {
    renderChips();
    expect(screen.getByText('builder.filters.chips.none')).toBeInTheDocument();
  });

  it('removes a single tag without touching the others', () => {
    const { onTagsChange } = renderChips({ tags: ['fred', 'cardio'] });

    fireEvent.click(
      screen.getAllByRole('button', {
        name: /builder\.filters\.chips\.remove/,
      })[0]
    );

    expect(onTagsChange).toHaveBeenCalledWith(['cardio']);
  });

  it('clears the date range from its chip', () => {
    const { onDateRangeChange } = renderChips({
      dateRange: { start_date: '2024-01-01', end_date: null },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /builder\.filters\.chips\.remove/ })
    );

    expect(onDateRangeChange).toHaveBeenCalledWith(null);
  });
});
