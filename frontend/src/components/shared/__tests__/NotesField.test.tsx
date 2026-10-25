import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NotesField from '../NotesField';

const Harness = ({
  initial = '',
  onChange = vi.fn(),
  maxLength,
}: {
  initial?: string;
  onChange?: (_event: { target: { name: string; value: string } }) => void;
  maxLength?: number;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <NotesField
      label="Notes"
      name="notes"
      value={value}
      maxLength={maxLength}
      onChange={event => {
        onChange(event as never);
        setValue(event.target.value);
      }}
    />
  );
};

const renderField = (props: Parameters<typeof Harness>[0] = {}) =>
  render(
    <MantineProvider>
      <Harness {...props} />
    </MantineProvider>
  );

const textarea = () =>
  screen.getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement;

describe('NotesField', () => {
  it('keeps the label wired to the textarea and defaults to a tall, resizable box', () => {
    renderField();
    expect(textarea()).toHaveAttribute('rows', '8');
    expect(
      textarea().closest('[style*="--input-resize: vertical"]')
    ).not.toBeNull();
  });

  it('wraps the selection from the toolbar and reports the form event shape', async () => {
    const onChange = vi.fn();
    renderField({ initial: 'take two', onChange });
    textarea().setSelectionRange(5, 8);

    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(textarea().value).toBe('take **two**');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: { name: 'notes', value: 'take **two**' },
      })
    );
    expect(document.activeElement).toBe(textarea());
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([
      7, 10,
    ]);
  });

  it('applies keyboard shortcuts', () => {
    renderField({ initial: 'note' });
    textarea().setSelectionRange(0, 4);
    fireEvent.keyDown(textarea(), { key: 'i', ctrlKey: true });
    expect(textarea().value).toBe('*note*');

    textarea().setSelectionRange(1, 5);
    fireEvent.keyDown(textarea(), { key: 'k', metaKey: true });
    expect(textarea().value).toBe('*[note](https://)*');
  });

  it('turns lines into a checklist', async () => {
    renderField({ initial: 'a\nb' });
    textarea().setSelectionRange(0, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    expect(textarea().value).toBe('- [ ] a\n- [ ] b');
  });

  it('does not let a toolbar edit exceed maxLength', async () => {
    const onChange = vi.fn();
    renderField({ initial: 'abc', maxLength: 5, onChange });
    textarea().setSelectionRange(0, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(textarea().value).toBe('abc');
  });

  it('previews the formatted note and disables the toolbar while previewing', async () => {
    renderField({ initial: '## Plan' });
    await userEvent.click(screen.getByText('Preview'));

    expect(
      await screen.findByRole('heading', { name: 'Plan' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();

    await userEvent.click(screen.getByText('Write'));
    expect(textarea()).toBeVisible();
  });

  it('shows the empty preview text for a blank note', async () => {
    renderField();
    await userEvent.click(screen.getByText('Preview'));
    expect(screen.getByText('Nothing to preview')).toBeInTheDocument();
  });

  it('reaches every toolbar button, the mode switch and the textarea by Tab', async () => {
    renderField();
    const user = userEvent.setup();
    const reached = new Set<string>();
    for (let i = 0; i < 15; i += 1) {
      await user.tab();
      const element = document.activeElement as HTMLElement;
      reached.add(
        element.getAttribute('aria-label') ||
          element.getAttribute('value') ||
          element.tagName
      );
    }
    [
      'Bold',
      'Italic',
      'Heading',
      'Bulleted list',
      'Numbered list',
      'Checklist',
      'Link',
      'Formatting help',
      'TEXTAREA',
    ].forEach(name => expect(reached).toContain(name));
  });
});
