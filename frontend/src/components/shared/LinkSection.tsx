import { useState } from 'react';
import type { TablerIcon } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  IconCheck,
  IconEdit,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

import { useDateFormat } from '../../hooks/useDateFormat';
import { useNestedDialog } from '../../hooks/useNestedDialog';
import {
  PURPOSE_OPTIONS,
  getPurposeColor,
  getPurposeLabel,
} from '../../constants/encounterLabResultConstants';
import { navigateToEntity } from '../../utils/linkNavigation';
import type {
  LinkCandidate,
  LinkRow,
  LinkUpdate,
  PurposeConfig,
} from '../../types/encounterLinks';

const VISIT_PURPOSES: PurposeConfig = {
  options: PURPOSE_OPTIONS,
  getLabel: getPurposeLabel,
  getColor: getPurposeColor,
};

interface LinkSectionProps {
  /** Section title, already translated */
  title: string;
  rows: LinkRow[];
  /** Records that can still be linked (already-linked ones removed) */
  candidates: LinkCandidate[];
  /** Entity type understood by navigateToEntity, for the clickable name */
  entityType: string;
  icon: TablerIcon;
  color: string;
  supportsPurpose?: boolean;
  /** The purposes offered when supportsPurpose is set (default: the visit purposes) */
  purposeConfig?: PurposeConfig;
  /** Offers an "expected frequency" field next to the note (treatment links) */
  supportsExpectedFrequency?: boolean;
  isViewMode?: boolean;
  loading?: boolean;
  navigate?: (_path: string) => void;
  /** Shows an "Add <type>" button next to "Link" that creates a new record to link */
  onCreateNew?: () => void;
  createLabel?: string;
  onAdd: (
    _ids: number[],
    _note: string | null,
    _purpose: string | null,
    _expectedFrequency: string | null
  ) => Promise<void>;
  onUpdate: (_row: LinkRow, _updates: LinkUpdate) => Promise<void>;
  onRemove: (_row: LinkRow) => Promise<void>;
}

type FailureKey =
  | 'errors:relationships.addFailed'
  | 'errors:relationships.updateFailed'
  | 'errors:relationships.deleteFailed';

interface EditState {
  id: number;
  relevanceNote: string;
  purpose: string | null;
  expectedFrequency: string;
}

/**
 * One typed list of links with add / edit-note / remove. Data access is supplied by
 * the parent so the same section works for live (API) links and for links pending an unsaved form.
 */
