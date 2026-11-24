import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useMedicalData } from '../useMedicalData';

// A failed save is shown inside the open form (formError), not in the page
// alert (error) behind the dialog (#1317).

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

// Already made readable by baseApi, as the backend's 422 message is
const BACKEND_MESSAGE = 'Injury Name: Must be at least 2 characters';
const SHOWN_MESSAGE = `${BACKEND_MESSAGE} (Error: VAL-422)`;

const deferred = <T,>() => {
  let resolve!: (_value: T) => void;
  let reject!: (_reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

const saves: ['create' | 'update', (_hook: Hook) => Promise<unknown>][] = [
  ['create', hook => hook.createItem({ injury_name: 'X' })],
  ['update', hook => hook.updateItem(5, { injury_name: 'X' })],
];

describe('useMedicalData formError', () => {
  it.each(saves)(
    'puts a failed %s in formError and leaves the page error alone',
    async (method, save) => {
      const { api, result } = renderMedicalData();
      api[method].mockRejectedValue(new Error(BACKEND_MESSAGE));

      let returned: unknown;
      await act(async () => {
        returned = await save(result.current);
      });

      expect(returned).toBe(false);
      expect(result.current.formError).toBe(SHOWN_MESSAGE);
      expect(result.current.error).toBeNull();
    }
  );

  it.each(saves)('clears formError when the next %s starts', async (method, save) => {
    const { api, result } = renderMedicalData();
    api[method].mockRejectedValueOnce(new Error(BACKEND_MESSAGE));
    await act(async () => {
      await save(result.current);
    });
    expect(result.current.formError).toBe(SHOWN_MESSAGE);

    api[method].mockResolvedValueOnce({ id: 5 });
    await act(async () => {
      await save(result.current);
    });
    expect(result.current.formError).toBeNull();
  });

  it('still reports a failed save when a list refresh started after it', async () => {
    const { api, result } = renderMedicalData();
    const createResponse = deferred<{ id: number }>();
    const refreshResponse = deferred<unknown[]>();
    api.create.mockReturnValue(createResponse.promise);
    api.getByPatient.mockReturnValue(refreshResponse.promise);

    let saving: Promise<unknown> = Promise.resolve();
    let refreshing: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = result.current.createItem({ injury_name: 'X' });
      refreshing = result.current.refreshData();
    });

    await act(async () => {
      createResponse.reject(new Error(BACKEND_MESSAGE));
      await saving;
    });
    expect(result.current.formError).toBe(SHOWN_MESSAGE);

    await act(async () => {
      refreshResponse.resolve([]);
      await refreshing;
    });
  });
});
