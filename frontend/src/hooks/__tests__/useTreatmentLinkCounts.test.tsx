import { vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getTreatmentMedications: vi.fn(),
  getTreatmentEncounters: vi.fn(),
  getTreatmentLabResults: vi.fn(),
  getTreatmentEquipment: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { setLinkCount } from '../../utils/linkCountStore';
import {
  treatmentLinkCountKey,
  useTreatmentLinkCounts,
} from '../useTreatmentLinkCounts';

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue([]));
});

describe('useTreatmentLinkCounts', () => {
  it('is loading until each count arrives, then gives the number of links', async () => {
    api.getTreatmentMedications.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { result } = renderHook(() => useTreatmentLinkCounts(42));
    expect(result.current.medications).toEqual({
      count: undefined,
      loading: true,
    });

    await waitFor(() =>
      expect(result.current.medications).toEqual({ count: 2, loading: false })
    );
    expect(result.current.encounters).toEqual({ count: 0, loading: false });
    expect(api.getTreatmentMedications).toHaveBeenCalledWith(
      42,
      expect.any(AbortSignal)
    );
  });

  it('marks a count whose request fails as unknown and no longer loading', async () => {
    api.getTreatmentEncounters.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useTreatmentLinkCounts(42));

    await waitFor(() =>
      expect(result.current.encounters).toEqual({
        count: undefined,
        loading: false,
      })
    );
    await waitFor(() => expect(result.current.labResults.count).toBe(0));
  });

  it('does nothing for a treatment that is not saved, or while disabled', () => {
    const unsaved = renderHook(() => useTreatmentLinkCounts(undefined));
    const closed = renderHook(() => useTreatmentLinkCounts(42, false));
    Object.values(api).forEach(fn => expect(fn).not.toHaveBeenCalled());
    expect(unsaved.result.current.medications.loading).toBe(false);
    expect(closed.result.current.medications.loading).toBe(false);
  });

  it('is loaded once however many dialogs of the treatment are open', async () => {
    const view = renderHook(() => useTreatmentLinkCounts(42));
    const form = renderHook(() => useTreatmentLinkCounts(42));
    await waitFor(() => expect(form.result.current.equipment.count).toBe(0));

    expect(api.getTreatmentMedications).toHaveBeenCalledTimes(1);
    expect(api.getTreatmentEncounters).toHaveBeenCalledTimes(1);
    expect(api.getTreatmentLabResults).toHaveBeenCalledTimes(1);
    expect(api.getTreatmentEquipment).toHaveBeenCalledTimes(1);
    expect(view.result.current.equipment.count).toBe(0);
  });

  it('follows the counts the relationship panels report', async () => {
    const { result } = renderHook(() => useTreatmentLinkCounts(42));
    await waitFor(() => expect(result.current.medications.count).toBe(0));

    act(() => setLinkCount(treatmentLinkCountKey(42, 'medications'), 3));

    expect(result.current.medications.count).toBe(3);
  });
});
