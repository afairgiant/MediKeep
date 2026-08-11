import { describe, it, expect } from 'vitest';
import { parseRefRangeText, calculateStatus } from './labTestComponentUtils';

const NONE = { min: null, max: null, minExclusive: false, maxExclusive: false };

describe('parseRefRangeText', () => {
  it('parses a standard "X - Y" range (inclusive bounds)', () => {
    expect(parseRefRangeText('70-100')).toEqual({
      min: 70,
      max: 100,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('parses a range with spaces and decimals', () => {
    expect(parseRefRangeText('4.0 - 5.6')).toEqual({
      min: 4.0,
      max: 5.6,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('tolerates a trailing unit after the range', () => {
    expect(parseRefRangeText('4.0-5.6 mg/dL')).toEqual({
      min: 4.0,
      max: 5.6,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('parses "<N" as an exclusive upper bound', () => {
    expect(parseRefRangeText('<200')).toEqual({
      min: null,
      max: 200,
      minExclusive: false,
      maxExclusive: true,
    });
  });

  it('parses "<=N" and the unicode "≤N" as inclusive upper bounds', () => {
    expect(parseRefRangeText('<=200')).toEqual({
      min: null,
      max: 200,
      minExclusive: false,
      maxExclusive: false,
    });
    expect(parseRefRangeText('≤200')).toEqual({
      min: null,
      max: 200,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('parses ">N" as an exclusive lower bound', () => {
    expect(parseRefRangeText('>40')).toEqual({
      min: 40,
      max: null,
      minExclusive: true,
      maxExclusive: false,
    });
  });

  it('parses ">=N" and the unicode "≥N" as inclusive lower bounds', () => {
    expect(parseRefRangeText('>=90')).toEqual({
      min: 90,
      max: null,
      minExclusive: false,
      maxExclusive: false,
    });
    expect(parseRefRangeText('≥90')).toEqual({
      min: 90,
      max: null,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('parses a negative lower bound', () => {
    expect(parseRefRangeText('-5-5')).toEqual({
      min: -5,
      max: 5,
      minExclusive: false,
      maxExclusive: false,
    });
  });

  it('returns nulls for non-numeric / non-standard text', () => {
    expect(parseRefRangeText('Not Estab.')).toEqual(NONE);
    expect(parseRefRangeText('Negative')).toEqual(NONE);
  });

  it('returns nulls for empty / missing input', () => {
    expect(parseRefRangeText('')).toEqual(NONE);
    expect(parseRefRangeText(undefined)).toEqual(NONE);
    expect(parseRefRangeText(null)).toEqual(NONE);
  });
});

describe('calculateStatus', () => {
  it('returns undefined when there is no value', () => {
    expect(calculateStatus('', 70, 100)).toBeUndefined();
  });

  it('returns undefined when there are no bounds at all', () => {
    expect(calculateStatus(85, '', '')).toBeUndefined();
    expect(calculateStatus(85, '', '', '')).toBeUndefined();
  });

  it('uses numeric bounds when provided', () => {
    expect(calculateStatus(60, 70, 100)).toBe('low');
    expect(calculateStatus(85, 70, 100)).toBe('normal');
    expect(calculateStatus(120, 70, 100)).toBe('high');
  });

  it('falls back to ref text when numeric bounds are empty', () => {
    expect(calculateStatus(60, '', '', '70-100')).toBe('low');
    expect(calculateStatus(85, '', '', '70-100')).toBe('normal');
    expect(calculateStatus(120, '', '', '70-100')).toBe('high');
  });

  it('handles "<N" ref text as an upper bound', () => {
    expect(calculateStatus(250, '', '', '<200')).toBe('high');
    expect(calculateStatus(150, '', '', '<200')).toBe('normal');
  });

  it('treats the boundary as high for exclusive "<N" but normal for "<=N"', () => {
    // Value exactly at the bound: "<200" excludes 200 (high); "<=200" includes it (normal).
    expect(calculateStatus(200, '', '', '<200')).toBe('high');
    expect(calculateStatus(200, '', '', '<=200')).toBe('normal');
  });

  it('handles ">=N" ref text as a lower bound', () => {
    expect(calculateStatus(80, '', '', '>=90')).toBe('low');
    expect(calculateStatus(100, '', '', '>=90')).toBe('normal');
  });

  it('treats the boundary as low for exclusive ">N" but normal for ">=N"', () => {
    expect(calculateStatus(90, '', '', '>90')).toBe('low');
    expect(calculateStatus(90, '', '', '>=90')).toBe('normal');
  });

  it('prefers numeric bounds over ref text when both are present', () => {
    // Numeric range 70-100 says normal; text range would say high — numeric wins.
    expect(calculateStatus(90, 70, 100, '<50')).toBe('normal');
  });

  it('regression (issue #883): fasting glucose above a text-only range is high', () => {
    // Reporter typed the range only into the Ref Text field, leaving min/max blank.
    expect(calculateStatus(126, '', '', '70-99')).toBe('high');
  });
});
