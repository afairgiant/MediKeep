import { describe, expect, it, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardAwarePopoverProps, useKeyboardInset } from './useKeyboardAwarePopover';

const realVisualViewport = window.visualViewport;
const realInnerHeight = window.innerHeight;

const stubVisualViewport = ({ height = 800, offsetTop = 0 } = {}) => {
  const listeners = new Map();
  const viewport = {
    height,
    offsetTop,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
    dispatch: type => listeners.get(type)?.(),
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  return viewport;
};

const setInnerHeight = value => {
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

describe('useKeyboardInset', () => {
  it('reports zero when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });
    setInnerHeight(800);
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('reports zero when the visual viewport covers the layout viewport', () => {
    const viewport = stubVisualViewport({ height: 800, offsetTop: 0 });
    setInnerHeight(800);
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
    viewport.height = 780;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toBe(20);
  });

  it('tracks the keyboard opening and closing via visualViewport resize', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() => useKeyboardInset());

    // iOS keyboard covers roughly the bottom third of the screen.
    viewport.height = 420;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toBe(380);

    // Keyboard dismissed: visual viewport grows back to full height.
    viewport.height = 800;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toBe(0);
  });

  it('stops listening after unmount', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result, unmount } = renderHook(() => useKeyboardInset());
    unmount();
    viewport.height = 400;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toBe(0);
  });
});

describe('useKeyboardAwarePopoverProps', () => {
  it('passes props through unchanged while no keyboard is detected', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() =>
      useKeyboardAwarePopoverProps({ zIndex: 3000 })
    );
    expect(result.current).toEqual({ withinPortal: true, zIndex: 3000 });
    viewport.height = 800;
    act(() => viewport.dispatch('resize'));
    expect(result.current).toEqual({ withinPortal: true, zIndex: 3000 });
  });

  it('flips the popover above the field when the keyboard covers the viewport', () => {
    const viewport = stubVisualViewport({ height: 800 });
    setInnerHeight(800);
    const { result } = renderHook(() =>
      useKeyboardAwarePopoverProps({ zIndex: 3000 })
    );

    viewport.height = 420;
    act(() => viewport.dispatch('resize'));

    expect(result.current).toEqual({
      withinPortal: true,
      zIndex: 3000,
      position: 'top',
      offset: 8,
    });
  });
});
