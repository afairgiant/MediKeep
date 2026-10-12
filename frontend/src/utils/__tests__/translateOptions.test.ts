import { describe, expect, it } from 'vitest';

import { translateOptions } from '../translateOptions';

describe('translateOptions', () => {
  it('keeps each value and translates its label key', () => {
    const t = (key: string) => `t(${key})`;
    expect(
      translateOptions(
        [
          { value: 'baseline', labelKey: 'shared:linkPurposes.baseline' },
          { value: 'other', labelKey: 'shared:linkPurposes.other' },
        ],
        t
      )
    ).toEqual([
      { value: 'baseline', label: 't(shared:linkPurposes.baseline)' },
      { value: 'other', label: 't(shared:linkPurposes.other)' },
    ]);
  });

  it('returns no options for none', () => {
    expect(translateOptions([], key => key)).toEqual([]);
  });
});
