import { vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../test-utils/render';
import MantineMedicationForm from '../MantineMedicationForm';

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
  }),
}));

vi.mock('@mantine/dates', () => ({
  TimeInput: ({ value, onChange, error, ...rest }) => (
    <span>
      <input
        type="time"
        value={value || ''}
        onChange={onChange}
        data-testid="time-input"
        {...rest}
      />
      {error && <span role="alert">{error}</span>}
    </span>
  ),
}));

vi.mock('../../adapters/DateInput', () => ({
  DateInput: ({ value, onChange, label }) => (
    <input
      aria-label={label}
      type="date"
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
    />
  ),
}));

// NOTE: this t() mock returns defaultValue strings verbatim WITHOUT
// interpolation, so rendered text keeps literal {{placeholders}}.
// Assertions should match substrings outside the placeholders.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
  }),
}));

vi.mock('../../../hooks/useFormHandlers', () => ({
  useFormHandlers: onInputChange => ({
    handleTextInputChange: name => e =>
      onInputChange({ target: { name, value: e.target.value } }),
    handleCheckboxChange: name => checked =>
      onInputChange({ target: { name, value: checked } }),
  }),
}));

vi.mock('../../../utils/dateUtils', async importOriginal => ({
  ...(await importOriginal()),
  formatDateInputChange: v => v,
  parseDateInput: v => v,
}));

vi.mock('../../common/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock('../../shared/FormLoadingOverlay', () => ({
  default: () => null,
}));

vi.mock('../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));

vi.mock('../MedicationRelationships', () => ({
  default: () => null,
}));

const sendMedicationTestReminder = vi.fn().mockResolvedValue({});
vi.mock('../../../services/api', () => ({
  apiService: {
    sendMedicationTestReminder: (...args) =>
      sendMedicationTestReminder(...args),
  },
}));

const getPreferenceMatrix = vi.fn();
vi.mock('../../../services/api/notificationApi', () => ({
  default: {
    getPreferenceMatrix: () => getPreferenceMatrix(),
  },
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock('../../../utils/notifyTranslated', () => ({
  notifySuccess: (...args) => notifySuccess(...args),
  notifyError: (...args) => notifyError(...args),
}));

vi.mock('../../../services/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// --- Helper -----------------------------------------------------------------

function setupForm(overrides = {}) {
  const onInputChange = vi.fn();
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Edit Medication',
    formData: {
      medication_name: 'Aspirin',
      reminder_enabled: false,
      reminder_times: [],
    },
    onInputChange,
    onSubmit: vi.fn(),
    editingMedication: { id: 42 },
    ...overrides,
  };
  return { props, onInputChange, ...render(<MantineMedicationForm {...props} />) };
}

// --- Tests ------------------------------------------------------------------

describe('MantineMedicationForm — Reminders tab', () => {
  beforeEach(() => {
    getPreferenceMatrix.mockReset();
    sendMedicationTestReminder.mockClear();
    notifySuccess.mockClear();
    notifyError.mockClear();
  });

  it('renders a Reminders tab', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    setupForm();
    expect(
      await screen.findByRole('tab', { name: /reminders/i })
    ).toBeInTheDocument();
  });

  it('toggling the Switch fires onInputChange for reminder_enabled', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    const { onInputChange } = setupForm();

    await user.click(screen.getByRole('tab', { name: /reminders/i }));
    // The mocked t() returns raw keys for label lookups, so query by role
    // only — the reminders tab renders a single switch.
    const switchEl = await screen.findByRole('switch');
    // fireEvent instead of user.click — Mantine's switch input is visually
    // hidden, which stalls userEvent's pointer simulation under jsdom.
    fireEvent.click(switchEl);

    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: 'reminder_enabled',
          value: true,
        }),
      })
    );
  });

  it('Add time appends an empty entry to reminder_times', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    const { onInputChange } = setupForm();

    await user.click(screen.getByRole('tab', { name: /reminders/i }));
    await user.click(screen.getByRole('button', { name: /add time/i }));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'reminder_times', value: [''] },
    });
  });

  it('shows duplicate-time error when two entries match', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['08:00', '08:00'],
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      await screen.findByText(/already in the list/i)
    ).toBeInTheDocument();
  });

  it('shows invalid-format error for malformed time', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['notatime'],
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(await screen.findByText(/HH:MM/i)).toBeInTheDocument();
  });

  it('shows the no-channel warning when enabled and no preference is on', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/No notification channel is configured/i)
      ).toBeInTheDocument();
    });
  });

  it('hides the no-channel warning when at least one channel is enabled', async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/No notification channel is configured/i)
      ).not.toBeInTheDocument();
    });
  });

  it('test button is disabled when reminders are not enabled', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: false,
        reminder_times: [],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));
    const button = screen.getByRole('button', {
      name: /send test reminder now/i,
    });
    expect(button).toBeDisabled();
  });

  it('test button is disabled when creating a new medication (no id)', async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    setupForm({
      editingMedication: null,
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));
    expect(
      screen.getByRole('button', { name: /send test reminder now/i })
    ).toBeDisabled();
  });

  it('test button calls sendMedicationTestReminder when clicked', async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));
    await user.click(
      screen.getByRole('button', { name: /send test reminder now/i })
    );

    await waitFor(() => {
      expect(sendMedicationTestReminder).toHaveBeenCalledWith(42);
    });
    await waitFor(() => {
      expect(notifySuccess).toHaveBeenCalled();
    });
  });

  it("shows the won't-fire warning when the effective period has ended", async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        status: 'active',
        reminder_enabled: true,
        reminder_times: ['08:00'],
        effective_period_end: '2020-01-01',
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      await screen.findByText(/reminders won't fire/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/effective period ended/i)).toBeInTheDocument();
  });

  it("shows the won't-fire warning when the status is not active", async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        status: 'stopped',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      await screen.findByText(/reminders won't fire/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/not active/i)).toBeInTheDocument();
  });

  it("shows the won't-fire warning when the start date is in the future", async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        status: 'active',
        reminder_enabled: true,
        reminder_times: ['08:00'],
        effective_period_start: '2999-01-01',
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      await screen.findByText(/reminders won't fire/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/doesn't start until/i)).toBeInTheDocument();
  });

  it("hides the won't-fire warning for an active in-period medication", async () => {
    getPreferenceMatrix.mockResolvedValue({
      preferences: { medication_reminder_due: { 1: true } },
    });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        status: 'active',
        reminder_enabled: true,
        reminder_times: ['08:00'],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      screen.queryByText(/reminders won't fire/i)
    ).not.toBeInTheDocument();
  });

  it("hides the won't-fire warning when reminders are disabled", async () => {
    getPreferenceMatrix.mockResolvedValue({ preferences: {} });
    const user = userEvent.setup();
    setupForm({
      formData: {
        medication_name: 'Aspirin',
        status: 'stopped',
        reminder_enabled: false,
        reminder_times: [],
      },
    });

    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    expect(
      screen.queryByText(/reminders won't fire/i)
    ).not.toBeInTheDocument();
  });
});
