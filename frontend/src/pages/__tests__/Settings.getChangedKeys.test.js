import { describe, test, expect } from 'vitest';
import { getChangedKeys, isSameValue } from '../Settings';

describe('isSameValue', () => {
  test('treats primitives by === ', () => {
    expect(isSameValue(84, 84)).toBe(true);
    expect(isSameValue(84, 85)).toBe(false);
    expect(isSameValue(null, null)).toBe(true);
    expect(isSameValue(null, undefined)).toBe(false);
  });

  test('treats objects with equal content as equal regardless of reference', () => {
    const a = { whole_blood: 84, plasma: 14 };
    const b = { whole_blood: 84, plasma: 14 };
    expect(a).not.toBe(b);
    expect(isSameValue(a, b)).toBe(true);
  });

  test('treats objects with different content as different', () => {
    expect(isSameValue({ whole_blood: 84 }, { whole_blood: 85 })).toBe(false);
  });
});

describe('getChangedKeys', () => {
  test('does not report a change when an object value round-trips back to the server value', () => {
    const server = { blood_donation_intervals: { whole_blood: 84 } };
    // Simulates the user changing 84 -> 85 -> 84: a new object with the
    // same content as the server's, but a different reference.
    const local = { blood_donation_intervals: { whole_blood: 84 } };

    expect(getChangedKeys(local, server)).toEqual([]);
  });

  test('reports a change when the object value actually differs', () => {
    const server = { blood_donation_intervals: { whole_blood: 84 } };
    const local = { blood_donation_intervals: { whole_blood: 85 } };

    expect(getChangedKeys(local, server)).toEqual(['blood_donation_intervals']);
  });

  test('still reports changes for plain scalar fields', () => {
    const server = { unit_system: 'imperial' };
    const local = { unit_system: 'metric' };

    expect(getChangedKeys(local, server)).toEqual(['unit_system']);
  });
});
