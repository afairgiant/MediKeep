import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedViewMode } from '../usePersistedViewMode';

const LEGACY_KEY = 'medikeep_viewmode';

function storageKey(pageKey) {
  return `medikeep_viewmode_${pageKey}`;
}

describe('usePersistedViewMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns "cards" by default when no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode('allergies'));
    expect(result.current[0]).toBe('cards');
  });

  test('returns custom default when provided and no stored value', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode('allergies', 'table'));
    expect(result.current[0]).toBe('table');
  });

  test('reads stored value from page-specific localStorage key on init', () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === storageKey('medications')) return 'table';
      return null;
    });

    const { result } = renderHook(() => usePersistedViewMode('medications'));
    expect(result.current[0]).toBe('table');
    expect(localStorage.getItem).toHaveBeenCalledWith(storageKey('medications'));
  });

  test('writes to page-specific localStorage key when viewMode changes', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePersistedViewMode('medications'));

    act(() => {
      result.current[1]('table');
    });

    expect(result.current[0]).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith(storageKey('medications'), 'table');
  });

  test('ignores invalid stored values and falls back to default', () => {
    localStorage.getItem.mockReturnValue('grid');

    const { result } = renderHook(() => usePersistedViewMode('allergies'));
    expect(result.current[0]).toBe('cards');
  });

  test('ignores empty string stored value', () => {
    localStorage.getItem.mockReturnValue('');

    const { result } = renderHook(() => usePersistedViewMode('allergies'));
    expect(result.current[0]).toBe('cards');
  });

  test('gracefully handles localStorage.getItem throwing', () => {
    localStorage.getItem.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const { result } = renderHook(() => usePersistedViewMode('allergies'));
    expect(result.current[0]).toBe('cards');
  });

  test('gracefully handles localStorage.setItem throwing', () => {
    localStorage.getItem.mockReturnValue(null);
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });

    const { result } = renderHook(() => usePersistedViewMode('allergies'));

    act(() => {
      result.current[1]('table');
    });

    // State still updates even if storage fails
    expect(result.current[0]).toBe('table');
  });

  test('persists value across hook re-renders', () => {
    localStorage.getItem.mockReturnValue(null);

    const { result, rerender } = renderHook(() => usePersistedViewMode('allergies'));

    act(() => {
      result.current[1]('table');
    });

    rerender();
    expect(result.current[0]).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith(storageKey('allergies'), 'table');
  });

  test('different pageKeys store independently', () => {
    const store = {};
    localStorage.getItem.mockImplementation((key) => store[key] || null);
    localStorage.setItem.mockImplementation((key, value) => { store[key] = value; });

    const { result: medsResult } = renderHook(() => usePersistedViewMode('medications'));
    const { result: labsResult } = renderHook(() => usePersistedViewMode('lab-results'));

    act(() => {
      medsResult.current[1]('table');
    });

    expect(medsResult.current[0]).toBe('table');
    expect(labsResult.current[0]).toBe('cards');
    expect(store[storageKey('medications')]).toBe('table');
    expect(store[storageKey('lab-results')]).toBe('cards');
  });

  test('migrates from legacy global key when no page-specific key exists', () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === LEGACY_KEY) return 'table';
      return null;
    });

    const { result } = renderHook(() => usePersistedViewMode('medications'));

    expect(result.current[0]).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith(storageKey('medications'), 'table');
  });

  test('prefers page-specific key over legacy global key', () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === storageKey('medications')) return 'cards';
      if (key === LEGACY_KEY) return 'table';
      return null;
    });

    const { result } = renderHook(() => usePersistedViewMode('medications'));
    expect(result.current[0]).toBe('cards');
  });
});
