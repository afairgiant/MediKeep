import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import render from '../../../../../test-utils/render';
import ImmunizationHistoryTab from '../ImmunizationHistoryTab';
import { apiService } from '../../../../../services/api';

vi.mock('../../../../../services/api', () => ({
  apiService: {
    getImmunizationHistory: vi.fn(),
  },
}));

const mockedApi = apiService as unknown as {
  getImmunizationHistory: ReturnType<typeof vi.fn>;
};

const sampleResponse = {
  items: [
    {
      id: 1,
      patient_id: 42,
      vaccine_name: 'DTaP',
      vaccine_trade_name: null,
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
    },
  ],
  diseases_index: {
    Diphtheria: [1],
    Tetanus: [1],
    Pertussis: [1],
  },
  unmatched_count: 0,
};

describe('ImmunizationHistoryTab', () => {
  beforeEach(() => {
    mockedApi.getImmunizationHistory.mockReset();
  });

  it('renders the By Date view by default and lists immunizations', async () => {
    mockedApi.getImmunizationHistory.mockResolvedValue(sampleResponse);

    render(<ImmunizationHistoryTab patientId={42} />);

    await waitFor(() => expect(screen.getByText('DTaP')).toBeInTheDocument());
    expect(screen.getByText('Diphtheria')).toBeInTheDocument();
    expect(screen.getByText('Tetanus')).toBeInTheDocument();
    expect(screen.getByText('Pertussis')).toBeInTheDocument();
  });

  it.skip('switches to By Disease view when toggled [enable after Task 11]', async () => {
    mockedApi.getImmunizationHistory.mockResolvedValue(sampleResponse);
    const user = userEvent.setup();

    render(<ImmunizationHistoryTab patientId={42} />);
    await waitFor(() => expect(screen.getByText('DTaP')).toBeInTheDocument());

    await user.click(screen.getByRole('radio', { name: /by disease/i }));

    expect(await screen.findByText(/Diphtheria/)).toBeInTheDocument();
    expect(screen.getByText(/Tetanus/)).toBeInTheDocument();
    expect(screen.getByText(/Pertussis/)).toBeInTheDocument();
  });

  it('renders empty state when no records', async () => {
    mockedApi.getImmunizationHistory.mockResolvedValue({
      items: [],
      diseases_index: {},
      unmatched_count: 0,
    });
    render(<ImmunizationHistoryTab patientId={42} />);
    expect(
      await screen.findByText(/no vaccinations/i)
    ).toBeInTheDocument();
  });

  it('shows unmatched banner when unmatched_count > 0', async () => {
    mockedApi.getImmunizationHistory.mockResolvedValue({
      ...sampleResponse,
      unmatched_count: 3,
    });
    render(<ImmunizationHistoryTab patientId={42} />);
    // Both the alert title and body contain "aren't linked", so assert there
    // is at least one matching element rather than insisting on uniqueness.
    await waitFor(() =>
      expect(screen.getAllByText(/aren.?t linked/i).length).toBeGreaterThan(0)
    );
  });

  it('renders error state when API rejects', async () => {
    mockedApi.getImmunizationHistory.mockRejectedValue(
      new Error('Network down')
    );
    render(<ImmunizationHistoryTab patientId={42} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
