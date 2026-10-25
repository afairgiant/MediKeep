import { describe, expect, it } from 'vitest';

import { insertLink, toggleLinePrefix, toggleWrap } from '../notesEditing';

// "|" marks the selection in the readable cases below.
const select = (marked: string) => {
  const start = marked.indexOf('|');
  const end = marked.indexOf('|', start + 1);
  const text = marked.replace(/\|/g, '');
  return { text, start, end: end === -1 ? start : end - 1 };
};

const show = ({
  text,
  selectionStart,
  selectionEnd,
}: {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}) =>
  selectionStart === selectionEnd
    ? `${text.slice(0, selectionStart)}|${text.slice(selectionStart)}`
    : `${text.slice(0, selectionStart)}|${text.slice(selectionStart, selectionEnd)}|${text.slice(selectionEnd)}`;

const wrap = (marked: string, marker = '**') => {
  const { text, start, end } = select(marked);
  return show(toggleWrap(text, start, end, marker, 'bold text'));
};

const prefix = (
  marked: string,
  kind: Parameters<typeof toggleLinePrefix>[3]
) => {
  const { text, start, end } = select(marked);
  return show(toggleLinePrefix(text, start, end, kind));
};

describe('toggleWrap', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrap('take |two| daily')).toBe('take **|two|** daily');
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    expect(wrap('take |')).toBe('take **|bold text|**');
  });

  it('unwraps when the markers surround the selection', () => {
    expect(wrap('take **|two|** daily')).toBe('take |two| daily');
  });

  it('unwraps when the selection includes the markers', () => {
    expect(wrap('take |**two**| daily')).toBe('take |two| daily');
  });

  it('wraps a multi-line selection as one span', () => {
    expect(wrap('|a\nb|', '*')).toBe('*|a\nb|*');
  });
});

describe('toggleLinePrefix', () => {
  it('prefixes the current line and keeps the caret on its character', () => {
    expect(prefix('first\nsec|ond', 'bullet')).toBe('first\n- sec|ond');
  });

  it('prefixes every selected line and selects the block', () => {
    expect(prefix('a\n|b\nc|\nd', 'bullet')).toBe('a\n|- b\n- c|\nd');
  });

  it('numbers lines in order', () => {
    expect(prefix('|x\ny\nz|', 'numbered')).toBe('|1. x\n2. y\n3. z|');
  });

  it('removes the prefix when every line already has it', () => {
    expect(prefix('|- [ ] a\n- [x] b|', 'task')).toBe('|a\nb|');
    expect(prefix('|1. x\n2. y|', 'numbered')).toBe('|x\ny|');
    expect(prefix('## Pl|an', 'heading')).toBe('Pl|an');
  });

  it('adds the prefix when only some lines have it', () => {
    expect(prefix('|- a\nb|', 'bullet')).toBe('|- - a\n- b|');
  });

  it('does not treat a task line as a bullet line', () => {
    expect(prefix('- [ ] t|ask', 'bullet')).toBe('- - [ ] t|ask');
  });

  it('ignores the line after a selection that ends at a line break', () => {
    expect(prefix('|a\n|b', 'bullet')).toBe('- |a\n|b');
  });

  it('works on an empty note', () => {
    expect(prefix('|', 'task')).toBe('- [ ] |');
  });
});

describe('insertLink', () => {
  it('uses the selection as the label and selects the URL', () => {
    const { text, start, end } = select('see |portal| now');
    expect(show(insertLink(text, start, end, 'link text'))).toBe(
      'see [portal](|https://|) now'
    );
  });

  it('uses the placeholder label with nothing selected', () => {
    expect(show(insertLink('', 0, 0, 'link text'))).toBe(
      '[link text](|https://|)'
    );
  });
});
