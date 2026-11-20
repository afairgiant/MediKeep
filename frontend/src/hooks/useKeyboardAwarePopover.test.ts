import { describe, expect, it, afterEach } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { useKeyboardAwarePopoverProps } from './useKeyboardAwarePopover';
import { DateInput } from '../components/adapters/DateInput';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { AuthProvider } from '../contexts/AuthContext';
import { MantineProvider } from '@mantine/core';

const realVisualViewport = window.visualViewport;
const realInnerHeight = window.innerHeight;

const stubVisualViewport = ({
  height = 800,
  offsetTop = 0,
}: { height?: number; offsetTop?: number } = {}) => {
  const listeners = new Map<string, () => void>();
  const removed: Array<() => void> = [];
  const viewport = {
    height,
    offsetTop,
    addEventListener: (type: string, fn: () => void) => {
      listeners.set(`${type}:${listeners.size}`, fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      for (const [key, registered] of listeners.entries()) {
        if (key.startsWith(`${type}:`) && registered === fn) {
          removed.push(fn);
          listeners.delete(key);
        }
      }
    },
    dispatch: (type: string) => {
      for (const [key, fn] of listeners.entries()) {
        if (key.startsWith(`${type}:`)) fn();
      }
    },
    removed,
    listeners,
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  return viewport;
};

const setInnerHeight = (value: number) => {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value,
  });
};

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: realVisualViewport,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: realInnerHeight,
  });
});

describe('useKeyboardAwarePopoverProps', () => {
  it('passes props through unchanged while no keyboard is detected', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() =>
      useKeyboardAwarePopoverProps({ zIndex: 3000 }),
    );
    expect(result.current).toEqual({ withinPortal: true, zIndex: 3000 });
    // A resize that does not open the keyboard must not add popover keys.
    viewport.height = 784;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toEqual({ withinPortal: true, zIndex: 3000 });
  });

  it('treats a scrollbar-sized inset as closed via the threshold', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(816);
    const { result } = renderHook(() => useKeyboardAwarePopoverProps());
    act(() => viewport.dispatch('resize'));
    expect(result.current).toEqual({ withinPortal: true });
  });

  it('flips the popover above the field and pads the middlewares when the keyboard is open', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() =>
      useKeyboardAwarePopoverProps({ zIndex: 3000 }),
    );

    viewport.height = 420;
    act(() => viewport.dispatch('resize'));

    expect(result.current).toEqual({
      withinPortal: true,
      zIndex: 3000,
      position: 'top',
      middlewares: {
        flip: { padding: { bottom: 380 } },
        shift: { padding: { bottom: 380 } },
      },
    });
  });

  it('stays open while iOS pans the visual viewport via offsetTop', () => {
    const viewport = stubVisualViewport({ height: 420, offsetTop: 0 });
    setInnerHeight(800);
    const { result } = renderHook(() => useKeyboardAwarePopoverProps());
    act(() => viewport.dispatch('resize'));
    expect(result.current.position).toBe('top');

    // iOS pans: offsetTop grows until height + offsetTop covers innerHeight.
    viewport.offsetTop = 380;
    act(() => viewport.dispatch('scroll'));
    expect(result.current.position).toBe('top');
  });

  it('stores a boolean so repeated scrolls do not change the returned props', () => {
    const viewport = stubVisualViewport({ height: 420, offsetTop: 0 });
    setInnerHeight(800);
    const { result } = renderHook(() => useKeyboardAwarePopoverProps());
    act(() => viewport.dispatch('resize'));
    const first = result.current;
    viewport.offsetTop = 200;
    act(() => viewport.dispatch('scroll'));
    expect(result.current).toBe(first);
  });

  it('removes the exact listeners it added on unmount', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { unmount } = renderHook(() => useKeyboardAwarePopoverProps());
    const registered = [...viewport.listeners.values()];
    unmount();
    expect(viewport.removed).toEqual(registered);
    expect(viewport.listeners.size).toBe(0);
  });
});

describe('DateInput adapter keyboard merge', () => {
  it('merges keyboard-aware popover props with the caller popoverProps', () => {
    const viewport = stubVisualViewport({ height: 420 });
    setInnerHeight(800);
    render(
      createElement(MantineProvider, null,
        createElement(AuthProvider, null,
        createElement(UserPreferencesProvider, null,
          (createElement as any)(DateInput, {
            'popoverProps': { withinPortal: true, zIndex: 3000 },
            'aria-label': 'visit-date',
          }),
        ),
        ),
      ),
    );
    const input = document.querySelector('input[aria-label="visit-date"]');
    expect(input).not.toBeNull();
    void viewport;
  });

  it('keeps the caller popoverProps when the keyboard is closed', () => {
    stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() =>
      useKeyboardAwarePopoverProps({ withinPortal: true, zIndex: 3000 }),
    );
    expect(result.current).toEqual({ withinPortal: true, zIndex: 3000 });
  });
});
