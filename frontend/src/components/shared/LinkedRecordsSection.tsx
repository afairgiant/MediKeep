import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paper, Stack, Text, Title } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

import { useSubDialog } from '../../contexts/SubDialogContext';
import {
  useInlineCreate,
  type CreatedRecord,
  type InlineCreateType,
} from '../../contexts/InlineCreateContext';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';
import logger from '../../services/logger';
import LinkSection from './LinkSection';
import type {
  LinkCandidate,
  LinkRow,
  LinkSource,
  LinkUpdate,
  PendingLink,
} from '../../types/encounterLinks';

interface LinkedRecordsSectionProps {
  title: string;
  /** Where links are read and written. Memoize it: a new object reloads the section. */
  source: LinkSource;
  /** False while the owning record is being created; links are then held as pending */
  isSaved: boolean;
  /** Entity type understood by navigateToEntity, for the clickable name */
  entityType: string;
  icon: TablerIcon;
  color: string;
  supportsPurpose?: boolean;
  isViewMode?: boolean;
  /** In View mode, render nothing when there are no links (default). False shows an empty card. */
  hideWhenEmpty?: boolean;
  navigate?: (_path: string) => void;
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  /** Offer "Add <type>" to create a new record and link it (not offered inside a sub-dialog) */
  createType?: InlineCreateType;
  /** The patient the new record is created for: the parent record's patient */
  patientId?: number | null;
  /** Label for a newly created record in the pending list */
  candidateLabel?: (_record: Record<string, unknown>) => string;
  /** Reports how many links the section holds (saved or pending) */
  onLoaded?: (_count: number) => void;
}

/** Button label per creatable type (also the title of the create dialog). */
export const ADD_LABEL_KEYS = {
  procedures: 'common:inlineCreate.add.procedure',
  injuries: 'common:inlineCreate.add.injury',
  symptoms: 'common:inlineCreate.add.symptom',
  conditions: 'common:inlineCreate.add.condition',
  medications: 'common:inlineCreate.add.medication',
  treatments: 'common:inlineCreate.add.treatment',
  labResults: 'common:inlineCreate.add.labResult',
  equipment: 'common:inlineCreate.add.equipment',
  visits: 'common:inlineCreate.add.visit',
} as const satisfies Record<InlineCreateType, string>;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/**
 * One titled, bordered section of links. Saved owner: reads and writes through
 * the API source. Unsaved owner: edits a pending list held by the parent form.
 * Shared by the visit's linked-record tabs and every record's Visits tab.
 */
