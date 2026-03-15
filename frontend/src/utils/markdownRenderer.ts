import sanitizeHtml from 'sanitize-html';

const GITHUB_REPO_URL = 'https://github.com/afairgiant/MediKeep';

/**
 * Convert consecutive lines starting with the given prefix into an HTML unordered list.
 */
function convertListBlock(match: string, prefix: string): string {
  const items = match
    .split('\n')
    .filter((line) => line.startsWith(prefix))
    .map((line) => `<li>${line.slice(prefix.length).trim()}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

/**
 * Converts simplified markdown from GitHub release notes to sanitized HTML.
 * Handles headings, bold, lists, links, and PR references.
 */
export function renderReleaseMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let html = markdown;

  // Convert ## and ### headings to <h4>
  html = html.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm, '<h4>$1</h4>');

  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* to <em>
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert [text](url) links to <a> tags
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Convert #123 PR references to GitHub links (avoid lookbehind for older Safari compat)
  html = html.replace(
    /(^|[^&\w])#(\d+)/g,
    `$1<a href="${GITHUB_REPO_URL}/pull/$2" target="_blank" rel="noopener noreferrer">#$2</a>`
  );

  // Convert `- item` list blocks into <ul><li>
  html = html.replace(
    /(?:^- .+$\n?)+/gm,
    (match) => convertListBlock(match, '- ')
  );

  // Convert `* item` list blocks into <ul><li>
  html = html.replace(
    /(?:^\* .+$\n?)+/gm,
    (match) => convertListBlock(match, '* ')
  );

  // Convert remaining plain text lines to paragraphs (skip empty lines and already-tagged lines)
  html = html
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  return sanitizeHtml(html, {
    allowedTags: ['h3', 'h4', 'ul', 'li', 'strong', 'em', 'a', 'p', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
  });
}
