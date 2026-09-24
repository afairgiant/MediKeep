const EXTENDED_FILENAME = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i;
const PLAIN_FILENAME =
  /(?:^|;)\s*filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]*))/i;
const UTF8_EXTENDED_VALUE = /^utf-8'[^']*'(.*)$/i;

function decodeExtendedValue(raw: string): string | null {
  const match = UTF8_EXTENDED_VALUE.exec(raw.trim());
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]) || null;
  } catch {
    return null;
  }
}

/**
 * Filename from a Content-Disposition header, preferring RFC 5987 `filename*` over `filename`.
 * Returns null when the header is missing or carries no usable filename.
 */
export function parseContentDispositionFilename(
  header: string | null | undefined
): string | null {
  if (!header) {
    return null;
  }

  const extended = EXTENDED_FILENAME.exec(header);
  if (extended) {
    const decoded = decodeExtendedValue(extended[1]);
    if (decoded) {
      return decoded;
    }
  }

  const plain = PLAIN_FILENAME.exec(header);
  if (!plain) {
    return null;
  }
  const value =
    plain[1] !== undefined ? plain[1].replace(/\\(.)/g, '$1') : plain[2].trim();
  return value || null;
}
