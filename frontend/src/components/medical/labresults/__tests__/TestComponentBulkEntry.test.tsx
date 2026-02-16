/**
 * Tests for TestComponentBulkEntry parser regex patterns
 *
 * Covers:
 * - TABULAR_PATTERN: numeric ranges (min-max) and capture group alignment
 * - FULL_PATTERN: colon-delimited format with parenthesized ranges
 * - Comparison operator ranges (< 0.41, > 39, etc.)
 * - Auto-status calculation for full and partial ranges
 */

import { describe, it, expect } from 'vitest';

// Reproduce the regex patterns from TestComponentBulkEntry.tsx
const UNIT_PATTERN = String.raw`[a-zA-Z0-9/%μ]+(?:/[a-zA-Z0-9]+)?|x10E\d+/[a-zA-Z]+`;
const TEST_NAME = String.raw`(.+?)`;
const NUMERIC_VALUE = String.raw`([0-9.,]+)`;
const ONE_OR_MORE_SPACES = String.raw`\s+`;
const ZERO_OR_MORE_SPACES = String.raw`\s*`;
const RANGE_SEPARATOR = String.raw`[-–]`;
const COMPARISON_OP = String.raw`[<>≤≥]`;
const STATUS_VALUES = String.raw`(normal|high|low|critical|abnormal|borderline)?`;

const REGEX_PATTERNS = {
  FULL_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}:${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}${ZERO_OR_MORE_SPACES}(${UNIT_PATTERN})?${ZERO_OR_MORE_SPACES}` +
    String.raw`(?:\((?:.*?range.*?:${ZERO_OR_MORE_SPACES})?${NUMERIC_VALUE}${ZERO_OR_MORE_SPACES}${RANGE_SEPARATOR}${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}.*?\)|` +
    String.raw`\((${COMPARISON_OP}${ZERO_OR_MORE_SPACES}[0-9.,]+)\)|` +
    String.raw`\(Not\s+Estab\.?\)|` +
    String.raw`(\([^)]*\)))?`,
    'i'
  ),

  TABULAR_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}${ONE_OR_MORE_SPACES}${NUMERIC_VALUE}${ONE_OR_MORE_SPACES}(${UNIT_PATTERN})${ONE_OR_MORE_SPACES}` +
    String.raw`(?:${NUMERIC_VALUE}${ZERO_OR_MORE_SPACES}${RANGE_SEPARATOR}${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}|(${COMPARISON_OP}${ZERO_OR_MORE_SPACES}[0-9.,]+))${ZERO_OR_MORE_SPACES}` +
    STATUS_VALUES,
    'i'
  ),
};

/**
 * Helper to parse a line using the same logic as TestComponentBulkEntry.
 * Returns parsed fields for the first matching pattern.
 */
function parseLine(line: string) {
  const trimmedLine = line.trim();

  for (const [patternName, pattern] of Object.entries(REGEX_PATTERNS)) {
    const match = trimmedLine.match(pattern);
    if (!match) continue;

    const testName = match[1]?.trim().replace(/[,;:]+$/, '');
    const valueStr = match[2]?.replace(/,/g, '');
    const unit = match[3]?.trim() || '';

    if (!testName || !valueStr) continue;

    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;

    const result: Record<string, any> = {
      patternName,
      test_name: testName,
      value,
      unit,
      ref_range_min: null as number | null,
      ref_range_max: null as number | null,
      ref_range_text: null as string | null,
      status: null as string | null,
    };

    // Parse reference range
    if (match[4] && match[5]) {
      const rangeMin = parseFloat(match[4].replace(/,/g, ''));
      const rangeMax = parseFloat(match[5].replace(/,/g, ''));
      if (!isNaN(rangeMin) && !isNaN(rangeMax)) {
        result.ref_range_min = rangeMin;
        result.ref_range_max = rangeMax;
      }
    } else if (match[6]) {
      const compText = match[6].trim();
      result.ref_range_text = compText;

      const compMatch = compText.match(/^([<>\u2264\u2265])\s*([0-9.,]+)$/);
      if (compMatch) {
        const op = compMatch[1];
        const num = parseFloat(compMatch[2].replace(/,/g, ''));
        if (!isNaN(num)) {
          if (op === '<' || op === '\u2264') {
            result.ref_range_max = num;
          } else if (op === '>' || op === '\u2265') {
            result.ref_range_min = num;
          }
        }
      }
    }

    // Auto-calculate status
    if (result.value !== null) {
      if (typeof result.ref_range_min === 'number' && typeof result.ref_range_max === 'number') {
        if (result.value > result.ref_range_max) result.status = 'high';
        else if (result.value < result.ref_range_min) result.status = 'low';
        else result.status = 'normal';
      } else if (typeof result.ref_range_max === 'number') {
        result.status = result.value > result.ref_range_max ? 'high' : 'normal';
      } else if (typeof result.ref_range_min === 'number') {
        result.status = result.value < result.ref_range_min ? 'low' : 'normal';
      }
    }

    return result;
  }

  return null;
}

