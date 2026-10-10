import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import SymptomCalendar from '../SymptomCalendar';

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
vi.mock('../symptoms', () => ({
  OccurrenceDetailCard: () => <div data-testid="occurrence-card" />,
  SymptomViewModal: () => null,
}));

const now = new Date();
const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const dayOfMonth = (day: number) =>
  `${monthPrefix}-${String(day).padStart(2, '0')}`;
const lastDayOfMonth = new Date(
  now.getFullYear(),
  now.getMonth() + 1,
  0
).getDate();

const episode = (overrides: Record<string, unknown>) => ({
  severity: 'mild',
  symptom_id: 5,
  symptom_name: 'Headache',
  symptom_status: 'active',
  ...overrides,
});

const renderCalendar = async (episodes: Record<string, unknown>[]) => {
  api.getTimeline.mockResolvedValue(episodes);
  render(<SymptomCalendar patientId={7} hidden={false} />);
  await waitFor(() => expect(api.getTimeline).toHaveBeenCalled());
};

// Clicking an empty day does nothing observable, so the cell's own marking is what gets asserted
const cellOf = (day: number) =>
  screen.getByText(String(day)).closest('[style*="cursor"]');
const expectMarked = (day: number) =>
  expect(cellOf(day)).toHaveStyle({ cursor: 'pointer' });
const expectUnmarked = (day: number) =>
  expect(cellOf(day)).toHaveStyle({ cursor: 'default' });

// Only fails east of UTC, where local midnight serialised as UTC lands on the previous day
describe('SymptomCalendar places episodes on the calendar date they were logged for', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the first through last day of the displayed month', async () => {
    await renderCalendar([]);

    expect(api.getTimeline).toHaveBeenCalledWith(
      7,
      dayOfMonth(1),
      dayOfMonth(lastDayOfMonth)
    );
  });

  it('marks only the day an episode occurred on', async () => {
    await renderCalendar([episode({ date: dayOfMonth(15) })]);
    await screen.findByText('15');

    expectUnmarked(14);
    expectMarked(15);
    expectUnmarked(16);
  });

  it('marks every day of an episode that lasted several days, and no others', async () => {
    await renderCalendar([
      episode({ date: dayOfMonth(10), resolved_date: dayOfMonth(12) }),
    ]);
    await screen.findByText('10');

    expectUnmarked(9);
    [10, 11, 12].forEach(expectMarked);
    expectUnmarked(13);
  });

  it('opens an episode from the day it occurred on', async () => {
    await renderCalendar([episode({ date: dayOfMonth(15) })]);

    await userEvent.click(await screen.findByText('15'));

    expect(await screen.findByTestId('occurrence-card')).toBeInTheDocument();
  });
});

// Only fails where daylight saving starts at midnight, e.g. America/Santiago on this date
describe('SymptomCalendar across a day that has no midnight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('still marks the last day of an episode', async () => {
    await renderCalendar([
      episode({ date: '2026-09-05', resolved_date: '2026-09-07' }),
    ]);
    await screen.findByText('5');

    [5, 6, 7].forEach(expectMarked);
    expectUnmarked(8);
  });
});
