import { memo, type ComponentProps } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { isSafeNotesLink, remarkNotesDialect } from '../../utils/notesMarkdown';

const REMARK_PLUGINS: ComponentProps<typeof Markdown>['remarkPlugins'] = [
  [remarkGfm, { singleTilde: false }],
  remarkBreaks,
  remarkNotesDialect,
];

const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'input',
  'a',
  'code',
  'pre',
  'blockquote',
  'hr',
  'img',
];

const COMPONENTS: Components = {
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
  // Images are not loaded; their alt text stands in, as in the PDF.
  img: ({ alt }) => <>{alt}</>,
};

const transformUrl = (url: string) => (isSafeNotesLink(url) ? url : '');

/** Markdown note rendered with the notes dialect; never emits raw HTML. */
function NotesMarkdown({ value }: { value: string }) {
  return (
    <Markdown
      remarkPlugins={REMARK_PLUGINS}
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      skipHtml
      urlTransform={transformUrl}
      components={COMPONENTS}
    >
      {value}
    </Markdown>
  );
}

export default memo(NotesMarkdown);
