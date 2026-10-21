import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BloodDonationIntervalsCard from './BloodDonationIntervalsCard';

const renderCard = props =>
  render(
    <MantineProvider>
      <BloodDonationIntervalsCard
        intervals={null}
        onChange={vi.fn()}
        {...props}
      />
    </MantineProvider>
  );

describe('BloodDonationIntervalsCard', () => {
  test('shows defaults when no intervals are set', () => {
    renderCard();
    expect(screen.getByLabelText('Whole Blood')).toHaveValue('56 days');
    expect(screen.getByLabelText('Double Red Cells')).toHaveValue('112 days');
  });

  test('shows custom values merged over defaults', () => {
    renderCard({ intervals: { plasma: 2 } });
    expect(screen.getByLabelText('Plasma')).toHaveValue('2 days');
    expect(screen.getByLabelText('Platelets')).toHaveValue('14 days');
  });

  test('changing a value emits the full interval map', () => {
    const onChange = vi.fn();
    renderCard({ onChange });
    fireEvent.change(screen.getByLabelText('Whole Blood'), {
      target: { value: '84' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      whole_blood: 84,
      plasma: 14,
      platelets: 14,
      double_red_cells: 112,
    });
  });

  test('changing a value back to the default emits null', () => {
    const onChange = vi.fn();
    renderCard({ intervals: { whole_blood: 84 }, onChange });
    fireEvent.change(screen.getByLabelText('Whole Blood'), {
      target: { value: '56' },
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test('reset emits null', async () => {
    const onChange = vi.fn();
    renderCard({ intervals: { plasma: 2 }, onChange });
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset to defaults' })
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('clearing a field with backspace stays empty until blur, then restores', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCard({ onChange });
    const input = screen.getByLabelText('Whole Blood');

    await user.clear(input);

    expect(input).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();

    await user.tab();

    expect(input).toHaveValue('56 days');
  });
});
