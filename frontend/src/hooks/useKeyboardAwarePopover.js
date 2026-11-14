import { useEffect, useMemo, useState } from 'react';

/**
 * Tracks how much of the layout viewport is covered by the on-screen
 * keyboard. On iOS Safari the keyboard shrinks `window.visualViewport`
 * without changing `window.innerHeight`, so layout does not reflow and
 * popovers positioned near the bottom of the screen stay hidden behind
 * the keyboard. The overlap between the layout viewport and the visual
 * viewport is reported as a pixel inset (0 when nothing is covered).
 */
export const useKeyboardInset = () => {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!viewport) return undefined;

    const updateInset = () => {
      const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
      setKeyboardInset(covered > 0 ? Math.round(covered) : 0);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, []);

  return keyboardInset;
};

/**
 * Builds `popoverProps` for Mantine date pickers so the calendar stays
 * fully reachable while the iOS on-screen keyboard is open. When no part
 * of the viewport is covered the props pass through unchanged; once the
 * keyboard is detected the calendar is placed above the field instead of
 * below it, which is where the keyboard cannot cover it.
 */
export const useKeyboardAwarePopoverProps = ({ withinPortal = true, zIndex } = {}) => {
  const keyboardInset = useKeyboardInset();

  return useMemo(() => {
    const merged = zIndex === undefined ? { withinPortal } : { withinPortal, zIndex };
    if (keyboardInset <= 0) return merged;
    return { ...merged, position: 'top', offset: 8 };
  }, [keyboardInset, withinPortal, zIndex]);
};

export default useKeyboardAwarePopoverProps;
