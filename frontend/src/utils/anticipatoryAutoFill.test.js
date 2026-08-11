import { describe, it, expect } from 'vitest';
import { applyOccurrenceSeverityAutoFill } from './anticipatoryAutoFill';

/**
 * Unit tests for the severity=none anticipatory autofill on symptom episodes.
 *
 * The rule, per review discussion on PR #935: when severity is set to `none`
 * we fill pain_scale and impact_level as a convenience, but those values must
 * be reverted if severity later changes away from `none`, and we must never
 * clear or overwrite a value the user entered themselves.
 */

const baseForm = {
  severity: 'moderate',
  pain_scale: '',
  impact_level: '',
  notes: '',
};

describe('applyOccurrenceSeverityAutoFill', () => {
  describe('entering severity=none', () => {
    it('auto-fills pain_scale and impact_level when both are empty', () => {
      const tracked = new Set();

      const result = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );

      expect(result.severity).toBe('none');
      expect(result.pain_scale).toBe('0');
      expect(result.impact_level).toBe('no_impact');
      expect(tracked.has('pain_scale')).toBe(true);
      expect(tracked.has('impact_level')).toBe(true);
    });

    it('does not overwrite values the user already entered', () => {
      const tracked = new Set();
      const prev = { ...baseForm, pain_scale: '7', impact_level: 'severe' };

      const result = applyOccurrenceSeverityAutoFill(
        prev,
        'severity',
        'none',
        tracked
      );

      expect(result.pain_scale).toBe('7');
      expect(result.impact_level).toBe('severe');
      expect(tracked.size).toBe(0);
    });

    it('fills only the field that is empty, leaving the other untouched', () => {
      const tracked = new Set();
      const prev = { ...baseForm, pain_scale: '4' };

      const result = applyOccurrenceSeverityAutoFill(
        prev,
        'severity',
        'none',
        tracked
      );

      expect(result.pain_scale).toBe('4');
      expect(result.impact_level).toBe('no_impact');
      expect(tracked.has('pain_scale')).toBe(false);
      expect(tracked.has('impact_level')).toBe(true);
    });
  });

  describe('leaving severity=none (the regression this guards)', () => {
    it('reverts auto-filled values on the none -> moderate transition', () => {
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );
      expect(filled.pain_scale).toBe('0');
      expect(filled.impact_level).toBe('no_impact');

      const reverted = applyOccurrenceSeverityAutoFill(
        filled,
        'severity',
        'moderate',
        tracked
      );

      expect(reverted.severity).toBe('moderate');
      expect(reverted.pain_scale).toBe('');
      expect(reverted.impact_level).toBe('');
      expect(tracked.size).toBe(0);
    });

    it('keeps a value the user typed after the auto-fill', () => {
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );

      // User overrides the auto-filled pain scale by hand.
      const edited = applyOccurrenceSeverityAutoFill(
        filled,
        'pain_scale',
        '6',
        tracked
      );
      expect(tracked.has('pain_scale')).toBe(false);
      expect(tracked.has('impact_level')).toBe(true);

      const reverted = applyOccurrenceSeverityAutoFill(
        edited,
        'severity',
        'severe',
        tracked
      );

      // Their 6 survives; only our un-edited guess is dropped.
      expect(reverted.pain_scale).toBe('6');
      expect(reverted.impact_level).toBe('');
    });

    it('keeps a user-entered 0 pain scale, even though it matches the auto-fill value', () => {
      // The maintainer's specific concern: someone genuinely enters 0 pain on a
      // mild symptom. Because that is the same value the auto-fill would have
      // written, an implementation that compared values instead of tracking
      // provenance would wrongly discard it here.
      const tracked = new Set();

      const typed = applyOccurrenceSeverityAutoFill(
        { ...baseForm, severity: 'mild' },
        'pain_scale',
        '0',
        tracked
      );
      expect(tracked.has('pain_scale')).toBe(false);

      const toNone = applyOccurrenceSeverityAutoFill(
        typed,
        'severity',
        'none',
        tracked
      );
      // Already populated by the user, so it is neither overwritten nor tracked.
      expect(toNone.pain_scale).toBe('0');
      expect(tracked.has('pain_scale')).toBe(false);

      const toSevere = applyOccurrenceSeverityAutoFill(
        toNone,
        'severity',
        'severe',
        tracked
      );

      expect(toSevere.pain_scale).toBe('0');
    });

    it('keeps a user-selected no_impact level, even though it matches the auto-fill value', () => {
      const tracked = new Set();

      const typed = applyOccurrenceSeverityAutoFill(
        { ...baseForm, severity: 'mild' },
        'impact_level',
        'no_impact',
        tracked
      );

      const toNone = applyOccurrenceSeverityAutoFill(
        typed,
        'severity',
        'none',
        tracked
      );
      expect(tracked.has('impact_level')).toBe(false);

      const toModerate = applyOccurrenceSeverityAutoFill(
        toNone,
        'severity',
        'moderate',
        tracked
      );

      expect(toModerate.impact_level).toBe('no_impact');
    });

    it('keeps an auto-filled value the user then re-entered by hand', () => {
      // Auto-fill writes 0, the user retypes 0 themselves. That deliberate
      // keystroke transfers ownership of the field to them, so it must survive.
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );
      expect(tracked.has('pain_scale')).toBe(true);

      const retyped = applyOccurrenceSeverityAutoFill(
        filled,
        'pain_scale',
        '0',
        tracked
      );
      expect(tracked.has('pain_scale')).toBe(false);

      const reverted = applyOccurrenceSeverityAutoFill(
        retyped,
        'severity',
        'moderate',
        tracked
      );

      expect(reverted.pain_scale).toBe('0');
    });

    it('never clears values it did not set, such as an episode loaded for editing', () => {
      // Editing an existing none-severity episode: values came from the API,
      // so nothing is tracked as auto-filled.
      const tracked = new Set();
      const loaded = {
        ...baseForm,
        severity: 'none',
        pain_scale: '0',
        impact_level: 'no_impact',
      };

      const result = applyOccurrenceSeverityAutoFill(
        loaded,
        'severity',
        'moderate',
        tracked
      );

      expect(result.pain_scale).toBe('0');
      expect(result.impact_level).toBe('no_impact');
    });

    it('re-fills on a none -> moderate -> none round trip', () => {
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );
      const reverted = applyOccurrenceSeverityAutoFill(
        filled,
        'severity',
        'moderate',
        tracked
      );
      const refilled = applyOccurrenceSeverityAutoFill(
        reverted,
        'severity',
        'none',
        tracked
      );

      expect(refilled.pain_scale).toBe('0');
      expect(refilled.impact_level).toBe('no_impact');
      expect(tracked.has('pain_scale')).toBe(true);
      expect(tracked.has('impact_level')).toBe(true);
    });
  });

  describe('unrelated changes', () => {
    it('passes other fields through without touching severity defaults', () => {
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );
      const result = applyOccurrenceSeverityAutoFill(
        filled,
        'notes',
        'felt fine all day',
        tracked
      );

      expect(result.notes).toBe('felt fine all day');
      expect(result.pain_scale).toBe('0');
      expect(result.impact_level).toBe('no_impact');
      expect(tracked.has('pain_scale')).toBe(true);
      expect(tracked.has('impact_level')).toBe(true);
    });

    it('stops tracking a field once the user clears it by hand', () => {
      const tracked = new Set();

      const filled = applyOccurrenceSeverityAutoFill(
        baseForm,
        'severity',
        'none',
        tracked
      );
      const cleared = applyOccurrenceSeverityAutoFill(
        filled,
        'impact_level',
        '',
        tracked
      );

      expect(tracked.has('impact_level')).toBe(false);
      expect(cleared.impact_level).toBe('');
    });
  });
});
