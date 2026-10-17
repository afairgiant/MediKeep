import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import ViewModalFooter from '../ViewModalFooter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: 'en' },
  }),
}));

const renderFooter = (ui: ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

const buttonLabels = () =>
  screen.getAllByRole('button').map(button => button.textContent);

describe('ViewModalFooter', () => {
  it('renders Close before Edit', () => {
    renderFooter(<ViewModalFooter onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(buttonLabels()).toEqual(['Close', 'Edit']);
  });

  it('aligns the buttons to the right', () => {
    renderFooter(<ViewModalFooter onClose={vi.fn()} onEdit={vi.fn()} />);

    const group = screen.getByRole('button', { name: 'Close' }).parentElement;
    expect(group).toHaveStyle('--group-justify: flex-end');
  });

  it('calls onClose when Close is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();
    renderFooter(<ViewModalFooter onClose={onClose} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('calls only onEdit when Edit is clicked, leaving closing to the caller', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();
    renderFooter(<ViewModalFooter onClose={onClose} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses a custom edit label when provided', () => {
    renderFooter(
      <ViewModalFooter
        onClose={vi.fn()}
        onEdit={vi.fn()}
        editLabel="Edit Family Member"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Edit Family Member' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument();
  });

  it('omits the Edit button when no onEdit handler is given', () => {
    renderFooter(<ViewModalFooter onClose={vi.fn()} />);

    expect(buttonLabels()).toEqual(['Close']);
  });

  it('disables Edit but keeps Close usable when editing is disabled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();
    renderFooter(
      <ViewModalFooter
        onClose={onClose}
        onEdit={onEdit}
        disableEdit
        disableEditTooltip="Read only"
      />
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('places extra actions between Close and Edit', () => {
    renderFooter(
      <ViewModalFooter onClose={vi.fn()} onEdit={vi.fn()}>
        <button type="button">Delete</button>
        <button type="button">Log Episode</button>
      </ViewModalFooter>
    );

    expect(buttonLabels()).toEqual(['Close', 'Delete', 'Log Episode', 'Edit']);
  });

  it('keeps extra actions after Close when Edit is omitted', () => {
    renderFooter(
      <ViewModalFooter onClose={vi.fn()}>
        <button type="button">Delete</button>
      </ViewModalFooter>
    );

    expect(buttonLabels()).toEqual(['Close', 'Delete']);
  });
});
