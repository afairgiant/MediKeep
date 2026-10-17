import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BloodDonationViewModal from '../BloodDonationViewModal';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatLongDate: date => (date ? `long:${date}` : null),
  }),
}));

const donation = {
  id: 3,
  donation_date: '2026-08-15',
  donation_type: 'plasma',
  location: 'Uniklinik',
  systolic_bp: 118,
  diastolic_bp: 76,
  temperature: 97.7,
  hemoglobin: 13.8,
  notes: 'Second plasma donation',
  tags: ['plasma'],
};

const renderModal = props =>
  render(
    <MantineProvider>
      <BloodDonationViewModal
        isOpen
        onClose={vi.fn()}
        donation={donation}
        onEdit={vi.fn()}
        unitSystem="imperial"
        {...props}
      />
    </MantineProvider>
  );

describe('BloodDonationViewModal', () => {
  test('returns nothing without a donation', () => {
    renderModal({ donation: null });
    expect(
      screen.queryByText('Blood Donation Details')
    ).not.toBeInTheDocument();
  });

  test('shows details and screening values', () => {
    renderModal();
    expect(screen.getByText('Blood Donation Details')).toBeInTheDocument();
    expect(screen.getByText('long:2026-08-15')).toBeInTheDocument();
    expect(screen.getByText('Uniklinik')).toBeInTheDocument();
    expect(screen.getByText('118/76 mmHg')).toBeInTheDocument();
    expect(screen.getByText('97.7 °F')).toBeInTheDocument();
    expect(screen.getByText('13.8 g/dL')).toBeInTheDocument();
    expect(screen.getByText('Second plasma donation')).toBeInTheDocument();
  });

  test('hides screening section when no values', () => {
    renderModal({
      donation: { id: 4, donation_date: '2026-08-15', donation_type: 'plasma' },
    });
    expect(
      screen.queryByText('Pre-donation Screening')
    ).not.toBeInTheDocument();
  });

  test('shows a lone systolic value with a placeholder for diastolic', () => {
    renderModal({
      donation: {
        id: 5,
        donation_date: '2026-08-15',
        donation_type: 'plasma',
        systolic_bp: 120,
      },
    });
    expect(screen.getByText('Pre-donation Screening')).toBeInTheDocument();
    expect(screen.getByText('120/— mmHg')).toBeInTheDocument();
  });

  test('edit calls onEdit and onClose', async () => {
    const onEdit = vi.fn();
    const onClose = vi.fn();
    renderModal({ onEdit, onClose });
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(donation);
    expect(onClose).toHaveBeenCalled();
  });

  test('returns nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(
      screen.queryByText('Blood Donation Details')
    ).not.toBeInTheDocument();
  });

  test('close calls onClose', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(onClose).toHaveBeenCalled();
  });

  test('disableEdit disables the Edit button', () => {
    renderModal({ disableEdit: true });
    expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
  });

  test('metric unitSystem shows temperature in Celsius', () => {
    renderModal({ unitSystem: 'metric' });
    expect(screen.getByText('36.5 °C')).toBeInTheDocument();
  });

  test('missing location shows "Not specified"', () => {
    renderModal({
      donation: {
        id: 6,
        donation_date: '2026-08-15',
        donation_type: 'plasma',
      },
    });
    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });
});