describe('TestComponentBulkEntry Parser', () => {
  describe('TABULAR_PATTERN: numeric range parsing', () => {
    it('should correctly parse min and max from "3.6-10.0"', () => {
      const result = parseLine('Leukozyten 4.4 /nl 3.6-10.0');
      expect(result).not.toBeNull();
      expect(result!.test_name).toBe('Leukozyten');
      expect(result!.value).toBe(4.4);
      expect(result!.unit).toBe('/nl');
      expect(result!.ref_range_min).toBe(3.6);
      expect(result!.ref_range_max).toBe(10.0);
      expect(result!.status).toBe('normal');
    });

    it('should detect high status when value exceeds max', () => {
      const result = parseLine('Leukozyten 12.5 /nl 3.6-10.0');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(3.6);
      expect(result!.ref_range_max).toBe(10.0);
      expect(result!.status).toBe('high');
    });

    it('should detect low status when value is below min', () => {
      const result = parseLine('Leukozyten 2.1 /nl 3.6-10.0');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(3.6);
      expect(result!.ref_range_max).toBe(10.0);
      expect(result!.status).toBe('low');
    });

    it('should handle integer ranges', () => {
      const result = parseLine('Hemoglobin 14 g/dL 12-17');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(12);
      expect(result!.ref_range_max).toBe(17);
      expect(result!.status).toBe('normal');
    });

    it('should handle en-dash separator', () => {
      const result = parseLine('Glucose 95 mg/dL 70\u201399');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(70);
      expect(result!.ref_range_max).toBe(99);
      expect(result!.status).toBe('normal');
    });

    it('should handle spaces around range separator', () => {
      const result = parseLine('WBC 7.5 K/uL 4.5 - 11.0');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(4.5);
      expect(result!.ref_range_max).toBe(11.0);
    });
  });

  describe('TABULAR_PATTERN: comparison operator ranges', () => {
    it('should parse "< 0.41" as upper bound', () => {
      const result = parseLine('Eosinophile abs. 0.19 /nl < 0.41');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('< 0.41');
      expect(result!.ref_range_max).toBe(0.41);
      expect(result!.ref_range_min).toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should detect high status when value exceeds upper bound', () => {
      const result = parseLine('Eosinophile abs. 0.50 /nl < 0.41');
      expect(result).not.toBeNull();
      expect(result!.ref_range_max).toBe(0.41);
      expect(result!.status).toBe('high');
    });

    it('should parse "> 39" as lower bound', () => {
      const result = parseLine('Test 50 mg/dL > 39');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('> 39');
      expect(result!.ref_range_min).toBe(39);
      expect(result!.ref_range_max).toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should detect low status when value is below lower bound', () => {
      const result = parseLine('Test 30 mg/dL > 39');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(39);
      expect(result!.status).toBe('low');
    });

    it('should handle comparison without space', () => {
      const result = parseLine('CRP 0.3 mg/dL <0.5');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('<0.5');
      expect(result!.ref_range_max).toBe(0.5);
      expect(result!.status).toBe('normal');
    });
  });

  describe('FULL_PATTERN: colon-delimited format', () => {
    it('should parse numeric range in parentheses', () => {
      const result = parseLine('WBC: 7.5 x10E3/uL (3.6-10.0)');
      expect(result).not.toBeNull();
      expect(result!.test_name).toBe('WBC');
      expect(result!.value).toBe(7.5);
      expect(result!.ref_range_min).toBe(3.6);
      expect(result!.ref_range_max).toBe(10.0);
      expect(result!.status).toBe('normal');
    });

    it('should parse "Normal range:" prefix', () => {
      const result = parseLine('Glucose: 95 mg/dL (Normal range: 70-100)');
      expect(result).not.toBeNull();
      expect(result!.ref_range_min).toBe(70);
      expect(result!.ref_range_max).toBe(100);
      expect(result!.status).toBe('normal');
    });

    it('should parse comparison operator in parentheses', () => {
      const result = parseLine('TSH: 0.30 mIU/L (<0.41)');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('<0.41');
      expect(result!.ref_range_max).toBe(0.41);
      expect(result!.ref_range_min).toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should parse comparison with space in parentheses', () => {
      const result = parseLine('CRP: 0.8 mg/dL (< 1.0)');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('< 1.0');
      expect(result!.ref_range_max).toBe(1.0);
      expect(result!.status).toBe('normal');
    });

    it('should parse greater-than comparison in parentheses', () => {
      const result = parseLine('HDL: 55 mg/dL (>40)');
      expect(result).not.toBeNull();
      expect(result!.ref_range_text).toBe('>40');
      expect(result!.ref_range_min).toBe(40);
      expect(result!.ref_range_max).toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should detect high for comparison exceeding upper bound', () => {
      const result = parseLine('CRP: 2.5 mg/dL (<1.0)');
      expect(result).not.toBeNull();
      expect(result!.ref_range_max).toBe(1.0);
      expect(result!.status).toBe('high');
    });
  });

  describe('Auto-status calculation edge cases', () => {
    it('should set normal when value equals ref_range_min', () => {
      const result = parseLine('Test 3.6 unit 3.6-10.0');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should set normal when value equals ref_range_max', () => {
      const result = parseLine('Test 10.0 unit 3.6-10.0');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should set normal when value equals upper bound comparison', () => {
      const result = parseLine('Test 0.41 unit < 0.41');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('normal');
    });

    it('should set normal when value equals lower bound comparison', () => {
      const result = parseLine('Test 39 unit > 39');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('normal');
    });
  });
});
