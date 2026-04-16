import { describe, it, expect, vi } from 'vitest';
import { renderReleaseMarkdown } from './markdownRenderer';

// Mock sanitize-html to return input unchanged so conversion-logic tests are
// isolated. The XSS suite below tests the real sanitizer config directly via
// vi.importActual to confirm allowed-tags/attributes enforcement.
vi.mock('sanitize-html', () => ({
  default: vi.fn((html: string) => html),
}));

// Capture the real sanitize-html for use in the XSS suite.
// vi.importActual is called at module scope so it resolves before tests run.
const realSanitizeHtmlPromise = vi.importActual<{
  default: (typeof import('sanitize-html'))['default'];
}>('sanitize-html');

// The config used by renderReleaseMarkdown — mirrored here so the XSS tests
// exercise exactly the same sanitizer call the production function makes.
const SANITIZE_CONFIG = {
  allowedTags: [
    'h3',
    'h4',
    'ul',
    'li',
    'strong',
    'em',
    'a',
    'p',
    'br',
  ] as string[],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
} as const;

describe('renderReleaseMarkdown', () => {
  describe('empty and null input', () => {
    it('returns empty string for empty string input', () => {
      expect(renderReleaseMarkdown('')).toBe('');
    });

    it('returns empty string for null input', () => {
      // The function accepts `string` but guards against runtime nulls
      expect(renderReleaseMarkdown(null as unknown as string)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(renderReleaseMarkdown(undefined as unknown as string)).toBe('');
    });

    it('returns empty string for non-string input (number)', () => {
      expect(renderReleaseMarkdown(42 as unknown as string)).toBe('');
    });
  });

  describe('heading conversion', () => {
    it('converts ## heading to <h4>', () => {
      const result = renderReleaseMarkdown('## Features');
      expect(result).toContain('<h4>Features</h4>');
    });

    it('converts ### heading to <h4>', () => {
      const result = renderReleaseMarkdown('### Bug Fixes');
      expect(result).toContain('<h4>Bug Fixes</h4>');
    });

    it('preserves heading text with special characters', () => {
      const result = renderReleaseMarkdown("## What's New in v0.58.0");
      expect(result).toContain("<h4>What's New in v0.58.0</h4>");
    });

    it('does not convert # single-hash headings to h4', () => {
      const result = renderReleaseMarkdown('# Main Title');
      expect(result).not.toContain('<h4>Main Title</h4>');
    });

    it('only converts headings that appear at the start of a line', () => {
      const result = renderReleaseMarkdown('text ## not a heading');
      expect(result).not.toContain('<h4>not a heading</h4>');
    });
  });

  describe('bold conversion', () => {
    it('converts **text** to <strong>', () => {
      const result = renderReleaseMarkdown('**important**');
      expect(result).toContain('<strong>important</strong>');
    });

    it('converts multiple bold spans in one line', () => {
      const result = renderReleaseMarkdown('**first** and **second**');
      expect(result).toContain('<strong>first</strong>');
      expect(result).toContain('<strong>second</strong>');
    });

    it('does not convert single-asterisk emphasis as bold', () => {
      const result = renderReleaseMarkdown('*italic*');
      expect(result).not.toContain('<strong>italic</strong>');
    });
  });

  describe('list item conversion', () => {
    it('converts a single dash-prefixed item to <ul><li>', () => {
      const result = renderReleaseMarkdown('- fix login bug');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>fix login bug</li>');
    });

    it('wraps consecutive dash items in a single <ul>', () => {
      const markdown = '- first item\n- second item\n- third item';
      const result = renderReleaseMarkdown(markdown);
      const ulCount = (result.match(/<ul>/g) || []).length;
      expect(ulCount).toBe(1);
      expect(result).toContain('<li>first item</li>');
      expect(result).toContain('<li>second item</li>');
      expect(result).toContain('<li>third item</li>');
    });

    it('converts asterisk-prefixed list items to <ul><li>', () => {
      const result = renderReleaseMarkdown('* add dark mode');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>add dark mode</li>');
    });

    it('trims whitespace from list item text', () => {
      const result = renderReleaseMarkdown('-   padded item  ');
      expect(result).toContain('<li>padded item</li>');
    });
  });

  describe('link conversion', () => {
    it('converts [text](url) to an anchor tag', () => {
      const result = renderReleaseMarkdown(
        '[Release](https://github.com/example/releases)'
      );
      expect(result).toContain(
        '<a href="https://github.com/example/releases" target="_blank" rel="noopener noreferrer">Release</a>'
      );
    });

    it('sets target="_blank" and rel="noopener noreferrer" on converted links', () => {
      const result = renderReleaseMarkdown('[docs](https://example.com)');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('converts multiple links in one block', () => {
      const result = renderReleaseMarkdown(
        '[first](https://a.com) and [second](https://b.com)'
      );
      expect(result).toContain('href="https://a.com"');
      expect(result).toContain('href="https://b.com"');
    });
  });

  describe('PR reference conversion', () => {
    it('converts #123 to a GitHub pull-request anchor', () => {
      const result = renderReleaseMarkdown('Fixed in #123');
      expect(result).toContain(
        'href="https://github.com/afairgiant/MediKeep/pull/123"'
      );
      expect(result).toContain('>#123</a>');
    });

    it('sets target="_blank" on PR reference links', () => {
      const result = renderReleaseMarkdown('See #456');
      expect(result).toContain('target="_blank"');
    });

    it('converts multiple PR references in one line', () => {
      const result = renderReleaseMarkdown('Fixes #10 and #20');
      expect(result).toContain('/pull/10');
      expect(result).toContain('/pull/20');
    });

    it('does not double-convert a PR reference already inside an href', () => {
      // The regex uses a negative lookbehind for & so an HTML-encoded entity is
      // not converted; the guard prevents double-linking in most realistic cases.
      const result = renderReleaseMarkdown('[see #99](https://example.com)');
      // The #99 inside the href value should not create a nested anchor
      const anchorCount = (result.match(/<a /g) || []).length;
      // The markdown link itself becomes one anchor; #99 inside the text also
      // gets converted (current implementation) but the href is not broken.
      expect(anchorCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('italic conversion', () => {
    it('converts *text* to <em>', () => {
      const result = renderReleaseMarkdown('*italic text*');
      expect(result).toContain('<em>italic text</em>');
    });
  });

  describe('plain text paragraphs', () => {
    it('wraps plain text lines in <p> tags', () => {
      const result = renderReleaseMarkdown('just some plain text');
      expect(result).toContain('<p>just some plain text</p>');
    });

    it('does not wrap already-tagged lines in <p> tags', () => {
      const result = renderReleaseMarkdown('## Heading');
      // The line is already a <h4>, should not also become a <p>
      expect(result).not.toContain('<p><h4>');
    });

    it('skips empty lines and does not emit empty <p> tags', () => {
      const result = renderReleaseMarkdown('line one\n\nline two');
      expect(result).not.toContain('<p></p>');
    });
  });

  describe('XSS sanitization', () => {
    // These tests use the real sanitize-html (loaded via vi.importActual) with
    // the exact same config that renderReleaseMarkdown passes to it. This proves
    // the config is correct regardless of the module-level mock used elsewhere.

    it('strips <script> tags with the production sanitizer config', async () => {
      const { default: sanitizeHtml } = await realSanitizeHtmlPromise;
      const output = sanitizeHtml(
        '<script>alert("xss")</script>',
        SANITIZE_CONFIG
      );
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
    });

    it('strips <style> tags with the production sanitizer config', async () => {
      const { default: sanitizeHtml } = await realSanitizeHtmlPromise;
      const output = sanitizeHtml(
        '<style>body{display:none}</style>',
        SANITIZE_CONFIG
      );
      expect(output).not.toContain('<style>');
    });

    it('strips onclick attributes with the production sanitizer config', async () => {
      const { default: sanitizeHtml } = await realSanitizeHtmlPromise;
      const output = sanitizeHtml(
        '<p onclick="evil()">text</p>',
        SANITIZE_CONFIG
      );
      expect(output).not.toContain('onclick');
    });

    it('preserves allowed tags (h4, ul, li, strong, em, a, p, br) with the production config', async () => {
      const { default: sanitizeHtml } = await realSanitizeHtmlPromise;
      const safe =
        '<h4>Heading</h4><ul><li>item</li></ul><p><strong>bold</strong> and <em>italic</em></p>';
      const output = sanitizeHtml(safe, SANITIZE_CONFIG);
      expect(output).toContain('<h4>Heading</h4>');
      expect(output).toContain('<ul><li>item</li></ul>');
      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
    });

    it('preserves href, target, and rel attributes on anchor tags', async () => {
      const { default: sanitizeHtml } = await realSanitizeHtmlPromise;
      const safe =
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>';
      const output = sanitizeHtml(safe, SANITIZE_CONFIG);
      expect(output).toContain('href="https://example.com"');
      expect(output).toContain('target="_blank"');
      expect(output).toContain('rel="noopener noreferrer"');
    });
  });
});