const LinkedRecordsSection = ({
  title,
  source,
  isSaved,
  entityType,
  icon,
  color,
  supportsPurpose = false,
  isViewMode = false,
  hideWhenEmpty = true,
  navigate,
  pendingLinks,
  onPendingChange,
  createType,
  patientId,
  candidateLabel,
  onLoaded,
}: LinkedRecordsSectionProps) => {
  const { t } = useTranslation(['common']);
  const inlineCreate = useInlineCreate();
  const subDialog = useSubDialog();
  const { canCreate } = usePatientPermissions();
  const [liveRows, setLiveRows] = useState<LinkRow[]>([]);
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRows = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const rows = await source.loadRows(signal);
        if (signal?.aborted) return;
        setLiveRows(rows);
        onLoaded?.(rows.length);
      } finally {
        setLoading(false);
      }
    },
    // onLoaded is only a reporting callback and may change identity every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source]
  );

  useEffect(() => {
    if (!isSaved) return undefined;
    const controller = new AbortController();
    setLoadError(null);
    loadRows(controller.signal).catch(err => {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('linked_records_load_failed', {
        message: 'Failed to load links',
        error: errorMessage(err),
        component: 'LinkedRecordsSection',
      });
      setLoadError(errorMessage(err));
    });
    return () => controller.abort();
  }, [isSaved, loadRows]);

  // Candidates are only needed when the user can add links
  useEffect(() => {
    if (isViewMode) return undefined;
    const controller = new AbortController();
    source
      .fetchCandidates(controller.signal)
      .then(list => {
        if (!controller.signal.aborted) setCandidates(list);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('linked_records_candidates_failed', {
          message: 'Failed to load records to link',
          error: errorMessage(err),
          component: 'LinkedRecordsSection',
        });
      });
    return () => controller.abort();
  }, [isViewMode, source]);

  const pending = useMemo(() => pendingLinks ?? [], [pendingLinks]);

  const rows: LinkRow[] = useMemo(() => {
    if (isSaved) return liveRows;
    return pending.map(link => ({
      id: link.entityId,
      targetId: link.entityId,
      name:
        candidates.find(c => c.id === link.entityId)?.label ??
        `#${link.entityId}`,
      date: null,
      status: null,
      relevanceNote: link.relevanceNote,
      purpose: link.purpose,
    }));
  }, [isSaved, liveRows, pending, candidates]);

  useEffect(() => {
    if (!isSaved) onLoaded?.(rows.length);
  }, [isSaved, rows.length, onLoaded]);

  const available = useMemo(() => {
    const linked = new Set(rows.map(row => row.targetId));
    return candidates.filter(c => !linked.has(c.id));
  }, [rows, candidates]);

  const handleAdd = async (
    ids: number[],
    note: string | null,
    purpose: string | null
  ) => {
    if (!isSaved) {
      onPendingChange?.([
        ...pending,
        ...ids.map(entityId => ({ entityId, relevanceNote: note, purpose })),
      ]);
      return;
    }
    await source.createLinks(ids, note, purpose);
    await loadRows();
  };

  const handleUpdate = async (row: LinkRow, updates: LinkUpdate) => {
    if (!isSaved) {
      onPendingChange?.(
        pending.map(link =>
          link.entityId === row.targetId
            ? {
                ...link,
                relevanceNote: updates.relevance_note ?? null,
                purpose:
                  updates.purpose !== undefined
                    ? updates.purpose
                    : link.purpose,
              }
            : link
        )
      );
      return;
    }
    await source.updateLink(row, updates);
    await loadRows();
  };

  const handleRemove = async (row: LinkRow) => {
    if (!isSaved) {
      onPendingChange?.(pending.filter(link => link.entityId !== row.targetId));
      return;
    }
    await source.removeLink(row);
    await loadRows();
  };

  // The newest pending list, so a record created later in the sub-dialog never overwrites changes
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // One level deep: a sub-dialog never offers to create another record
  const canCreateNew = Boolean(
    createType &&
    inlineCreate &&
    !subDialog &&
    patientId &&
    !isViewMode &&
    canCreate
  );

  const handleCreateNew = () => {
    if (!createType || !inlineCreate || !patientId) return;
    inlineCreate.open(createType, {
      patientId,
      onCreated: async (record: CreatedRecord) => {
        // Make the new record known first: if linking then fails, it is still
        // offered in "+ Link", and a pending row gets a proper label instead of "#id"
        setCandidates(prev =>
          prev.some(c => c.id === record.id)
            ? prev
            : [
                ...prev,
                {
                  id: record.id,
                  label: candidateLabel?.(record) ?? `#${record.id}`,
                },
              ]
        );
        if (isSaved) {
          await source.createLinks([record.id], null, null);
          await loadRows();
          return 'linked';
        }
        // The parent isn't saved yet: hold the link until it is
        onPendingChange?.([
          ...pendingRef.current,
          { entityId: record.id, relevanceNote: null, purpose: null },
        ]);
        return 'pending';
      },
    });
  };

  if (
    hideWhenEmpty &&
    isViewMode &&
    !loading &&
    rows.length === 0 &&
    !loadError
  )
    return null;

  return (
    <Paper withBorder p="md" bg="var(--color-bg-secondary)">
      <Stack gap="md">
        <Title order={5}>{title}</Title>
        {loadError && (
          <Text size="sm" c="red">
            {loadError}
          </Text>
        )}
        <LinkSection
          title={title}
          rows={rows}
          candidates={available}
          entityType={entityType}
          icon={icon}
          color={color}
          supportsPurpose={supportsPurpose}
          isViewMode={isViewMode}
          loading={loading}
          navigate={navigate}
          onCreateNew={canCreateNew ? handleCreateNew : undefined}
          createLabel={createType ? t(ADD_LABEL_KEYS[createType]) : undefined}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      </Stack>
    </Paper>
  );
};

export default LinkedRecordsSection;
