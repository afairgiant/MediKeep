import { afterEach, describe, expect, it, vi } from 'vitest';

import { nestedDialogCount, registerNestedDialog } from '../nestedDialogStack';

const pressEscape = (target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

describe('nestedDialogStack', () => {
  const unregisters: Array<() => void> = [];
  const register = (close: () => void) => {
    const unregister = registerNestedDialog(close);
    unregisters.push(unregister);
    return unregister;
  };

  afterEach(() => {
    unregisters.splice(0).forEach(unregister => unregister());
  });

  it('closes only the topmost sub-dialog on Escape', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    register(lower);
    register(upper);

    pressEscape();
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  it('keeps Escape away from listeners registered later (the modals underneath)', () => {
    const later = vi.fn();
    register(vi.fn());
    window.addEventListener('keydown', later, { capture: true });
    try {
      pressEscape();
      expect(later).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', later, { capture: true });
    }
  });

  it('does nothing when no sub-dialog is open, so ordinary dialogs behave as before', () => {
    const later = vi.fn();
    window.addEventListener('keydown', later, { capture: true });
    try {
      pressEscape();
      expect(later).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', later, { capture: true });
    }
  });

  it('ignores keys other than Escape', () => {
    const close = vi.fn();
    register(close);
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('lets an open dropdown handle its own Escape first', () => {
    const close = vi.fn();
    const later = vi.fn();
    register(close);
    window.addEventListener('keydown', later, { capture: true });
    const input = document.createElement('input');
    input.setAttribute('data-mantine-stop-propagation', 'true');
    document.body.appendChild(input);
    try {
      pressEscape(input);
      expect(close).not.toHaveBeenCalled();
      expect(later).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', later, { capture: true });
      input.remove();
    }
  });

  it('stops intercepting once the sub-dialog unregisters', () => {
    const close = vi.fn();
    const unregister = register(close);
    expect(nestedDialogCount()).toBe(1);
    unregister();
    expect(nestedDialogCount()).toBe(0);

    pressEscape();
    expect(close).not.toHaveBeenCalled();
  });

  it('unregistering twice is harmless', () => {
    const unregister = register(vi.fn());
    unregister();
    expect(() => unregister()).not.toThrow();
    expect(nestedDialogCount()).toBe(0);
  });
});
