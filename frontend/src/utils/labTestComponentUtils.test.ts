import { describe, it, expect, vi } from 'vitest';
import {
  parseRefRangeText,
  calculateStatus,
  makeLegacyResultHandler,
} from './labTestComponentUtils';

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

describe('makeLegacyResultHandler', () => {
  const point = {
    id: -42,
    result_type: 'status_only' as const,
    status: 'abnormal',
    lab_result: { id: 42, test_name: 'A1C' },
  };

  it('returns undefined when no handler is provided, so canEditLegacy/canDeleteLegacy stay false', () => {
    expect(makeLegacyResultHandler(undefined)).toBeUndefined();
  });

  it('builds the is_legacy shim from the trend point and calls the handler with it', () => {
    const handler = vi.fn();
    const wrapped = makeLegacyResultHandler(handler);

    wrapped?.(point);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: -42,
        lab_result_id: 42,
        test_name: 'A1C',
        is_legacy: true,
      })
    );
  });

  it('passes through a synchronous return value unchanged', () => {
    const handler = vi.fn().mockReturnValue(true);
    const wrapped = makeLegacyResultHandler(handler);

    expect(wrapped?.(point)).toBe(true);
  });

  it('passes through a resolved async return value unchanged (regression: TestComponentTrendsPanel awaits this to decide whether to reload after a legacy delete)', async () => {
    const handler = vi.fn().mockResolvedValue(false);
    const wrapped = makeLegacyResultHandler(handler);

    await expect(wrapped?.(point)).resolves.toBe(false);
  });
});
