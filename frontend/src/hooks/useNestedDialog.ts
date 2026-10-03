import { useEffect, useRef } from 'react';

import { registerNestedDialog } from '../utils/nestedDialogStack';

/**
 * Call from a dialog that is opened from inside another dialog. While `opened`,
 * Escape closes this dialog only (see utils/nestedDialogStack).
 *
 * `onEscape` should be the dialog's normal close handler; it can ignore the call
 * (for example while a save is running) the same way the dialog's own close would.
 */
export const useNestedDialog = (opened: boolean, onEscape: () => void) => {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!opened) return undefined;
    return registerNestedDialog(() => onEscapeRef.current());
  }, [opened]);
};
