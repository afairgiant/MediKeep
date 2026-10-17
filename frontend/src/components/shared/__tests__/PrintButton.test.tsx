import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import PrintButton from '../PrintButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: 'en' },
  }),
}));

const renderButton = (ui: ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

describe('PrintButton', () => {
  it('renders the default Print label', () => {
    renderButton(<PrintButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('renders a custom label when children are provided', () => {
    renderButton(<PrintButton onClick={vi.fn()}>Print Card</PrintButton>);

    expect(
      screen.getByRole('button', { name: 'Print Card' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Print' })
    ).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderButton(<PrintButton onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Print' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the print-button class so print.css can hide it on paper', () => {
    renderButton(<PrintButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Print' })).toHaveClass(
      'print-button'
    );
  });

  it('always uses the outline variant so every Print button looks the same', () => {
    renderButton(<PrintButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Print' })).toHaveAttribute(
      'data-variant',
      'outline'
    );
  });

  it('defaults to size sm and passes a custom size through', () => {
    const { unmount } = renderButton(<PrintButton onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Print' })).toHaveAttribute(
      'data-size',
      'sm'
    );
    unmount();

    renderButton(<PrintButton onClick={vi.fn()} size="xs" />);
    expect(screen.getByRole('button', { name: 'Print' })).toHaveAttribute(
      'data-size',
      'xs'
    );
  });
});
