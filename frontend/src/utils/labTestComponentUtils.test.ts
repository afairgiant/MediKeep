import { describe, it, expect } from 'vitest';
import { parseRefRangeText, calculateStatus } from './labTestComponentUtils';

describe('parseRefRangeText', () => {
  it('parses a standard "X - Y" range', () => {
    expect(parseRefRangeText('70-100')).toEqual({ min: 70, max: 100 });
  });

  it('parses a range with spaces and decimals', () => {
    expect(parseRefRangeText('4.0 - 5.6')).toEqual({ min: 4.0, max: 5.6 });
  });

  it('tolerates a trailing unit after the range', () => {
    expect(parseRefRangeText('4.0-5.6 mg/dL')).toEqual({ min: 4.0, max: 5.6 });
  });

  it('parses an upper-bound-only "<N" range', () => {
    expect(parseRefRangeText('<200')).toEqual({ min: null, max: 200 });
  });

  it('parses "<=N" and the unicode "≤N"', () => {
    expect(parseRefRangeText('<=200')).toEqual({ min: null, max: 200 });
    expect(parseRefRangeText('≤200')).toEqual({ min: null, max: 200 });
  });

  it('parses a lower-bound-only ">N" range', () => {
    expect(parseRefRangeText('>40')).toEqual({ min: 40, max: null });
  });

  it('parses ">=N" and the unicode "≥N"', () => {
    expect(parseRefRangeText('>=90')).toEqual({ min: 90, max: null });
    expect(parseRefRangeText('≥90')).toEqual({ min: 90, max: null });
  });

  it('parses a negative lower bound', () => {
    expect(parseRefRangeText('-5-5')).toEqual({ min: -5, max: 5 });
  });

  it('returns nulls for non-numeric / non-standard text', () => {
    expect(parseRefRangeText('Not Estab.')).toEqual({ min: null, max: null });
    expect(parseRefRangeText('Negative')).toEqual({ min: null, max: null });
  });

  it('returns nulls for empty / missing input', () => {
    expect(parseRefRangeText('')).toEqual({ min: null, max: null });
    expect(parseRefRangeText(undefined)).toEqual({ min: null, max: null });
    expect(parseRefRangeText(null)).toEqual({ min: null, max: null });
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

  it('handles ">=N" ref text as a lower bound', () => {
    expect(calculateStatus(80, '', '', '>=90')).toBe('low');
    expect(calculateStatus(100, '', '', '>=90')).toBe('normal');
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
