import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen } from '../../../test-utils/render';
import SymptomTimeline from '../SymptomTimeline';

const api = vi.hoisted(() => ({
  getTimeline: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: api,
  default: api,
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ locale: 'en-US' }),
}));
vi.mock('../symptoms', () => ({
  OccurrenceDetailCard: () => <div data-testid="occurrence-card" />,
  SymptomViewModal: () => null,
}));

// Only fails west of UTC, where a date-only string parsed as UTC lands on the previous day
describe('SymptomTimeline shows the calendar date an episode was logged for', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTimeline.mockResolvedValue([
      {
        date: '2026-09-26',
        severity: 'mild',
        symptom_id: 5,
        symptom_name: 'Headache',
        symptom_status: 'active',
      },
    ]);
  });

  it('labels the timeline entry with the occurrence date', async () => {
    render(<SymptomTimeline patientId={7} hidden={false} />);

    expect(await screen.findByText('Sat, Sep 26, 2026')).toBeInTheDocument();
  });

  it('titles the episode modal with the occurrence date', async () => {
    render(<SymptomTimeline patientId={7} hidden={false} />);

    await userEvent.click(await screen.findByText('mild'));

    expect(
      await screen.findByText(
        'Symptom Episodes on Saturday, September 26, 2026'
      )
    ).toBeInTheDocument();
  });
});
