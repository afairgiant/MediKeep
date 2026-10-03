import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useMedicalData } from '../useMedicalData';

const mockExecute = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => `${key}|${options?.entity}`,
  }),
}));

vi.mock('../useApi.js', () => ({
  useApi: () => ({
    loading: false,
    error: null,
    execute: mockExecute,
    clearError: vi.fn(),
    setError: vi.fn(),
    cleanup: vi.fn(),
  }),
}));

vi.mock('../useGlobalData', () => ({
  useCurrentPatient: () => ({ patient: { id: 1 }, loading: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

const baseConfig = {
  entityName: 'emergency_contact',
  apiMethodsConfig: { delete: vi.fn() },
};

describe('useMedicalData delete confirmation', () => {
  let confirmSpy;

  beforeEach(() => {
    mockExecute.mockReset();
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('uses the localized message with the translated entity label', async () => {
    confirmSpy.mockReturnValue(false);
    const { result } = renderHook(() =>
      useMedicalData({ ...baseConfig, entityLabel: 'contacto de emergencia' })
    );

    await act(async () => {
      await result.current.deleteItem(5);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'messages.confirmDeleteEntity|contacto de emergencia'
    );
  });

  it('falls back to entityName when no entityLabel is provided', async () => {
    confirmSpy.mockReturnValue(false);
    const { result } = renderHook(() => useMedicalData(baseConfig));

    await act(async () => {
      await result.current.deleteItem(5);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'messages.confirmDeleteEntity|emergency_contact'
    );
  });

  it('does not call the API when the user cancels', async () => {
    confirmSpy.mockReturnValue(false);
    const { result } = renderHook(() => useMedicalData(baseConfig));

    let outcome;
    await act(async () => {
      outcome = await result.current.deleteItem(5);
    });

    expect(outcome).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('uses translated success messages with the entity label', async () => {
    mockExecute.mockResolvedValue({ id: 5 });
    confirmSpy.mockReturnValue(true);
    const { result } = renderHook(() =>
      useMedicalData({
        entityName: 'encounter',
        entityLabel: 'visit',
        apiMethodsConfig: { update: vi.fn(), delete: vi.fn() },
      })
    );

    await act(async () => {
      await result.current.updateItem(5, {});
    });
    expect(result.current.successMessage).toBe('messages.entityUpdated|visit');

    await act(async () => {
      await result.current.deleteItem(5);
    });
    expect(result.current.successMessage).toBe('messages.entityDeleted|visit');
  });
});
