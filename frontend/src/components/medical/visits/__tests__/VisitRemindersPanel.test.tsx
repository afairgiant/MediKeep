import { useState } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../../test-utils/render';
import VisitRemindersPanel from '../VisitRemindersPanel';

const api = vi.hoisted(() => ({ sendVisitTestReminder: vi.fn() }));
const notificationApi = vi.hoisted(() => ({ getPreferenceMatrix: vi.fn() }));
vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../services/api/notificationApi', () => ({
  default: notificationApi,
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const FUTURE = '2099-01-10';

interface Form {
  date: string;
  visit_time: string;
  reminder_enabled: boolean;
  reminder_offsets: number[];
  reminder_include_details: boolean;
}

const Harness = ({
  initial,
  visitId,
}: {
  initial?: Partial<Form>;
  visitId?: number;
}) => {
  const [form, setForm] = useState<Form>({
    date: FUTURE,
    visit_time: '',
    reminder_enabled: false,
    reminder_offsets: [],
    reminder_include_details: false,
    ...initial,
  });
  return (
    <>
      <VisitRemindersPanel
        formData={form}
        visitId={visitId}
        onInputChange={({ target }) =>
          setForm(prev => ({ ...prev, [target.name]: target.value }))
        }
      />
      <output data-testid="form-state">{JSON.stringify(form)}</output>
    </>
  );
};

const chip = (name: string) => screen.getByRole('checkbox', { name });
const formState = (): Form =>
  JSON.parse(screen.getByTestId('form-state').textContent ?? '{}');

beforeEach(() => {
  api.sendVisitTestReminder.mockReset();
  notificationApi.getPreferenceMatrix.mockResolvedValue({
    preferences: { visit_reminder_due: { 1: true } },
  });
});

describe('VisitRemindersPanel', () => {
  it('starts off with no reminder choices shown', () => {
    render(<Harness />);
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: '1 day before' })).toBeNull();
  });

  it('preselects the day before when switched on', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('switch'));

    expect(formState().reminder_enabled).toBe(true);
    expect(formState().reminder_offsets).toEqual([1440]);
    expect(chip('1 day before')).toBeChecked();
  });

  it('disables hour reminders on an all-day visit', () => {
    render(
      <Harness initial={{ reminder_enabled: true, reminder_offsets: [1440] }} />
    );
    expect(chip('2 hours before')).toBeDisabled();
    expect(chip('Day of visit')).toBeEnabled();
  });

  it('allows hour reminders once the visit has a start time', async () => {
    render(
      <Harness
        initial={{
          reminder_enabled: true,
          reminder_offsets: [1440],
          visit_time: '10:00',
        }}
      />
    );
    await userEvent.click(chip('2 hours before'));
    expect([...formState().reminder_offsets].sort((a, b) => a - b)).toEqual([
      120, 1440,
    ]);
  });

  it('adds a custom reminder and lists it as a chip', async () => {
    render(
      <Harness initial={{ reminder_enabled: true, reminder_offsets: [1440] }} />
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Custom time before the visit' }),
      '3'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(formState().reminder_offsets).toEqual([1440, 4320]);
    expect(chip('3 days before')).toBeChecked();
  });

  it('explains why a duplicate custom reminder is not added', async () => {
    render(
      <Harness initial={{ reminder_enabled: true, reminder_offsets: [1440] }} />
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Custom time before the visit' }),
      '1'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That reminder is already set.'
    );
    expect(formState().reminder_offsets).toEqual([1440]);
  });

  it('warns when no notification channel is on for visit reminders', async () => {
    notificationApi.getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    render(
      <Harness initial={{ reminder_enabled: true, reminder_offsets: [1440] }} />
    );
    expect(
      await screen.findByText('No notification channel enabled')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Notification Settings/ })
    ).toBeInTheDocument();
  });

  it('warns that a past visit will not be reminded', () => {
    render(
      <Harness
        initial={{
          date: '2000-01-01',
          reminder_enabled: true,
          reminder_offsets: [1440],
        }}
      />
    );
    expect(
      screen.getByText(
        "This visit's date has passed, so its reminders won't be sent."
      )
    ).toBeInTheDocument();
  });

  it('needs a saved visit to send a test reminder', () => {
    render(
      <Harness initial={{ reminder_enabled: true, reminder_offsets: [1440] }} />
    );
    expect(
      screen.getByRole('button', { name: 'Send test reminder now' })
    ).toBeDisabled();
  });

  it('sends a test reminder for a saved visit', async () => {
    api.sendVisitTestReminder.mockResolvedValue(undefined);
    render(
      <Harness
        visitId={42}
        initial={{ reminder_enabled: true, reminder_offsets: [1440] }}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Send test reminder now' })
    );
    await waitFor(() =>
      expect(api.sendVisitTestReminder).toHaveBeenCalledWith(42)
    );
  });
});
