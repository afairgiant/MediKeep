import { describe, expect, it } from 'vitest';

import { isSafeNotesLink, notesToPlainText } from '../notesMarkdown';

describe('notesToPlainText', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['', ''],
    ['   \n  ', ''],
    ['Took 2 tablets', 'Took 2 tablets'],
    ['**bold** *italic* _also_ ~~gone~~ `code`', 'bold italic also gone code'],
    ['## Plan\nRest for a week', 'Plan Rest for a week'],
    ['- eggs\n- milk\n  - skim', 'eggs milk skim'],
    ['3. third\n4) fourth', 'third fourth'],
    ['- [x] booked\n- [ ] follow-up', 'booked follow-up'],
    ['> > nested quote', 'nested quote'],
    [
      '[portal](https://example.com) and ![x-ray](https://e.com/x.png)',
      'portal and x-ray',
    ],
    ['<https://example.com>', 'https://example.com'],
    ['```\ncode line\n```', 'code line'],
    ['above\n\n---\n\nbelow', 'above below'],
  ])('%j -> %j', (input, expected) => {
    expect(notesToPlainText(input)).toBe(expected);
  });

  it('keeps characters that are not formatting', () => {
    expect(notesToPlainText('snake_case and 2 * 3 = 6, BP <120 & > 80')).toBe(
      'snake_case and 2 * 3 = 6, BP <120 & > 80'
    );
  });

  it('keeps backslash-escaped markers as literal text', () => {
    expect(
      notesToPlainText(String.raw`\*not italic\* and \# not a heading`)
    ).toBe('*not italic* and # not a heading');
  });

  it('keeps line breaks when asked', () => {
    expect(
      notesToPlainText('**Plan**\n- rest\n\n\n\nfluids', {
        keepLineBreaks: true,
      })
    ).toBe('Plan\nrest\n\nfluids');
  });

  it('leaves HTML as text for the caller to escape', () => {
    expect(notesToPlainText('<script>alert(1)</script>')).toBe(
      '<script>alert(1)</script>'
    );
  });

  it('finishes quickly on adversarial input', () => {
    const inputs = [
      '*'.repeat(5000),
      '_a'.repeat(2500),
      '['.repeat(5000),
      '[a]('.repeat(1250),
      '> - '.repeat(1250),
      `${'**a '.repeat(1250)}`,
    ];
    const start = performance.now();
    inputs.forEach(input => notesToPlainText(input, { keepLineBreaks: true }));
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('isSafeNotesLink', () => {
  it.each(['https://e.com', 'http://e.com', 'mailto:a@b.c', ' HTTPS://E.COM '])(
    'allows %s',
    href => {
      expect(isSafeNotesLink(href)).toBe(true);
    }
  );

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'vbscript:x',
    'relative/path',
    '//evil.example',
    '',
    null,
    undefined,
  ])('rejects %s', href => {
    expect(isSafeNotesLink(href)).toBe(false);
  });
});
