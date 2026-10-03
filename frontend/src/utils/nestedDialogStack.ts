/**
 * Escape-key guard for dialogs opened from inside another dialog.
 *
 * Mantine gives every open modal its own `window` keydown listener (capture)
 * and has no notion of stacking, so Escape in a sub-dialog also closes the dialog
 * underneath it, discarding that dialog's unsaved edits. This module keeps a stack
 * of sub-dialogs; while it is not empty, Escape closes only the topmost one and is
 * not delivered to any modal's own listener.
 *
 * It must be imported before the app renders (see index.jsx): listeners on the
 * same target run in registration order, and the guard has to run before the
 * listeners that Mantine adds when each modal mounts.
 */

type CloseFn = () => void;

const stack: CloseFn[] = [];

/** Register a sub-dialog while it is open. Returns the unregister function. */
export const registerNestedDialog = (close: CloseFn): (() => void) => {
  stack.push(close);
  return () => {
    const index = stack.lastIndexOf(close);
    if (index !== -1) stack.splice(index, 1);
  };
};

/** Number of sub-dialogs currently registered (mainly for tests). */
export const nestedDialogCount = () => stack.length;

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.isComposing || stack.length === 0) return;

  // Same rule Mantine uses: an open dropdown handles its own Escape first
  const target = event.target as Element | null;
  if (target?.getAttribute?.('data-mantine-stop-propagation') === 'true')
    return;

  event.stopImmediatePropagation();
  stack[stack.length - 1]();
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown, { capture: true });
}
