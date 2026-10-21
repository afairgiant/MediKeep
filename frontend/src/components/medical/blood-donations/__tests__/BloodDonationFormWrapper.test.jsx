import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BloodDonationFormWrapper from '../BloodDonationFormWrapper';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'YYYY-MM-DD',
    dateParser: value => new Date(value),
  }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const baseFormData = {
  donation_date: '2026-09-01',
  donation_type: 'whole_blood',
  location: '',
  systolic_bp: '',
  diastolic_bp: '',
  temperature: '',
  hemoglobin: '',
  notes: '',
  tags: [],
};

const buildElement = props => (
  <MantineProvider>
    <BloodDonationFormWrapper
      isOpen
      onClose={vi.fn()}
      title="Add Blood Donation"
      formData={baseFormData}
      onInputChange={vi.fn()}
      onSubmit={vi.fn()}
      unitSystem="metric"
      {...props}
    />
  </MantineProvider>
);

const renderForm = props => render(buildElement(props));

describe('BloodDonationFormWrapper', () => {
  test('renders nothing when closed', () => {
    renderForm({ isOpen: false });
    expect(screen.queryByText('Add Blood Donation')).not.toBeInTheDocument();
  });

  test('shows the donation tab by default', () => {
    renderForm();
    expect(screen.getByText('Add Blood Donation')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /Location/ })
    ).toBeInTheDocument();
  });

  test('screening tab shows temperature in the user unit', async () => {
    renderForm();
    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    expect(screen.getByLabelText(/Temperature \(°C\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hemoglobin \(g\/dL\)/)).toBeInTheDocument();
  });

  test('screening tab shows hemoglobin in the chosen unit', async () => {
    renderForm({ hemoglobinUnit: 'mmol_l' });
    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    expect(screen.getByLabelText(/Hemoglobin \(mmol\/L\)/)).toBeInTheDocument();
  });

  test('typing a location calls onInputChange', async () => {
    const onInputChange = vi.fn();
    renderForm({ onInputChange });
    await userEvent.type(
      screen.getByRole('textbox', { name: /Location/ }),
      'D'
    );
    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'location', value: 'D' },
    });
  });

  test('submit is disabled without date or type', () => {
    renderForm({ formData: { ...baseFormData, donation_type: '' } });
    expect(
      screen.getByRole('button', { name: /Save Donation/ })
    ).toBeDisabled();
  });

  test('submits the form', async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    await userEvent.click(
      screen.getByRole('button', { name: /Save Donation/ })
    );
    expect(onSubmit).toHaveBeenCalled();
  });

  test('submit is disabled when the donation date is missing', () => {
    renderForm({ formData: { ...baseFormData, donation_date: '' } });
    expect(
      screen.getByRole('button', { name: /Save Donation/ })
    ).toBeDisabled();
  });

  test('imperial unit system shows the temperature label in Fahrenheit', async () => {
    renderForm({ unitSystem: 'imperial' });
    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    expect(screen.getByLabelText(/Temperature \(°F\)/)).toBeInTheDocument();
  });

  test('edit mode shows the Update Donation button', () => {
    renderForm({ editingDonation: { id: 5 } });
    expect(
      screen.getByRole('button', { name: /Update Donation/ })
    ).toBeInTheDocument();
  });

  test('changing systolic emits a numeric value', async () => {
    const onInputChange = vi.fn();
    renderForm({ onInputChange });
    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    const systolicInput = screen.getByLabelText(/Systolic/);
    await userEvent.click(systolicInput);
    await userEvent.paste('120');
    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'systolic_bp', value: 120 },
    });
  });

  test('typing a multi-digit systolic value digit by digit lands on the final number', async () => {
    const onInputChange = vi.fn();
    renderForm({ onInputChange });
    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    await userEvent.type(screen.getByLabelText(/Systolic/), '120');
    const lastCall = onInputChange.mock.calls.at(-1)[0];
    expect(lastCall).toEqual({ target: { name: 'systolic_bp', value: 120 } });
  });

  test('reopening the modal resets to the donation tab', async () => {
    const { rerender } = render(buildElement());

    await userEvent.click(
      screen.getByRole('tab', { name: /Pre-donation Screening/ })
    );
    expect(screen.getByLabelText(/Temperature/)).toBeInTheDocument();

    rerender(buildElement({ isOpen: false }));
    expect(screen.queryByText('Add Blood Donation')).not.toBeInTheDocument();

    rerender(buildElement());
    expect(
      screen.getByRole('textbox', { name: /Location/ })
    ).toBeInTheDocument();
  });
});
