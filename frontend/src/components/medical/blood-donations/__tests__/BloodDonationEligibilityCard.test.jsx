import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import BloodDonationEligibilityCard from '../BloodDonationEligibilityCard';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatLongDate: date => (date ? `long:${date}` : null),
  }),
}));

const renderCard = props =>
  render(
    <MantineProvider>
      <BloodDonationEligibilityCard {...props} />
    </MantineProvider>
  );

describe('BloodDonationEligibilityCard', () => {
  test('renders nothing while loading', () => {
    renderCard({ eligibility: null });
    expect(screen.queryByText('Next Donation')).not.toBeInTheDocument();
  });

  test('shows error message', () => {
    renderCard({ eligibility: null, error: true });
    expect(
      screen.getByText('Could not calculate the next donation date')
    ).toBeInTheDocument();
  });

  test('no donations yet', () => {
    renderCard({
      eligibility: {
        is_eligible: true,
        next_eligible_date: null,
        days_remaining: 0,
      },
    });
    expect(screen.getByText('Eligible to donate now')).toBeInTheDocument();
    expect(screen.getByText('No donations logged yet')).toBeInTheDocument();
  });

  test('shows the estimate disclaimer', () => {
    renderCard({
      eligibility: {
        is_eligible: true,
        next_eligible_date: null,
        days_remaining: 0,
      },
    });
    expect(
      screen.getByText(
        'This is only an estimate. The rules of the donation service take precedence.'
      )
    ).toBeInTheDocument();
  });

  test('waiting period', () => {
    renderCard({
      eligibility: {
        is_eligible: false,
        limiting_donation_date: '2026-09-21',
        limiting_donation_type: 'whole_blood',
        interval_days: 56,
        next_eligible_date: '2026-11-16',
        days_remaining: 46,
      },
    });
    expect(
      screen.getByText('Eligible again on long:2026-11-16')
    ).toBeInTheDocument();
    expect(screen.getByText('46 days remaining')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Based on the Whole Blood donation on long:2026-09-21 and a 56-day interval'
      )
    ).toBeInTheDocument();
  });

  test('eligible after waiting period', () => {
    renderCard({
      eligibility: {
        is_eligible: true,
        limiting_donation_date: '2026-01-01',
        limiting_donation_type: 'plasma',
        interval_days: 14,
        next_eligible_date: '2026-01-15',
        days_remaining: 0,
      },
    });
    expect(screen.getByText('Eligible to donate now')).toBeInTheDocument();
    expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument();
  });
});
