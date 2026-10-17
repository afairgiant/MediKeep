import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BloodDonationCard, {
  formatBloodPressure,
  formatTemperature,
  formatHemoglobin,
} from '../BloodDonationCard';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatLongDate: date => (date ? `long:${date}` : null),
  }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const renderCard = props =>
  render(
    <MantineProvider>
      <BloodDonationCard
        donation={{
          id: 7,
          donation_date: '2026-09-01',
          donation_type: 'whole_blood',
          location: 'DRK Blutspende',
          systolic_bp: 125,
          diastolic_bp: 80,
          temperature: 98.6,
          hemoglobin: 14.2,
          notes: 'Felt fine',
        }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onView={vi.fn()}
        unitSystem="metric"
        {...props}
      />
    </MantineProvider>
  );

describe('BloodDonationCard', () => {
  test('renders the formatted date as the title, location as subtitle, and the type badge', () => {
    renderCard();
    expect(screen.getByText('long:2026-09-01')).toBeInTheDocument();
    expect(screen.getByText('DRK Blutspende')).toBeInTheDocument();
    expect(screen.getAllByText('Whole Blood').length).toBeGreaterThan(0);
  });

  test('renders screening values with units, temperature converted', () => {
    renderCard();
    expect(screen.getByText('125/80 mmHg')).toBeInTheDocument();
    expect(screen.getByText('37 °C')).toBeInTheDocument();
    expect(screen.getByText('14.2 g/dL')).toBeInTheDocument();
  });

  test('omits screening fields when absent', () => {
    renderCard({
      donation: {
        id: 8,
        donation_date: '2026-09-01',
        donation_type: 'plasma',
      },
    });
    expect(screen.queryByText(/mmHg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/g\/dL/)).not.toBeInTheDocument();
  });

  test('does not render a location subtitle when location is absent', () => {
    renderCard({
      donation: {
        id: 9,
        donation_date: '2026-09-01',
        donation_type: 'plasma',
      },
    });
    expect(screen.queryByText('DRK Blutspende')).not.toBeInTheDocument();
  });

  test('calls onView when the view button is clicked', async () => {
    const onView = vi.fn();
    renderCard({ onView });
    await userEvent.click(screen.getByRole('button', { name: /view/i }));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  test('calls onEdit with the donation object when the edit button is clicked', async () => {
    const onEdit = vi.fn();
    renderCard({ onEdit });
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  test('calls onDelete with the donation id when the delete button is clicked', async () => {
    const onDelete = vi.fn();
    renderCard({ onDelete });
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(7);
  });
});

describe('formatBloodPressure', () => {
  test('formats both values when present', () => {
    expect(formatBloodPressure({ systolic_bp: 125, diastolic_bp: 80 })).toBe(
      '125/80 mmHg'
    );
  });

  test('formats with a placeholder when only systolic is present', () => {
    expect(formatBloodPressure({ systolic_bp: 125, diastolic_bp: null })).toBe(
      '125/— mmHg'
    );
  });

  test('formats with a placeholder when only diastolic is present', () => {
    expect(formatBloodPressure({ systolic_bp: null, diastolic_bp: 80 })).toBe(
      '—/80 mmHg'
    );
  });

  test('returns null when both values are missing', () => {
    expect(formatBloodPressure({})).toBeNull();
  });
});

describe('formatTemperature', () => {
  test('formats in imperial units', () => {
    expect(formatTemperature(98.6, 'imperial')).toBe('98.6 °F');
  });

  test('formats in metric units (converted)', () => {
    expect(formatTemperature(98.6, 'metric')).toBe('37 °C');
  });

  test('returns null when temperature is null or undefined', () => {
    expect(formatTemperature(null, 'metric')).toBeNull();
    expect(formatTemperature(undefined, 'imperial')).toBeNull();
  });
});

describe('formatHemoglobin', () => {
  test('formats with units', () => {
    expect(formatHemoglobin(14)).toBe('14 g/dL');
  });

  test('returns null when missing', () => {
    expect(formatHemoglobin(null)).toBeNull();
    expect(formatHemoglobin(undefined)).toBeNull();
  });
});
