import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedViewMode } from '../usePersistedViewMode';

const STORAGE_KEY = 'medikeep_viewmode';

describe('usePersistedViewMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns "cards" by default when no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode());
    expect(result.current[0]).toBe('cards');
  });

  test('returns custom default when provided and no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode('table'));
    expect(result.current[0]).toBe('table');
  });

  test('reads stored value from localStorage on init', () => {
    localStorage.getItem.mockReturnValue('table');

    const { result } = renderHook(() => usePersistedViewMode('cards'));
    expect(result.current[0]).toBe('table');
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  test('writes to localStorage when viewMode changes', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode('cards'));

    act(() => {
      result.current[1]('table');
    });

    expect(result.current[0]).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'table');
  });

  test('ignores invalid stored values and falls back to default', () => {
    localStorage.getItem.mockReturnValue('grid');

    const { result } = renderHook(() => usePersistedViewMode('cards'));
    expect(result.current[0]).toBe('cards');
  });

  test('ignores empty string stored value', () => {
    localStorage.getItem.mockReturnValue('');

    const { result } = renderHook(() => usePersistedViewMode('cards'));
    expect(result.current[0]).toBe('cards');
  });

  test('gracefully handles localStorage.getItem throwing', () => {
    localStorage.getItem.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const { result } = renderHook(() => usePersistedViewMode('cards'));
    expect(result.current[0]).toBe('cards');
  });

  test('gracefully handles localStorage.setItem throwing', () => {
    localStorage.getItem.mockReturnValue(null);
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });

    const { result } = renderHook(() => usePersistedViewMode('cards'));

    act(() => {
      result.current[1]('table');
    });

    // State still updates even if storage fails
    expect(result.current[0]).toBe('table');
  });

  test('persists value across hook re-renders', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result, rerender } = renderHook(() => usePersistedViewMode('cards'));

    act(() => {
      result.current[1]('table');
    });

    rerender();
    expect(result.current[0]).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'table');
  });
});
