import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import render, { screen } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import LabResultViewModal from '../LabResultViewModal';

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));

vi.mock('../TestComponentsTab', () => ({ default: () => <div /> }));

const labResult = {
  id: 5,
  test_name: 'CBC Panel',
  status: 'completed',
  tags: [],
  is_panel: true,
};

const renderModal = (overrides = {}) =>
  render(
    <LabResultViewModal
      isOpen
      onClose={vi.fn()}
      onEdit={vi.fn()}
      labResult={labResult}
      practitioners={[]}
      isGroupedResult
      {...overrides}
    />
  );

describe('LabResultViewModal footer', () => {
  it('lists Close before a plain Edit button', () => {
    renderModal();

    const close = screen.getByRole('button', { name: 'Close' });
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(
      close.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('closes the view modal and then opens the edit form for the result', async () => {
    const calls: string[] = [];
    const onClose = vi.fn(() => calls.push('close'));
    const onEdit = vi.fn(() => calls.push('edit'));
    renderModal({ onClose, onEdit });

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(labResult);
    expect(calls).toEqual(['close', 'edit']);
  });

  it('disables Edit but keeps Close usable when editing is disabled', () => {
    renderModal({ disableEdit: true });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
  });
});
