import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedToggle } from '../usePersistedToggle';

const STORAGE_KEY = 'medikeep_test_toggle';

describe('usePersistedToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns false by default when no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY));
    expect(result.current[0]).toBe(false);
  });

  test('returns custom default when provided and no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, true));
    expect(result.current[0]).toBe(true);
  });

  test('reads stored "true" from localStorage on init', () => {
    localStorage.getItem.mockReturnValue('true');

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  test('reads stored "false" from localStorage on init', () => {
    localStorage.getItem.mockReturnValue('false');

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, true));
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  test('writes to localStorage when value changes', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true');
  });

  test('ignores invalid stored values and falls back to default', () => {
    localStorage.getItem.mockReturnValue('invalid');

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));
    expect(result.current[0]).toBe(false);
  });

  test('ignores empty string stored value', () => {
    localStorage.getItem.mockReturnValue('');

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));
    expect(result.current[0]).toBe(false);
  });

  test('gracefully handles localStorage.getItem throwing', () => {
    localStorage.getItem.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));
    expect(result.current[0]).toBe(false);
  });

  test('gracefully handles localStorage.setItem throwing', () => {
    localStorage.getItem.mockReturnValue(null);
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });

    const { result } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));

    act(() => {
      result.current[1](true);
    });

    // State still updates even if storage fails
    expect(result.current[0]).toBe(true);
  });

  test('persists value across hook re-renders', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result, rerender } = renderHook(() => usePersistedToggle(STORAGE_KEY, false));

    act(() => {
      result.current[1](true);
    });

    rerender();
    expect(result.current[0]).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true');
  });
});
