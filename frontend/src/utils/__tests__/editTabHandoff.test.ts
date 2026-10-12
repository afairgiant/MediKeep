import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EDIT_TAB_TTL_MS,
  getRememberedEditTab,
  rememberEditTab,
} from '../editTabHandoff';

describe('editTabHandoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    // Start each test with nothing remembered (an unmapped tab clears it)
    rememberEditTab('procedures', 'no-such-tab');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back when nothing was remembered', () => {
    expect(getRememberedEditTab('procedures', 'basic')).toBe('basic');
  });

  it('maps the View "overview" tab to the Edit form first tab', () => {
    rememberEditTab('procedures', 'overview');
    expect(getRememberedEditTab('procedures', 'basic')).toBe('basic');
    rememberEditTab('visits', 'overview');
    expect(getRememberedEditTab('visits', 'info')).toBe('info');
  });

  it('keeps tabs that have the same name in both dialogs', () => {
    rememberEditTab('procedures', 'clinical');
    expect(getRememberedEditTab('procedures', 'basic')).toBe('clinical');
    rememberEditTab('medications', 'reminders');
    expect(getRememberedEditTab('medications', 'basic')).toBe('reminders');
    rememberEditTab('insurance', 'coverage');
    expect(getRememberedEditTab('insurance', 'basic')).toBe('coverage');
  });

  it('maps differently named tabs', () => {
    rememberEditTab('labResults', 'test-components');
    expect(getRememberedEditTab('labResults', 'basic')).toBe('results');
    rememberEditTab('labResults', 'files');
    expect(getRememberedEditTab('labResults', 'basic')).toBe('documents');
  });

  it('keeps the linked-record tabs of visits, lab results and treatments', () => {
    rememberEditTab('visits', 'link-labResults');
    expect(getRememberedEditTab('visits', 'info')).toBe('link-labResults');
    rememberEditTab('labResults', 'rel-visits');
    expect(getRememberedEditTab('labResults', 'basic')).toBe('rel-visits');
    rememberEditTab('treatments', 'labs');
    expect(getRememberedEditTab('treatments', 'basic')).toBe('labs');
  });

  it('falls back for a View tab with no Edit counterpart', () => {
    rememberEditTab('symptoms', 'occurrences');
    expect(getRememberedEditTab('symptoms', 'basic')).toBe('basic');
  });

  it('does not apply to a different entity', () => {
    rememberEditTab('procedures', 'clinical');
    expect(getRememberedEditTab('injuries', 'basic')).toBe('basic');
  });

  it('can be read more than once (a double-invoked effect sees the same tab)', () => {
    rememberEditTab('conditions', 'labResults');
    expect(getRememberedEditTab('conditions', 'basic')).toBe('labResults');
    expect(getRememberedEditTab('conditions', 'basic')).toBe('labResults');
  });

  it.each(['medications', 'procedures'] as const)(
    'keeps the Lab Results tab of a %s dialog',
    entity => {
      rememberEditTab(entity, 'labResults');
      expect(getRememberedEditTab(entity, 'basic')).toBe('labResults');
    }
  );

  it('expires so it cannot leak into a later Edit opened from a card', () => {
    rememberEditTab('procedures', 'clinical');
    vi.advanceTimersByTime(EDIT_TAB_TTL_MS - 1);
    expect(getRememberedEditTab('procedures', 'basic')).toBe('clinical');
    vi.advanceTimersByTime(2);
    expect(getRememberedEditTab('procedures', 'basic')).toBe('basic');
  });

  it('a newer View-to-Edit replaces an older one', () => {
    rememberEditTab('procedures', 'clinical');
    rememberEditTab('procedures', 'notes');
    expect(getRememberedEditTab('procedures', 'basic')).toBe('notes');
  });
});
