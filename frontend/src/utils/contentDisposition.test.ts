import { describe, test, expect } from 'vitest';
import { parseContentDispositionFilename } from './contentDisposition';

describe('parseContentDispositionFilename', () => {
  test('decodes an RFC 5987 UTF-8 filename', () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=utf-8''%D0%92%D0%B8%D1%82%D0%B0%D0%BC%D0%B8%D0%BDD.pdf"
      )
    ).toBe('ВитаминD.pdf');
  });

  test('accepts an uppercase charset and a language tag', () => {
    expect(
      parseContentDispositionFilename(
        "inline; filename*=UTF-8'en'caf%C3%A9.pdf"
      )
    ).toBe('café.pdf');
  });

  test('reads a quoted filename', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="report 1.pdf"')
    ).toBe('report 1.pdf');
  });

  test('unescapes quoted-pair characters in a quoted filename', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="a \\"b\\".pdf"')
    ).toBe('a "b".pdf');
  });

  test('reads a bare filename', () => {
    expect(
      parseContentDispositionFilename('attachment; filename=report.pdf')
    ).toBe('report.pdf');
  });

  test('prefers filename* when both forms are present', () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="fallback.pdf"; filename*=utf-8\'\'caf%C3%A9.pdf'
      )
    ).toBe('café.pdf');
  });

  test('falls back to filename when filename* is malformed', () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename*=utf-8\'\'%E0%A4%A; filename="fallback.pdf"'
      )
    ).toBe('fallback.pdf');
  });

  test('returns null for malformed filename* with no fallback', () => {
    expect(
      parseContentDispositionFilename("attachment; filename*=utf-8''%E0%A4%A")
    ).toBeNull();
  });

  test('ignores filename* with an unsupported charset', () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=iso-8859-1''caf%E9.pdf"
      )
    ).toBeNull();
  });

  test('returns null for a missing header', () => {
    expect(parseContentDispositionFilename(null)).toBeNull();
    expect(parseContentDispositionFilename(undefined)).toBeNull();
    expect(parseContentDispositionFilename('')).toBeNull();
  });

  test('returns null when the header has no filename', () => {
    expect(parseContentDispositionFilename('inline')).toBeNull();
    expect(
      parseContentDispositionFilename('attachment; filename=""')
    ).toBeNull();
  });
});
