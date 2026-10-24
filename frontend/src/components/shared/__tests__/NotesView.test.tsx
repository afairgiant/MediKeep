import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';

import NotesMarkdown from '../NotesMarkdown';
import NotesView from '../NotesView';
import fixture from '../../../../../tests/fixtures/markdown_notes_cases.json';

const html = (value: string) =>
  renderToStaticMarkup(<NotesMarkdown value={value} />);

const renderView = (ui: ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

describe('NotesMarkdown', () => {
  // The backend PDF renderer is checked against the same cases' "pdf" output.
  it.each(fixture.cases.map(c => [c.name, c] as const))(
    'matches the shared fixture: %s',
    (_name, testCase) => {
      expect(html(testCase.input)).toBe(testCase.html);
    }
  );

  it.each([
    '[x](javascript:alert(1))',
    '[x](JAVASCRIPT:alert(1))',
    '[x](&#106;avascript:alert(1))',
    '[x](vbscript:msgbox(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<img src=x onerror=alert(1)>',
    '![x](https://tracker.example/pixel.png)',
  ])('never emits a script, frame, image or unsafe link for %s', input => {
    const root = document.createElement('div');
    root.innerHTML = html(input);
    const elements = Array.from(root.querySelectorAll('*'));
    expect(root.querySelector('script, iframe, img')).toBeNull();
    root.querySelectorAll('a').forEach(link => {
      expect(link.getAttribute('href')).toMatch(/^(https?:|mailto:)/);
    });
    elements.forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        expect(attribute.name).not.toMatch(/^on/i);
      });
    });
  });

  it('opens safe links in a new tab without an opener', () => {
    expect(html('[a](https://e.com)')).toContain(
      'target="_blank" rel="noopener noreferrer"'
    );
  });
});

describe('NotesView', () => {
  // Must run first: once the lazy renderer has resolved it never suspends again.
  it('shows the plain text while the renderer loads', () => {
    const { container } = renderView(<NotesView value={'**Plan**\n- rest'} />);
    expect(container.querySelector('.notes-view')?.textContent).toBe(
      'Plan\nrest'
    );
  });

  it('renders the formatted note once the renderer loads', async () => {
    renderView(<NotesView value={'**Plan**\n- rest'} />);
    expect(await screen.findByText('Plan')).toHaveProperty('tagName', 'STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('rest');
  });

  it('shows the empty text for a blank note', () => {
    renderView(<NotesView value="  " emptyText="No notes" />);
    expect(screen.getByText('No notes')).toBeInTheDocument();
  });

  it('renders nothing for an empty note without empty text', () => {
    const { container } = renderView(<NotesView value={null} />);
    expect(container.querySelector('.notes-view')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});
