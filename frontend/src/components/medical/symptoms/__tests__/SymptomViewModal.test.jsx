import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import render, { screen } from '../../../../test-utils/render';
import SymptomViewModal from '../SymptomViewModal';
import { symptomApi } from '../../../../services/api/symptomApi';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: date => `date:${date}` }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../services/api/symptomApi', () => ({
  symptomApi: { getOccurrences: vi.fn(), deleteOccurrence: vi.fn() },
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));

const symptom = {
  id: 3,
  symptom_name: 'Migraine',
  status: 'active',
  is_chronic: false,
  category: null,
  typical_triggers: [],
  tags: [],
  general_notes: null,
};

const makeOccurrences = count =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    symptom_id: 3,
    occurrence_date: '2026-03-01',
    severity: 'mild',
    pain_scale: null,
    location: `episode-${index + 1}`,
  }));

const openEpisodesTab = async occurrences => {
  symptomApi.getOccurrences.mockResolvedValue(occurrences);
  render(
    <SymptomViewModal
      isOpen
      onClose={vi.fn()}
      symptom={symptom}
      onEditOccurrence={vi.fn()}
    />
  );
  await waitFor(() => expect(symptomApi.getOccurrences).toHaveBeenCalled());
  fireEvent.click(await screen.findByText(`Episodes (${occurrences.length})`));
  return screen.findByRole('tabpanel');
};

describe('SymptomViewModal - episode history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the episode fields that were only visible in the edit form', async () => {
    const panel = await openEpisodesTab([
      {
        id: 11,
        symptom_id: 3,
        occurrence_date: '2026-03-01',
        severity: 'severe',
        pain_scale: 8,
        associated_symptoms: ['Nausea', 'Dizziness'],
        resolved_date: '2026-03-02',
        resolved_time: '09:05:00',
        resolution_notes: 'Faded after sleep',
        notes: 'First line\nSecond line\nThird line',
      },
    ]);

    expect(screen.getByText('Nausea')).toBeInTheDocument();
    expect(screen.getByText('Dizziness')).toBeInTheDocument();
    expect(panel).toHaveTextContent('Resolved: date:2026-03-02 9:05 AM');
    expect(panel).toHaveTextContent('Resolution Notes: Faded after sleep');
    expect(panel).toHaveTextContent('Third line');
  });

  it('fetches episodes without a page limit', async () => {
    await openEpisodesTab(makeOccurrences(1));

    expect(symptomApi.getOccurrences).toHaveBeenCalledWith(3);
  });

  it('shows the empty state when no episodes are logged', async () => {
    const panel = await openEpisodesTab([]);

    expect(panel).toHaveTextContent('No episodes logged yet');
  });

  it('pages the episode list', async () => {
    const panel = await openEpisodesTab(makeOccurrences(25));

    expect(panel).toHaveTextContent('episode-20');
    expect(panel).not.toHaveTextContent('episode-21');

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(panel).toHaveTextContent('episode-21');
    expect(panel).not.toHaveTextContent('episode-20');
  });

  it('does not show pagination for a single page', async () => {
    await openEpisodesTab(makeOccurrences(20));

    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });
});
