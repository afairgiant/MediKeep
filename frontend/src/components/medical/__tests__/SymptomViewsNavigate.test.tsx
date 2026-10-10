import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import SymptomTimeline from '../SymptomTimeline';
import SymptomCalendar from '../SymptomCalendar';
import { formatDateForAPI } from '../../../utils/dateUtils';

const api = vi.hoisted(() => ({
  getTimeline: vi.fn(),
  getById: vi.fn(),
}));
const modal = vi.hoisted(() => ({
  lastProps: null as null | { navigate?: unknown },
}));

vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: api,
  default: api,
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
// The real view modal is covered elsewhere; here only what the views hand to it matters
vi.mock('../symptoms', () => ({
  OccurrenceDetailCard: ({
    onViewSymptom,
  }: {
    onViewSymptom: (_id: number) => void;
  }) => (
    <button type="button" onClick={() => onViewSymptom(5)}>
      open-symptom
    </button>
  ),
  SymptomViewModal: (props: { navigate?: unknown }) => {
    modal.lastProps = props;
    return <div data-testid="symptom-view-modal" />;
  },
}));

const SYMPTOM = { id: 5, symptom_name: 'Headache', tags: [] };

beforeEach(() => {
  vi.clearAllMocks();
  modal.lastProps = null;
  api.getById.mockResolvedValue(SYMPTOM);
});

describe('Symptom views open the symptom with navigation, so its visits can be opened', () => {
  it('Timeline: the symptom view modal receives navigate', async () => {
    api.getTimeline.mockResolvedValue([
      {
        date: '2026-03-01',
        severity: 'mild',
        symptom_id: 5,
        symptom_name: 'Headache',
        symptom_status: 'active',
      },
    ]);
    render(<SymptomTimeline patientId={7} hidden={false} />);

    await userEvent.click(await screen.findByText('mild'));
    await userEvent.click(await screen.findByText('open-symptom'));

    expect(await screen.findByTestId('symptom-view-modal')).toBeInTheDocument();
    expect(typeof modal.lastProps?.navigate).toBe('function');
  });

  it('Calendar: the symptom view modal receives navigate', async () => {
    const now = new Date();
    const dateKey = formatDateForAPI(
      new Date(now.getFullYear(), now.getMonth(), 15)
    );
    api.getTimeline.mockResolvedValue([
      {
        date: dateKey,
        severity: 'mild',
        symptom_id: 5,
        symptom_name: 'Headache',
        symptom_status: 'active',
      },
    ]);
    render(<SymptomCalendar patientId={7} hidden={false} />);

    await waitFor(() => expect(api.getTimeline).toHaveBeenCalled());
    await userEvent.click(await screen.findByText('15'));
    await userEvent.click(await screen.findByText('open-symptom'));

    expect(await screen.findByTestId('symptom-view-modal')).toBeInTheDocument();
    expect(typeof modal.lastProps?.navigate).toBe('function');
  });
});
