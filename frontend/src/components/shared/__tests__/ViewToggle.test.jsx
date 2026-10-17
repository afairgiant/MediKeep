import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import ViewToggle from '../ViewToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback,
    i18n: { language: 'en' },
  }),
}));

const renderToggle = props =>
  render(
    <MantineProvider>
      <ViewToggle onViewModeChange={vi.fn()} {...props} />
    </MantineProvider>
  );

describe('ViewToggle print button', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Print button in table mode when showPrint is set', () => {
    renderToggle({ viewMode: 'table', showPrint: true });

    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('hides the Print button outside table mode', () => {
    renderToggle({ viewMode: 'cards', showPrint: true });

    expect(
      screen.queryByRole('button', { name: 'Print' })
    ).not.toBeInTheDocument();
  });

  it('hides the Print button when showPrint is not set', () => {
    renderToggle({ viewMode: 'table' });

    expect(
      screen.queryByRole('button', { name: 'Print' })
    ).not.toBeInTheDocument();
  });

  it('opens the browser print dialog when clicked', async () => {
    const user = userEvent.setup();
    renderToggle({ viewMode: 'table', showPrint: true });

    await user.click(screen.getByRole('button', { name: 'Print' }));

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('uses the shared Print button style at both toggle sizes', () => {
    const { unmount } = renderToggle({ viewMode: 'table', showPrint: true });
    const defaultButton = screen.getByRole('button', { name: 'Print' });
    expect(defaultButton).toHaveAttribute('data-variant', 'outline');
    expect(defaultButton).toHaveAttribute('data-size', 'md');
    unmount();

    renderToggle({ viewMode: 'table', showPrint: true, size: 'sm' });
    const smallButton = screen.getByRole('button', { name: 'Print' });
    expect(smallButton).toHaveAttribute('data-variant', 'outline');
    expect(smallButton).toHaveAttribute('data-size', 'sm');
  });
});