const LinkSection = ({
  title,
  rows,
  candidates,
  entityType,
  icon: Icon,
  color,
  supportsPurpose = false,
  purposeConfig = VISIT_PURPOSES,
  supportsExpectedFrequency = false,
  isViewMode = false,
  loading = false,
  navigate,
  onCreateNew,
  createLabel,
  onAdd,
  onUpdate,
  onRemove,
}: LinkSectionProps) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const { formatDate } = useDateFormat() as {
    formatDate: (_date: string) => string;
  };

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [purpose, setPurpose] = useState<string | null>(null);
  const [expectedFrequency, setExpectedFrequency] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);

  const purposeOptions = purposeConfig.options.map(option => ({
    value: option.value,
    label: option.label,
  }));

  const run = async (action: () => Promise<void>, failureKey: FailureKey) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message || t(failureKey));
      return false;
    } finally {
      setBusy(false);
    }
    return true;
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setError(null);
    setSelectedIds([]);
    setNote('');
    setPurpose(null);
    setExpectedFrequency('');
  };

  // Escape closes this modal only, not the dialog it sits in
  useNestedDialog(showAddModal, () => {
    if (!busy) closeAddModal();
  });

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    const ok = await run(
      () =>
        onAdd(
          selectedIds.map(id => parseInt(id, 10)),
          note.trim() || null,
          supportsPurpose ? purpose : null,
          supportsExpectedFrequency ? expectedFrequency.trim() || null : null
        ),
      'errors:relationships.addFailed'
    );
    if (ok) closeAddModal();
  };

  const handleSaveEdit = async (row: LinkRow) => {
    if (!editing) return;
    const updates: LinkUpdate = {
      relevance_note: editing.relevanceNote.trim() || null,
    };
    if (supportsPurpose) updates.purpose = editing.purpose;
    if (supportsExpectedFrequency)
      updates.expected_frequency = editing.expectedFrequency.trim() || null;
    const ok = await run(
      () => onUpdate(row, updates),
      'errors:relationships.updateFailed'
    );
    if (ok) setEditing(null);
  };

  const handleRemove = async (row: LinkRow) => {
    if (!window.confirm(t('common:visits.relationships.confirmRemove'))) return;
    await run(() => onRemove(row), 'errors:relationships.deleteFailed');
  };

  // Same lozenge as the linked items in the Treatment dialogs; only clickable in
  // View mode so a click can't navigate away from a form being edited.
  const renderName = (row: LinkRow) => {
    const open =
      isViewMode && navigate
        ? () => navigateToEntity(entityType, row.targetId, navigate)
        : undefined;
    return (
      <Badge
        variant="light"
        color={color}
        leftSection={<Icon size={12} />}
        style={open ? { cursor: 'pointer' } : undefined}
        onClick={open}
      >
        {row.name}
      </Badge>
    );
  };

  const renderNote = (row: LinkRow, isEditing: boolean) => {
    if (isEditing && editing) {
      return (
        <Stack gap="xs">
          {supportsPurpose && (
            <Select
              label={t('common:visits.relationships.purpose')}
              data={purposeOptions}
              value={editing.purpose}
              onChange={value => setEditing({ ...editing, purpose: value })}
              clearable
              size="sm"
              comboboxProps={{ withinPortal: true, zIndex: 4000 }}
            />
          )}
          {supportsExpectedFrequency && (
            <TextInput
              label={t('common:labels.expectedFrequency')}
              value={editing.expectedFrequency}
              onChange={e =>
                setEditing({ ...editing, expectedFrequency: e.target.value })
              }
              maxLength={100}
              size="sm"
            />
          )}
          <Textarea
            placeholder={t('common:modals.relevanceNoteOptional')}
            value={editing.relevanceNote}
            onChange={e =>
              setEditing({ ...editing, relevanceNote: e.target.value })
            }
            size="sm"
            autosize
            minRows={2}
          />
        </Stack>
      );
    }
    if (row.relevanceNote) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          {row.relevanceNote}
        </Text>
      );
    }
    if (!isViewMode) {
      return (
        <Text size="sm" c="dimmed">
          {t('common:modals.noRelevanceNoteProvided')}
        </Text>
      );
    }
    return null;
  };

  const renderActions = (row: LinkRow, isEditing: boolean) => {
    if (isViewMode) return null;
    if (isEditing) {
      return (
        <Group gap="xs">
          <ActionIcon
            type="button"
            variant="light"
            color="green"
            size="sm"
            loading={busy}
            aria-label={t('common:buttons.save')}
            onClick={() => handleSaveEdit(row)}
          >
            <IconCheck size={14} />
          </ActionIcon>
          <ActionIcon
            type="button"
            variant="light"
            color="gray"
            size="sm"
            aria-label={t('shared:fields.cancel')}
            onClick={() => setEditing(null)}
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>
      );
    }
    return (
      <Group gap="xs">
        <ActionIcon
          type="button"
          variant="light"
          color="blue"
          size="sm"
          aria-label={t('common:visits.relationships.editLink')}
          onClick={() =>
            setEditing({
              id: row.id,
              relevanceNote: row.relevanceNote ?? '',
              purpose: row.purpose,
              expectedFrequency: row.expectedFrequency ?? '',
            })
          }
        >
          <IconEdit size={14} />
        </ActionIcon>
        <ActionIcon
          type="button"
          variant="light"
          color="red"
          size="sm"
          loading={busy}
          aria-label={t('common:visits.relationships.removeLink')}
          onClick={() => handleRemove(row)}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    );
  };

  if (loading && rows.length === 0) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      {error && !showAddModal && (
        <Alert icon={<IconInfoCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {rows.length > 0 ? (
        <Stack gap="sm">
          {rows.map(row => {
            const isEditing = editing?.id === row.id;
            return (
              <Paper key={row.id} withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm">
                      {renderName(row)}
                      {row.date && (
                        <Badge variant="outline" size="sm">
                          {formatDate(row.date)}
                        </Badge>
                      )}
                      {row.status && (
                        <Badge variant="outline" size="sm" color="green">
                          {row.status}
                        </Badge>
                      )}
                      {supportsPurpose && row.purpose && !isEditing && (
                        <Badge
                          variant="light"
                          size="sm"
                          color={purposeConfig.getColor(row.purpose)}
                        >
                          {purposeConfig.getLabel(row.purpose)}
                        </Badge>
                      )}
                    </Group>
                    {supportsExpectedFrequency &&
                      row.expectedFrequency &&
                      !isEditing && (
                        <Text size="sm" c="dimmed">
                          {t('common:labels.expectedFrequency')}:{' '}
                          {row.expectedFrequency}
                        </Text>
                      )}
                    {renderNote(row, isEditing)}
                  </Stack>
                  {renderActions(row, isEditing)}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper withBorder p="md" ta="center">
          <Text c="dimmed">{t('common:visits.relationships.none')}</Text>
        </Paper>
      )}

      {!isViewMode && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {t('common:visits.relationships.availableToLink', {
              count: candidates.length,
            })}
          </Text>
          <Group gap="xs">
            {onCreateNew && (
              <Button
                type="button"
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={onCreateNew}
                disabled={busy}
              >
                {createLabel}
              </Button>
            )}
            <Button
              type="button"
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => setShowAddModal(true)}
              disabled={busy || candidates.length === 0}
            >
              {t('common:buttons.link')}
            </Button>
          </Group>
        </Group>
      )}

      <Modal
        opened={showAddModal}
        onClose={closeAddModal}
        title={t('common:visits.relationships.modalTitle', { section: title })}
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          {error && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}
          <MultiSelect
            label={title}
            placeholder={t('common:visits.relationships.selectPlaceholder')}
            data={candidates.map(c => ({
              value: String(c.id),
              label: c.label,
            }))}
            value={selectedIds}
            onChange={setSelectedIds}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />
          {supportsPurpose && (
            <Select
              label={t('common:visits.relationships.purpose')}
              data={purposeOptions}
              value={purpose}
              onChange={setPurpose}
              clearable
              comboboxProps={{ withinPortal: true, zIndex: 4000 }}
            />
          )}
          {supportsExpectedFrequency && (
            <TextInput
              label={t('common:labels.expectedFrequency')}
              value={expectedFrequency}
              onChange={e => setExpectedFrequency(e.target.value)}
              maxLength={100}
            />
          )}
          <Textarea
            label={t('common:modals.relevanceNote')}
            placeholder={t('common:modals.relevanceNoteOptional')}
            value={note}
            onChange={e => setNote(e.target.value)}
            autosize
            minRows={3}
          />
          <Group justify="flex-end" gap="sm">
            <Button type="button" variant="light" onClick={closeAddModal}>
              {t('shared:fields.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              loading={busy}
              disabled={selectedIds.length === 0}
            >
              {t('common:visits.relationships.linkSelected')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default LinkSection;
