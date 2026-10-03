import { vi, describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import render, { screen } from '../../../../test-utils/render';
import OccurrenceDetailCard from '../OccurrenceDetailCard';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: date => `date:${date}` }),
}));

const timelineOccurrence = {
  occurrence_id: 7,
  symptom_id: 3,
  symptom_name: 'Migraine',
  symptom_status: 'active',
  date: '2026-03-01',
  severity: 'severe',
  pain_scale: 8,
  occurrence_time: '14:30:00',
  associated_symptoms: ['Nausea'],
  resolved_date: null,
};

const renderCard = (occurrence, onViewSymptom = vi.fn()) => {
  render(
    <div data-testid="card">
      <OccurrenceDetailCard
        occurrence={occurrence}
        onViewSymptom={onViewSymptom}
      />
    </div>
  );
  return screen.getByTestId('card');
};

describe('OccurrenceDetailCard', () => {
  it('renders episode detail from timeline data', () => {
    const card = renderCard(timelineOccurrence);

    expect(screen.getByText('Migraine')).toBeInTheDocument();
    expect(card).toHaveTextContent('Time: 2:30 PM');
    expect(screen.getByText('Nausea')).toBeInTheDocument();
    expect(screen.getByText('Ongoing')).toBeInTheDocument();
  });

  it('shows the resolution instead of a status badge once resolved', () => {
    const card = renderCard({
      ...timelineOccurrence,
      resolved_date: '2026-03-02',
    });

    expect(card).toHaveTextContent('Resolved: date:2026-03-02');
    expect(screen.queryByText('Ongoing')).not.toBeInTheDocument();
  });

  it('shows a resolved badge when only the parent symptom is resolved', () => {
    renderCard({ ...timelineOccurrence, symptom_status: 'resolved' });

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByText('Ongoing')).not.toBeInTheDocument();
  });

  it('opens the parent symptom', () => {
    const onViewSymptom = vi.fn();
    renderCard(timelineOccurrence, onViewSymptom);

    fireEvent.click(screen.getByText('View Symptom'));

    expect(onViewSymptom).toHaveBeenCalledWith(3);
  });
});
