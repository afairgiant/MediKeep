import { SECTIONS } from '../sections';
import { makeSettings } from './fixtures';

test('every setting appears in exactly one section', () => {
  const listed = SECTIONS.flatMap(section => section.keys);

  expect([...listed].sort()).toEqual(Object.keys(makeSettings()).sort());
});
