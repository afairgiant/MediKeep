import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { getEntityFormatters } from '../tableFormatters';

const cellText = node => render(<div>{node}</div>).container.textContent;

describe('Markdown table columns', () => {
  it.each([
    ['visits', 'notes'],
    ['visits', 'diagnosis'],
    ['procedures', 'description'],
    ['allergies', 'notes'],
  ])('%s.%s shows plain text', (entity, field) => {
    const format = getEntityFormatters(entity)[field];
    expect(cellText(format('**Fell** on\n- ice'))).toBe('Fell on ice');
  });

  it('truncates the plain text, not the Markdown', () => {
    const format = getEntityFormatters('treatments').notes;
    // Tables call formatters as (value, row).
    const text = cellText(format(`**${'a'.repeat(48)}** bcd`, { id: 1 }));
    expect(text).toBe(`${'a'.repeat(48)} b...`);
  });

  it('shows a dash for an empty note', () => {
    expect(getEntityFormatters('vitals').notes('')).toBe('-');
  });
});
