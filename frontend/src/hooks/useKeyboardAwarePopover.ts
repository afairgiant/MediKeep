import { useEffect, useMemo, useRef, useState } from 'react';

// Below this inset the gap is scrollbar or zoom artifacts, not a keyboard.
const KEYBOARD_INSET_THRESHOLD = 150;

/**
 * Builds `popoverProps` for Mantine date inputs so the calendar stays
 * visible and tappable while the on-screen keyboard is open. Returns the
 * caller's `withinPortal` / `zIndex` unchanged plus, only while the
 * keyboard is open, `position: 'top'` and floating-ui middlewares whose
 * bottom padding excludes the keyboard band from the boundary.
 */
export const useKeyboardAwarePopoverProps = ({
  withinPortal = true,
  zIndex,
}: { withinPortal?: boolean; zIndex?: number } = {}) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardInsetRef = useRef(0);

  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!viewport) return undefined;

    const updateKeyboardState = () => {
      // Height-only comparison: offsetTop grows as iOS pans, so including
      // it would drop the inset to zero mid-pan and flip the placement.
      const inset = window.innerHeight - viewport.height;
      keyboardInsetRef.current = inset > 0 ? Math.round(inset) : 0;
      setKeyboardOpen(prev => {
        const next = inset > KEYBOARD_INSET_THRESHOLD;
        return prev === next ? prev : next;
      });
    };

    updateKeyboardState();
    viewport.addEventListener('resize', updateKeyboardState);
    viewport.addEventListener('scroll', updateKeyboardState);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState);
      viewport.removeEventListener('scroll', updateKeyboardState);
    };
  }, []);

  return useMemo(
    () => ({
      withinPortal,
      ...(zIndex !== undefined && { zIndex }),
      ...(keyboardOpen && {
        position: 'top' as const,
        middlewares: {
          flip: { padding: { bottom: keyboardInsetRef.current } },
          shift: { padding: { bottom: keyboardInsetRef.current } },
        },
      }),
    }),
    [keyboardOpen, withinPortal, zIndex],
  );
};

export default useKeyboardAwarePopoverProps;
