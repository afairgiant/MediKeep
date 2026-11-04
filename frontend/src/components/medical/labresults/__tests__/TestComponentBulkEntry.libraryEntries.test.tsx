/**
 * Tests for how Bulk Entry reads the HBsAg and parietal cell library entries,
 * and titer results such as 1:160.
 */

import { describe, it, expect } from 'vitest';
import {
  REGEX_PATTERNS,
  QUALITATIVE_PATTERN,
  TEXTUAL_PATTERN,
} from '../TestComponentBulkEntry';
import { searchTests } from '../../../../constants/testLibrary';

const firstMatch = (name: string) => searchTests(name, 1)[0];

describe('HBsAg and parietal cell library matching', () => {
  it.each([
    'HBsAg',
    'HBs-Antigen',
    'HBsAg Screen',
    'Hepatitis B Surface Ag Screen',
    'Hepatitis B Surface Antigen w/Reflex Confirmation',
  ])('links "%s" to the antigen entry', name => {
    expect(firstMatch(name)?.test_name).toBe('Hepatitis B Surface Antigen');
  });

  it('keeps a numeric HBsAg result, since the save filter drops a number on a qualitative test', () => {
    expect(firstMatch('HBsAg')?.result_type).toBe('quantitative');
    const match = 'HBsAg: 0.35 COI (<1.0)'.match(REGEX_PATTERNS.FULL_PATTERN);
    expect(match![2]).toBe('0.35');
    expect(match![3]).toBe('COI');
  });

  it('still reads a screen result as qualitative from the line itself', () => {
    expect('HBsAg: Negative'.match(QUALITATIVE_PATTERN)![2]).toBe('Negative');
  });

  it.each([
    'Parietal Cell Ab W/Refl Titer',
    'Parietal Cell Antibody with Reflex to Titer',
  ])('does not link the titer order "%s" to the U/mL entry', name => {
    expect(firstMatch(name)).toBeUndefined();
  });
});

describe('TEXTUAL_PATTERN: titers', () => {
  it.each([
    ['Parietal Cell Antibody: 1:40', 'Parietal Cell Antibody', '1:40'],
    ['Parietal Cell Ab: 1:80', 'Parietal Cell Ab', '1:80'],
    ['ANA: 1:160', 'ANA', '1:160'],
    ['VDRL: 1:8', 'VDRL', '1:8'],
    ['ANA: <1:40', 'ANA', '<1:40'],
    ['ANA: >1:1280', 'ANA', '>1:1280'],
  ])('keeps "%s" as written instead of reading it as 1', (line, name, value) => {
    const match = line.match(TEXTUAL_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe(name);
    expect(match![2].trim()).toBe(value);
  });

  it.each(['Collection Time: 10:30', 'Ratio: 2:1', 'Parietal Cell Antibody: 4.8 U/mL'])(
    'does not treat "%s" as a titer',
    line => {
      expect(line.match(TEXTUAL_PATTERN)).toBeNull();
    }
  );
});
