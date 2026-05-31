import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import render from '../../../../../test-utils/render';
import HistoryByDateView from '../HistoryByDateView';
import type { ImmunizationHistoryItem } from '../types';

const baseItem: ImmunizationHistoryItem = {
  id: 1,
  patient_id: 42,
  vaccine_name: 'DTaP',
  vaccine_trade_name: 'Daptacel',
  date_administered: '2024-03-15',
  dose_number: 4,
  lot_number: 'ABC123',
  ndc_number: null,
  manufacturer: null,
  site: null,
  route: null,
  expiration_date: null,
  location: null,
  notes: null,
  practitioner_id: null,
  tags: null,
  standardized_vaccine_id: 10,
  components: ['Diphtheria', 'Tetanus', 'Pertussis'],
  is_combined: true,
  is_library_matched: true,
};

const unmatched: ImmunizationHistoryItem = {
  ...baseItem,
  id: 2,
  vaccine_name: 'Custom Vaccine',
  vaccine_trade_name: null,
  components: [],
  is_combined: false,
  is_library_matched: false,
  standardized_vaccine_id: null,
};

describe('HistoryByDateView', () => {
  it('renders vaccine name and disease badges', () => {
    render(<HistoryByDateView items={[baseItem]} />);
    expect(screen.getByText('DTaP (Daptacel)')).toBeInTheDocument();
    expect(screen.getByText('Diphtheria')).toBeInTheDocument();
    expect(screen.getByText('Tetanus')).toBeInTheDocument();
    expect(screen.getByText('Pertussis')).toBeInTheDocument();
    // Dose label uses t() — match the rendered output
    expect(screen.getByText(/Dose 4/)).toBeInTheDocument();
  });

  it('shows Unlinked badge for unmatched records', () => {
    render(<HistoryByDateView items={[unmatched]} />);
    expect(screen.getByText(/unlinked/i)).toBeInTheDocument();
  });

  it('does not render disease badges for unmatched records', () => {
    render(<HistoryByDateView items={[unmatched]} />);
    expect(screen.queryByText('Diphtheria')).not.toBeInTheDocument();
  });

  it('calls onItemClick when a card is clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<HistoryByDateView items={[baseItem]} onItemClick={handleClick} />);

    await user.click(screen.getByRole('button', { name: /DTaP/ }));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(baseItem);
  });

  it('does not assign button role when onItemClick is omitted', () => {
    render(<HistoryByDateView items={[baseItem]} />);
    expect(screen.queryByRole('button', { name: /DTaP/ })).toBeNull();
  });
});
