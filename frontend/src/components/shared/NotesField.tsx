import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ActionIcon,
  Box,
  Code,
  Group,
  Popover,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Tooltip,
  type TextareaProps,
} from '@mantine/core';
import {
  IconBold,
  IconHeading,
  IconHelpCircle,
  IconItalic,
  IconLink,
  IconList,
  IconListCheck,
  IconListNumbers,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import NotesView from './NotesView';
import {
  insertLink,
  toggleLinePrefix,
  toggleWrap,
  type TextEdit,
} from '../../utils/notesEditing';

type Mode = 'write' | 'preview';
type EditFn = (_text: string, _start: number, _end: number) => TextEdit;

export interface NotesFieldProps extends Omit<
  TextareaProps,
  'autosize' | 'minRows' | 'maxRows' | 'value'
> {
  value?: string | null;
}

/**
 * Textarea for a Markdown note, with a formatting toolbar, shortcuts and a preview.
 *
 * A drop-in for Mantine ``Textarea``: toolbar edits call ``onChange`` with an event whose
 * ``target`` holds ``name`` and ``value``, the shape the form handlers read.
 */
export default function NotesField({
  value,
  onChange,
  onKeyDown,
  name,
  rows = 8,
  disabled,
  readOnly,
  maxLength,
  ...textareaProps
}: NotesFieldProps) {
  const { t } = useTranslation('shared');
  const [mode, setMode] = useState<Mode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const text = value ?? '';
  const editable = mode === 'write' && !disabled && !readOnly;

  useLayoutEffect(() => {
    const element = textareaRef.current;
    const selection = pendingSelection.current;
    if (!element || !selection) return;
    pendingSelection.current = null;
    element.focus();
    element.setSelectionRange(selection[0], selection[1]);
  }, [text]);

  const apply = (edit: EditFn) => {
    const element = textareaRef.current;
    if (!element || !editable) return;
    const result = edit(
      element.value,
      element.selectionStart,
      element.selectionEnd
    );
    if (maxLength !== undefined && result.text.length > maxLength) return;
    pendingSelection.current = [result.selectionStart, result.selectionEnd];
    const target = { name, value: result.text };
    onChange?.({
      target,
      currentTarget: target,
    } as unknown as ChangeEvent<HTMLTextAreaElement>);
  };

  const actions: Array<{
    key: string;
    label: string;
    syntax: string;
    icon: ReactNode;
    shortcut?: string;
    edit: EditFn;
  }> = [
    {
      key: 'bold',
      label: t('notesEditor.bold', 'Bold'),
      syntax: '**bold**',
      icon: <IconBold size={16} />,
      shortcut: 'B',
      edit: (s, a, b) =>
        toggleWrap(
          s,
          a,
          b,
          '**',
          t('notesEditor.boldPlaceholder', 'bold text')
        ),
    },
    {
      key: 'italic',
      label: t('notesEditor.italic', 'Italic'),
      syntax: '*italic*',
      icon: <IconItalic size={16} />,
      shortcut: 'I',
      edit: (s, a, b) =>
        toggleWrap(
          s,
          a,
          b,
          '*',
          t('notesEditor.italicPlaceholder', 'italic text')
        ),
    },
    {
      key: 'heading',
      label: t('notesEditor.heading', 'Heading'),
      syntax: '## Heading',
      icon: <IconHeading size={16} />,
      edit: (s, a, b) => toggleLinePrefix(s, a, b, 'heading'),
    },
    {
      key: 'bulletList',
      label: t('notesEditor.bulletList', 'Bulleted list'),
      syntax: '- item',
      icon: <IconList size={16} />,
      edit: (s, a, b) => toggleLinePrefix(s, a, b, 'bullet'),
    },
    {
      key: 'numberedList',
      label: t('notesEditor.numberedList', 'Numbered list'),
      syntax: '1. item',
      icon: <IconListNumbers size={16} />,
      edit: (s, a, b) => toggleLinePrefix(s, a, b, 'numbered'),
    },
    {
      key: 'checklist',
      label: t('notesEditor.checklist', 'Checklist'),
      syntax: '- [ ] task',
      icon: <IconListCheck size={16} />,
      edit: (s, a, b) => toggleLinePrefix(s, a, b, 'task'),
    },
    {
      key: 'link',
      label: t('notesEditor.link', 'Link'),
      syntax: '[text](https://example.com)',
      icon: <IconLink size={16} />,
      shortcut: 'K',
      edit: (s, a, b) =>
        insertLink(s, a, b, t('notesEditor.linkPlaceholder', 'link text')),
    },
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return;
    const action = actions.find(
      item => item.shortcut === event.key.toUpperCase()
    );
    if (action && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      apply(action.edit);
    }
  };

  const toolbar = (
    <Group justify="space-between" gap="xs" mb={6} wrap="wrap">
      <Group
        gap={2}
        role="toolbar"
        aria-label={t('notesEditor.toolbar', 'Formatting')}
      >
        {actions.map(action => {
          const tooltip = action.shortcut
            ? `${action.label} (Ctrl+${action.shortcut})`
            : action.label;
          return (
            <Tooltip key={action.key} label={tooltip} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={action.label}
                disabled={!editable}
                // Keep the textarea selection while clicking.
                onMouseDown={event => event.preventDefault()}
                onClick={() => apply(action.edit)}
              >
                {action.icon}
              </ActionIcon>
            </Tooltip>
          );
        })}
        <Popover width={280} position="bottom-start" withArrow shadow="md">
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('notesEditor.help', 'Formatting help')}
            >
              <IconHelpCircle size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="sm" fw={600} mb="xs">
              {t('notesEditor.helpTitle', 'Markdown is supported')}
            </Text>
            <Stack gap={4}>
              {actions.map(action => (
                <Group
                  key={action.key}
                  justify="space-between"
                  gap="xs"
                  wrap="nowrap"
                >
                  <Code>{action.syntax}</Code>
                  <Text size="xs" c="dimmed">
                    {action.label}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
      <SegmentedControl
        size="xs"
        value={mode}
        onChange={next => setMode(next as Mode)}
        data={[
          { value: 'write', label: t('notesEditor.write', 'Write') },
          { value: 'preview', label: t('notesEditor.preview', 'Preview') },
        ]}
      />
    </Group>
  );

  return (
    <Textarea
      {...textareaProps}
      ref={textareaRef}
      name={name}
      value={text}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      rows={rows}
      resize="vertical"
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      inputContainer={input => (
        <>
          {toolbar}
          <Box display={mode === 'write' ? undefined : 'none'}>{input}</Box>
          {mode === 'preview' && (
            <Box
              p="sm"
              mih={rows * 24}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <NotesView
                value={text}
                emptyText={t('notesEditor.previewEmpty', 'Nothing to preview')}
              />
            </Box>
          )}
        </>
      )}
    />
  );
}
