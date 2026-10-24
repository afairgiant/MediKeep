import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import TestComponentDisplay from '../TestComponentDisplay';
import type { LabTestComponent } from '../../../../services/api/labTestComponentApi';

const component: LabTestComponent = {
  id: 1,
  lab_result_id: 1,
  test_name: 'Glucose',
  value: 90,
  unit: 'mg/dL',
  notes: 'See [guide](https://example.com/guide)',
};

const renderDisplay = (onTrendClick: () => void) =>
  render(
    <MantineProvider>
      <TestComponentDisplay
        components={[component]}
        groupByCategory={false}
        onTrendClick={onTrendClick}
      />
    </MantineProvider>
  );

describe('TestComponentDisplay trend card', () => {
  it('opens trends from the card but not from a link in its notes', async () => {
    const onTrendClick = vi.fn();
    renderDisplay(onTrendClick);
    const link = await screen.findByRole('link', { name: 'guide' });

    fireEvent.click(link);
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(onTrendClick).not.toHaveBeenCalled();

    const card = screen.getByRole('button', {
      name: /View trends for Glucose/,
    });
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onTrendClick).toHaveBeenCalledTimes(2);
    expect(onTrendClick).toHaveBeenCalledWith('Glucose', 'mg/dL');
  });
});
