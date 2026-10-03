import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { navigateToEntity } from '../linkNavigation';

describe('navigateToEntity', () => {
  it.each([
    ['encounter', '/visits'],
    ['procedure', '/procedures'],
    ['injury', '/injuries'],
    ['symptom', '/symptoms'],
    ['condition', '/conditions'],
    ['medication', '/medications'],
    ['treatment', '/treatments'],
    ['lab_result', '/lab-results'],
  ])('opens %s on %s', (entityType, route) => {
    const navigate = vi.fn();
    navigateToEntity(entityType, 12, navigate);
    expect(navigate).toHaveBeenCalledWith(`${route}?view=12`);
  });

  it('does nothing for an unknown type, a missing id or a non-numeric id', () => {
    const navigate = vi.fn();
    navigateToEntity('nope', 1, navigate);
    navigateToEntity('procedure', null, navigate);
    navigateToEntity('procedure', 'abc', navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
});
