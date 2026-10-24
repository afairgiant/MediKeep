import { lazy, Suspense } from 'react';
import { Box, Text, type MantineColor, type MantineSize } from '@mantine/core';

import { notesToPlainText } from '../../utils/notesMarkdown';
import './NotesView.css';

const NotesMarkdown = lazy(() => import('./NotesMarkdown'));

interface NotesViewProps {
  value?: string | null;
  /** Shown dimmed when the note is empty; nothing renders without it. */
  emptyText?: string;
  size?: MantineSize;
  /** Text colour of a non-empty note. */
  c?: MantineColor;
}

/** Read-only formatted Markdown note; shows the plain text until the renderer loads. */
export default function NotesView({
  value,
  emptyText,
  size = 'sm',
  c,
}: NotesViewProps) {
  if (!value?.trim()) {
    return emptyText ? (
      <Text size={size} c="dimmed">
        {emptyText}
      </Text>
    ) : null;
  }
  return (
    <Box className="notes-view" fz={size} c={c}>
      <Suspense
        fallback={
          <Text size={size} style={{ whiteSpace: 'pre-wrap' }}>
            {notesToPlainText(value, { keepLineBreaks: true })}
          </Text>
        }
      >
        <NotesMarkdown value={value} />
      </Suspense>
    </Box>
  );
}
