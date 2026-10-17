import { vi, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render, { screen } from '../../../../test-utils/render';
import PharmacyViewModal from '../PharmacyViewModal';

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const pharmacy = { id: 9, name: 'Corner Pharmacy' };

const renderModal = (props = {}) =>
  render(
    <PharmacyViewModal
      isOpen
      onClose={vi.fn()}
      onEdit={vi.fn()}
      pharmacy={pharmacy}
      {...props}
    />
  );

describe('PharmacyViewModal footer', () => {
  it('lists Close before a plain Edit button', () => {
    renderModal();

    const close = screen.getByRole('button', { name: 'Close' });
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(
      close.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('passes the pharmacy to onEdit and then closes the modal', async () => {
    const calls = [];
    const onClose = vi.fn(() => calls.push('close'));
    const onEdit = vi.fn(() => calls.push('edit'));
    renderModal({ onClose, onEdit });

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(pharmacy);
    expect(calls).toEqual(['edit', 'close']);
  });

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
