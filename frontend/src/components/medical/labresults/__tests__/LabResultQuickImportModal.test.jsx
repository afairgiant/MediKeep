import { vi } from 'vitest';
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import LabResultQuickImportModal from '../LabResultQuickImportModal';
import { apiService } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResult: vi.fn(),
    deleteLabResult: vi.fn(),
  },
}));

vi.mock('../../../../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const renderModal = onClose =>
  render(
    <LabResultQuickImportModal
      isOpen
      onClose={onClose}
      onSuccess={vi.fn()}
      patientId={1}
    />
  );

const clickHeaderClose = () =>
  fireEvent.click(document.querySelector('.mantine-Modal-close'));

describe('LabResultQuickImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cannot be closed while the lab result is being created', () => {
    // The create request never settles, so the dialog stays in "creating"
    apiService.createLabResult.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.change(screen.getByLabelText(/Lab Test Name/), {
      target: { value: 'CBC' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create & Upload PDF/ }));
    expect(apiService.createLabResult).toHaveBeenCalledTimes(1);

    clickHeaderClose();
    // Enter on a focused Cancel fires the same click
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Lab Test Name/)).toBeDisabled();
  });

  it('closes when nothing is in progress', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    clickHeaderClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
