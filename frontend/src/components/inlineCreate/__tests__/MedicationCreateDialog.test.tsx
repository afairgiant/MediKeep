import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import MedicationCreateDialog from '../MedicationCreateDialog';

const mocks = vi.hoisted(() => ({
  createMedication: vi.fn(),
  show: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  apiService: { createMedication: mocks.createMedication },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hooks/useGlobalData', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../hooks/useGlobalData')>()),
  usePractitioners: () => ({ practitioners: [] }),
  usePharmacies: () => ({ pharmacies: [] }),
}));
vi.mock('@mantine/notifications', async importOriginal => ({
  ...(await importOriginal<typeof import('@mantine/notifications')>()),
  notifications: { show: mocks.show },
}));
// A stand-in for the form: sets reminder fields the way the Reminders tab would, then submits
vi.mock('../../medical/MantineMedicationForm', () => ({
  default: (props: {
    onInputChange: (_e: { target: { name: string; value: unknown } }) => void;
    onSubmit: (_e: unknown) => void;
  }) => {
    const set = (name: string, value: unknown) =>
      props.onInputChange({ target: { name, value } });
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            set('medication_name', 'Ibuprofen');
            set('reminder_enabled', true);
            set('reminder_times', ['08:00']);
            set('effective_period_end', '2020-01-01');
          }}
        >
          fill-lapsed-reminder
        </button>
        <button
          type="button"
          onClick={() => {
            set('medication_name', 'Ibuprofen');
            set('reminder_enabled', true);
            set('reminder_times', ['08:00']);
          }}
        >
          fill-ok-reminder
        </button>
        <button type="button" onClick={e => props.onSubmit(e)}>
          submit
        </button>
      </div>
    );
  },
}));

const renderDialog = (onCreated = vi.fn().mockResolvedValue('linked')) =>
  render(
    <MedicationCreateDialog
      patientId={7}
      onCreated={onCreated}
      onClose={vi.fn()}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMedication.mockResolvedValue({
    id: 901,
    medication_name: 'Ibuprofen',
  });
});

describe('MedicationCreateDialog - reminder warning', () => {
  it('warns right after saving when a reminder was set up that will not fire', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByText('fill-lapsed-reminder'));
    await user.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(mocks.createMedication).toHaveBeenCalledTimes(1)
    );
    // Same text the Medications page shows, resolved in the medical namespace
    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Reminders won't fire",
          message: expect.stringContaining('no longer taken as of 2020-01-01'),
          color: 'yellow',
        })
      )
    );
    expect(mocks.createMedication.mock.calls[0][0]).toMatchObject({
      medication_name: 'Ibuprofen',
      reminder_enabled: true,
      patient_id: 7,
    });
  });

  it('does not warn when the reminder will fire', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByText('fill-ok-reminder'));
    await user.click(screen.getByText('submit'));
    await waitFor(() =>
      expect(mocks.createMedication).toHaveBeenCalledTimes(1)
    );
    expect(mocks.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'yellow' })
    );
  });
});
