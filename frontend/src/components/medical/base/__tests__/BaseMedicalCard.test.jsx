import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BaseMedicalCard from '../BaseMedicalCard';

vi.mock('../../../../services/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));

const renderCard = notes =>
  render(
    <MantineProvider>
      <BaseMedicalCard title="Record" notes={notes} />
    </MantineProvider>
  );

describe('BaseMedicalCard notes', () => {
  it('shows a short note formatted with no toggle', async () => {
    renderCard('## Plan');
    expect(
      await screen.findByRole('heading', { name: 'Plan' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show more' })
    ).not.toBeInTheDocument();
  });

  it('collapses a multi-line note to plain text and expands it formatted', async () => {
    const user = userEvent.setup();
    renderCard('**Plan**\n- rest\n- fluids');

    expect(screen.getByText('Plan rest fluids')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show more' }));

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Plan').tagName).toBe('STRONG');

    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByText('Plan rest fluids')).toBeInTheDocument();
  });

  it('offers the toggle for a long single-line note', () => {
    renderCard('word '.repeat(40));
    expect(
      screen.getByRole('button', { name: 'Show more' })
    ).toBeInTheDocument();
  });
});
