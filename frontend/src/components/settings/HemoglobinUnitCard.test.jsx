import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import HemoglobinUnitCard from './HemoglobinUnitCard';

const renderCard = props =>
  render(
    <MantineProvider>
      <HemoglobinUnitCard unit={null} onChange={vi.fn()} {...props} />
    </MantineProvider>
  );

describe('HemoglobinUnitCard', () => {
  test('defaults to g/dL when no unit is set', () => {
    renderCard();
    expect(screen.getByLabelText('g/dL')).toBeChecked();
  });

  test('shows the saved unit', () => {
    renderCard({ unit: 'mmol_l' });
    expect(screen.getByLabelText('mmol/L')).toBeChecked();
  });

  test('picking a unit emits its key', async () => {
    const onChange = vi.fn();
    renderCard({ onChange });
    await userEvent.click(screen.getByLabelText('g/L'));
    expect(onChange).toHaveBeenCalledWith('g_l');
  });

  test('picking g/dL again emits null so the default is not persisted', async () => {
    const onChange = vi.fn();
    renderCard({ unit: 'g_l', onChange });
    await userEvent.click(screen.getByLabelText('g/dL'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
