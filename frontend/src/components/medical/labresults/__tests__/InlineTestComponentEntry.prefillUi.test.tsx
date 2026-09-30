import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import render from '../../../../test-utils/render';
import { createEmptyRow } from '../../../../utils/labTestComponentUtils';
import InlineTestComponentEntry, {
  InlineTestComponentMethods,
} from '../InlineTestComponentEntry';

const getTrends = vi.fn();

vi.mock('../../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: {
    getTrendsByPatientAndTest: (...args: unknown[]) => getTrends(...args),
  },
}));
vi.mock('../../../../hooks/useGlobalData', () => ({
  useCurrentPatient: () => ({ patient: { id: 7 } }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const trend = (points: unknown[]) => ({ data_points: points });

async function selectGlucose() {
  const input = screen.getByPlaceholderText(/search tests/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Glucose' } });
  const options = await screen.findAllByRole('option');
  fireEvent.click(options[0]);
}

describe('InlineTestComponentEntry reference range prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills min/max from the most recent previous result', async () => {
    getTrends.mockResolvedValue(
      trend([
        {
          unit: 'mg/dL',
          ref_range_min: 70,
          ref_range_max: 99,
          lab_result: { completed_date: '2024-01-01' },
        },
      ])
    );
    render(<InlineTestComponentEntry defaultExpanded />);
    await selectGlucose();

    await waitFor(() => {
      expect(screen.getByDisplayValue('70')).toBeInTheDocument();
      expect(screen.getByDisplayValue('99')).toBeInTheDocument();
    });
    expect(getTrends).toHaveBeenCalledWith(
      7,
      expect.any(String),
      expect.objectContaining({ unit: 'mg/dL' }),
      expect.any(AbortSignal)
    );
  });

  it('fills range text from the most recent previous result', async () => {
    getTrends.mockResolvedValue(
      trend([
        {
          unit: 'mg/dL',
          ref_range_text: '<140 mg/dL',
          lab_result: { completed_date: '2024-01-01' },
        },
      ])
    );
    render(<InlineTestComponentEntry defaultExpanded />);
    await selectGlucose();

    await waitFor(() =>
      expect(screen.getByDisplayValue('<140 mg/dL')).toBeInTheDocument()
    );
  });

  it('fills the range when a typed test name is left without selecting an option', async () => {
    getTrends.mockResolvedValue(
      trend([
        {
          unit: '',
          ref_range_min: 4,
          ref_range_max: 9,
          lab_result: { completed_date: '2024-01-01' },
        },
      ])
    );
    render(<InlineTestComponentEntry defaultExpanded />);
    const input = screen.getByPlaceholderText(/search tests/i);
    fireEvent.change(input, { target: { value: 'My Custom Test' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue('4')).toBeInTheDocument();
      expect(screen.getByDisplayValue('9')).toBeInTheDocument();
    });
    expect(getTrends).toHaveBeenCalledWith(
      7,
      'My Custom Test',
      expect.anything(),
      expect.any(AbortSignal)
    );
  });

  it('does not overwrite a range typed before the lookup returns', async () => {
    let resolve: (_value: unknown) => void = () => {};
    getTrends.mockReturnValue(new Promise(r => (resolve = r)));
    render(<InlineTestComponentEntry defaultExpanded />);
    const input = screen.getByPlaceholderText(/search tests/i);
    fireEvent.change(input, { target: { value: 'My Custom Test' } });
    fireEvent.blur(input);

    fireEvent.change(screen.getByPlaceholderText(/4\.0-5\.6/), {
      target: { value: '1-2' },
    });
    resolve(
      trend([
        { unit: '', ref_range_text: '5-6', lab_result: { completed_date: '2024-01-01' } },
      ])
    );
    await waitFor(() => expect(getTrends).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByDisplayValue('5-6')).not.toBeInTheDocument();
  });

  it('fills ranges for rows injected from the panel/test selector', async () => {
    getTrends.mockResolvedValue(
      trend([
        {
          unit: 'g/dL',
          ref_range_min: 3.5,
          ref_range_max: 5,
          lab_result: { completed_date: '2024-01-01' },
        },
      ])
    );
    let methods: InlineTestComponentMethods | null = null;
    render(
      <InlineTestComponentEntry
        onRef={m => {
          methods = m;
        }}
      />
    );
    await waitFor(() => expect(methods).not.toBeNull());

    act(() => {
      methods!.setComponents([
        {
          ...createEmptyRow(1),
          test_name: 'Albumin',
          canonical_test_name: 'Albumin',
          unit: 'g/dL',
        },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    });
    expect(getTrends).toHaveBeenCalledWith(
      7,
      'Albumin',
      expect.objectContaining({ unit: 'g/dL' }),
      expect.any(AbortSignal)
    );
  });

  it('uses the library default unit for a fully typed library test on blur', async () => {
    getTrends.mockResolvedValue(
      trend([
        {
          unit: 'mg/dL',
          ref_range_min: 70,
          ref_range_max: 99,
          lab_result: { completed_date: '2024-01-01' },
        },
      ])
    );
    render(<InlineTestComponentEntry defaultExpanded />);
    const input = screen.getByPlaceholderText(/search tests/i);
    fireEvent.change(input, { target: { value: 'Glucose' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByDisplayValue('70')).toBeInTheDocument());
    expect(getTrends).toHaveBeenCalledWith(
      7,
      'Glucose',
      expect.objectContaining({ unit: 'mg/dL' }),
      expect.any(AbortSignal)
    );
  });

  it('does not fill when the unit is changed before the lookup returns', async () => {
    let resolve: (_value: unknown) => void = () => {};
    getTrends.mockReturnValue(new Promise(r => (resolve = r)));
    render(<InlineTestComponentEntry defaultExpanded />);
    const input = screen.getByPlaceholderText(/search tests/i);
    fireEvent.change(input, { target: { value: 'My Custom Test' } });
    fireEvent.blur(input);

    fireEvent.change(screen.getByPlaceholderText(/unit/i), {
      target: { value: 'mmol/L' },
    });
    resolve(
      trend([
        { unit: '', ref_range_min: 4, ref_range_max: 9, lab_result: { completed_date: '2024-01-01' } },
      ])
    );
    await waitFor(() => expect(getTrends).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByDisplayValue('4')).not.toBeInTheDocument();
  });

  it('leaves the fields empty when there is no history', async () => {
    getTrends.mockResolvedValue(trend([]));
    render(<InlineTestComponentEntry defaultExpanded />);
    await selectGlucose();

    await waitFor(() => expect(getTrends).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('70')).not.toBeInTheDocument();
  });
});
