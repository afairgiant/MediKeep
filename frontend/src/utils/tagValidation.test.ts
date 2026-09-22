import { describe, it, expect } from 'vitest';
import { isValidTagName } from './tagValidation';

// Mirrors app/schemas/base_tags.py's normalize_and_validate_tag allowlist.
describe('isValidTagName', () => {
  it('accepts alphanumeric tags with allowed punctuation', () => {
    expect(isValidTagName('sars-cov-2')).toBe(true);
    expect(isValidTagName('v1.2')).toBe(true);
    expect(isValidTagName('urgent:high')).toBe(true);
  });

  it('accepts unicode letters', () => {
    expect(isValidTagName('diabète')).toBe(true);
  });

  it('treats internal spaces as the normalized hyphen form', () => {
    expect(isValidTagName('pre diabetes')).toBe(true);
  });

  it('rejects the reported payload', () => {
    expect(isValidTagName('< &8 HTML > <p>')).toBe(false);
  });

  it.each([
    '<script>alert(document.cookie)</script>',
    '<img/src=x/onerror=alert(1)>',
    '&lt;script&gt;',
    'tag"onmouseover=alert(1)',
    "tag'onmouseover=alert(1)",
    'tag`template`',
    'tag$injection',
    'tag;drop',
  ])('rejects injection payload: %s', payload => {
    expect(isValidTagName(payload)).toBe(false);
  });

  // A blank or punctuation-only tag would otherwise pass: "" is vacuously
  // valid against a char-class pattern, and "." itself is allowed
  // punctuation. Mirrors the backend's explicit rejection of both.
  it.each(['', '   ', '...', '---', ':::', '.-:'])(
    'rejects empty, whitespace-only, and punctuation-only input: %j',
    payload => {
      expect(isValidTagName(payload)).toBe(false);
    }
  );
});
