import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import render from '../../../../../test-utils/render';
import HistoryByDiseaseView from '../HistoryByDiseaseView';
import type { ImmunizationHistoryItem } from '../types';

const dtap: ImmunizationHistoryItem = {
  id: 1,
  patient_id: 42,
  vaccine_name: 'DTaP',
  vaccine_trade_name: null,
  date_administered: '2024-03-15',
  dose_number: 4,
  lot_number: null,
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

const tdap: ImmunizationHistoryItem = {
  ...dtap,
  id: 2,
  vaccine_name: 'Tdap',
  date_administered: '2014-06-02',
  dose_number: 3,
  components: ['Tetanus', 'Diphtheria', 'Pertussis'],
};

describe('HistoryByDiseaseView', () => {
  const diseasesIndex = {
    Diphtheria: [1, 2],
    Tetanus: [1, 2],
    Pertussis: [1, 2],
  };

  it('renders an accordion section per disease alphabetically', async () => {
    const user = userEvent.setup();
    render(
      <HistoryByDiseaseView
        items={[dtap, tdap]}
        diseasesIndex={diseasesIndex}
      />
    );
    const headers = screen.getAllByRole('button', { name: /diphtheria|tetanus|pertussis/i });
    expect(headers).toHaveLength(3);
    expect(headers[0].textContent).toMatch(/diphtheria/i);
    expect(headers[1].textContent).toMatch(/pertussis/i);
    expect(headers[2].textContent).toMatch(/tetanus/i);

    await user.click(headers[0]); // Open Diphtheria
    expect(screen.getAllByText('DTaP').length).toBeGreaterThan(0);
  });

  it('shows dose counts per disease', () => {
    render(
      <HistoryByDiseaseView
        items={[dtap, tdap]}
        diseasesIndex={diseasesIndex}
      />
    );
    // Diphtheria has 2 doses (DTaP + Tdap both cover it)
    // The accordion header text combines disease name + count badge
    const diphtheriaHeader = screen.getByRole('button', { name: /diphtheria.*2/i });
    expect(diphtheriaHeader).toBeInTheDocument();
  });

  it('a single combined-vaccine record appears under each component disease', async () => {
    const user = userEvent.setup();
    render(
      <HistoryByDiseaseView
        items={[dtap]}
        diseasesIndex={{
          Diphtheria: [1],
          Tetanus: [1],
          Pertussis: [1],
        }}
      />
    );
    const headers = screen.getAllByRole('button', { name: /diphtheria|tetanus|pertussis/i });
    for (const h of headers) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(h);
    }
    // DTaP appears in all three open sections — THIS IS THE CORE FEATURE
    expect(screen.getAllByText('DTaP').length).toBe(3);
  });

  it('renders helpful empty state when diseasesIndex is empty', () => {
    render(<HistoryByDiseaseView items={[]} diseasesIndex={{}} />);
    expect(screen.getByText(/no linked vaccinations/i)).toBeInTheDocument();
  });
});
