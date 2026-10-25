export interface TextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export type LinePrefix = 'bullet' | 'numbered' | 'task' | 'heading';

const LINE_PREFIX_PATTERNS: Record<LinePrefix, RegExp> = {
  bullet: /^[-*+] (?!\[[ xX]\] )/,
  numbered: /^\d{1,9}[.)] /,
  task: /^[-*+] \[[ xX]\] /,
  heading: /^#{1,6} /,
};

const linePrefix = (kind: LinePrefix, index: number): string => {
  switch (kind) {
    case 'bullet':
      return '- ';
    case 'numbered':
      return `${index + 1}. `;
    case 'task':
      return '- [ ] ';
    default:
      return '## ';
  }
};

/**
 * Wrap the selection in ``marker`` (e.g. ``**``), or unwrap it when already wrapped.
 *
 * With nothing selected, inserts ``placeholder`` between the markers and selects it.
 */
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string
): TextEdit {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const size = marker.length;
  const char = marker[0];
  const leadingRun = (value: string) =>
    value.length - value.replace(new RegExp(`^\\${char}+`), '').length;
  const trailingRun = (value: string) =>
    value.length - value.replace(new RegExp(`\\${char}+$`), '').length;
  // A run of the marker character is ours only if it is exactly the marker, or bold+italic.
  const combinesEmphasis = (char === '*' || char === '_') && size < 3;
  const isMarkerRun = (run: number) =>
    run === size || (run === 3 && combinesEmphasis);

  if (isMarkerRun(trailingRun(before)) && isMarkerRun(leadingRun(after))) {
    return {
      text: before.slice(0, -size) + selected + after.slice(size),
      selectionStart: start - size,
      selectionEnd: end - size,
    };
  }
  const lead = leadingRun(selected);
  if (
    lead < selected.length &&
    isMarkerRun(lead) &&
    isMarkerRun(trailingRun(selected))
  ) {
    const inner = selected.slice(size, -size);
    return {
      text: before + inner + after,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  const inner = selected || placeholder;
  return {
    text: before + marker + inner + marker + after,
    selectionStart: start + size,
    selectionEnd: start + size + inner.length,
  };
}

/**
 * Add a line prefix (list marker, checkbox, heading) to every line the selection touches,
 * or remove it when all of those lines already have it.
 */
export function toggleLinePrefix(
  text: string,
  start: number,
  end: number,
  kind: LinePrefix
): TextEdit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end > start ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const pattern = LINE_PREFIX_PATTERNS[kind];
  const removing = lines.every(line => pattern.test(line));

  const edited = lines.map((line, index) =>
    removing ? line.replace(pattern, '') : linePrefix(kind, index) + line
  );
  const block = edited.join('\n');
  const result = text.slice(0, lineStart) + block + text.slice(lineEnd);
  if (lines.length === 1) {
    // Keep the caret on the same character of a single line.
    const shift = block.length - (lineEnd - lineStart);
    return {
      text: result,
      selectionStart: Math.max(lineStart, start + shift),
      selectionEnd: Math.max(lineStart, end + shift),
    };
  }
  return {
    text: result,
    selectionStart: lineStart,
    selectionEnd: lineStart + block.length,
  };
}

/** Turn the selection into ``[selection](https://)`` and select the URL to type over. */
export function insertLink(
  text: string,
  start: number,
  end: number,
  placeholder: string
): TextEdit {
  const label = text.slice(start, end) || placeholder;
  const url = 'https://';
  const link = `[${label}](${url})`;
  const urlStart = start + label.length + 3;
  return {
    text: text.slice(0, start) + link + text.slice(end),
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  };
}
