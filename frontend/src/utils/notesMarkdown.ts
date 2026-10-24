import type { Plugin } from 'unified';

// Must match the PDF renderer in app/utils/notes_markdown.py; tests/fixtures/markdown_notes_cases.json checks both.
// Old plain-text notes use indented code and setext shapes by accident, so those stay literal too.
const DISABLED_CONSTRUCTS = [
  'codeIndented',
  'setextUnderline',
  'htmlFlow',
  'htmlText',
  'characterReference',
  'table',
  'gfmFootnoteCall',
  'gfmFootnoteDefinition',
  'gfmPotentialFootnoteCall',
];

const SAFE_LINK_PREFIXES = ['http://', 'https://', 'mailto:'];

export function isSafeNotesLink(href: string | null | undefined): boolean {
  const value = (href ?? '').trim().toLowerCase();
  return SAFE_LINK_PREFIXES.some(prefix => value.startsWith(prefix));
}

/** Remark plugin that leaves raw HTML, tables, footnotes and the shapes above as literal text. */
export const remarkNotesDialect: Plugin = function () {
  const data = this.data() as { micromarkExtensions?: unknown[] };
  data.micromarkExtensions = [
    ...(data.micromarkExtensions ?? []),
    { disable: { null: DISABLED_CONSTRUCTS } },
  ];
};

const ESCAPABLE = '\\`*_{}[]()#+-.!~>|<';
const ESCAPE_OFFSET = 0xe000;
const LINE_MARKER =
  /^\s{0,3}(?:#{1,6}\s+|>\s?|(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?)/;

function hideEscapes(text: string): string {
  return text.replace(/\\(.)/g, (match, char: string) =>
    ESCAPABLE.includes(char)
      ? String.fromCharCode(ESCAPE_OFFSET + char.charCodeAt(0))
      : match
  );
}

function restoreEscapes(text: string): string {
  return text.replace(/[\ue000-\ue07f]/g, char =>
    String.fromCharCode(char.charCodeAt(0) - ESCAPE_OFFSET)
  );
}

function stripLine(line: string): string {
  let text = line;
  // Blockquotes and list items can nest, so peel markers until none remain.
  let match;
  while ((match = LINE_MARKER.exec(text))) {
    text = text.slice(match[0].length);
  }
  if (
    /^\s*(?:```|~~~)/.test(text) ||
    /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(text)
  ) {
    return '';
  }
  return (
    text
      .replace(/!\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
      .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
      .replace(/<((?:https?:|mailto:)[^>\s]*)>/gi, '$1')
      // Only matched pairs are formatting; a lone delimiter stays, as in the rendered note.
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/(\*\*|__|~~)(?=\S)([^\n]*?\S)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/g, '$1$2')
      .replace(/(^|[^\w_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w_])/g, '$1$2')
  );
}

/**
 * Markdown note -> readable text for previews, table cells and search results.
 *
 * Lines are joined with spaces unless ``keepLineBreaks`` is set. The result is plain text,
 * not HTML: escape it before putting it in markup.
 */
export function notesToPlainText(
  markdown: string | null | undefined,
  { keepLineBreaks = false }: { keepLineBreaks?: boolean } = {}
): string {
  if (!markdown) return '';
  const lines = hideEscapes(String(markdown))
    .split(/\r?\n/)
    .map(line => restoreEscapes(stripLine(line)).trim());
  if (keepLineBreaks) {
    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}
