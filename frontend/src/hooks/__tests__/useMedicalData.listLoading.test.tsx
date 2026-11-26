import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useMedicalData } from '../useMedicalData';

// Pages gate their full-page loader on listLoading. If it turned true during a
// save, the open form and the files queued in it would be unmounted.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../useGlobalData', () => ({
  useCurrentPatient: () => ({ patient: { id: 1 }, loading: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Hook = ReturnType<typeof useMedicalData>;

const deferred = <T,>() => {
  let resolve!: (_value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

const renderMedicalData = () => {
  const api = {
    getByPatient: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  };
  const view = renderHook(() =>
    useMedicalData({ entityName: 'injury', apiMethodsConfig: api })
  );
  return { api, ...view };
};

describe('useMedicalData listLoading', () => {
  it.each<['create' | 'update', (_hook: Hook) => Promise<unknown>]>([
    ['create', hook => hook.createItem({ injury_name: 'Sprain' })],
    ['update', hook => hook.updateItem(5, { injury_name: 'Sprain' })],
  ])('stays false while a record %s runs', async (method, save) => {
    const { api, result } = renderMedicalData();
    const response = deferred<{ id: number }>();
    api[method].mockReturnValue(response.promise);

    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = save(result.current);
    });

    // loading still covers the save, for pages that use it as save feedback
    expect(result.current.loading).toBe(true);
    expect(result.current.listLoading).toBe(false);

    await act(async () => {
      response.resolve({ id: 5 });
      await saving;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.listLoading).toBe(false);
  });

  it('is true while the list refreshes', async () => {
    const { api, result } = renderMedicalData();
    const response = deferred<unknown[]>();
    api.getByPatient.mockReturnValue(response.promise);

    let refreshing: Promise<unknown> = Promise.resolve();
    act(() => {
      refreshing = result.current.refreshData();
    });
    expect(result.current.listLoading).toBe(true);

    await act(async () => {
      response.resolve([]);
      await refreshing;
    });
    expect(result.current.listLoading).toBe(false);
  });
});
