import { Tabs } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import {
  RECORD_LINK_KIND_CONFIG,
  RECORD_LINK_KINDS,
  type RecordLinkKind,
  type RecordLinkPath,
} from '../../constants/recordLinkKinds';
import { useRecordLinkCounts } from '../../hooks/useRecordLinkCounts';
import { useTabLabel } from '../../hooks/useTabLabel';
import {
  LinkTabMenu,
  linkTabMode,
  useLinkTabVisibility,
  type LinkTabItem,
} from './LinkTabMenu';
import type { PendingLink } from '../../types/encounterLinks';

interface RecordLinkTabButtonsProps {
  /** The record type: a condition, medication, procedure, injury or symptom */
  recordPath: RecordLinkPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  /** The links chosen in the Add form, by kind: their number is the count until saved */
  pendingLinks?: Partial<Record<RecordLinkKind, PendingLink[]>>;
  /** The read-only dialog: only the types that have links, and no Link menu */
  isViewMode?: boolean;
  /** Value of the open tab: a type opened from the "Link" menu stays while it is open */
  activeTab?: string | null;
  /** Called with the tab value when the "Link" menu picks a type */
  onSelectTab?: (_value: string) => void;
}

/**
 * The linked-record tab buttons of a condition, medication, procedure, injury or symptom
 * dialog (RECORD_LINK_KINDS says which kinds each has), laid out like a lab result's
 * linked-record tabs. Render inside <Tabs.List>. A kind's tab value is its name
 * ("visits", "labResults", "medications", "conditions").
 * - Viewing a record: only the types that have links are shown, with no Link menu.
 * - Editing a saved record: every tab is shown.
 * - Adding a new record: only the types with links are shown (plus the open tab), and
 *   a "Link" menu offers the others.
 */
const RecordLinkTabButtons = ({
  recordPath,
  recordId,
  pendingLinks,
  isViewMode = false,
  activeTab,
  onSelectTab,
}: RecordLinkTabButtonsProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const counts = useRecordLinkCounts(recordPath, recordId, pendingLinks);

  const items: LinkTabItem[] = RECORD_LINK_KINDS[recordPath].map(kind => {
    const { icon, labelKey, defaultLabel } = RECORD_LINK_KIND_CONFIG[kind];
    return {
      key: kind,
      label: defaultLabel ? t(labelKey, defaultLabel) : t(labelKey),
      icon,
      count: counts[kind],
    };
  });

  const mode = linkTabMode(isViewMode, Boolean(recordId));
  const { isShown, hidden } = useLinkTabVisibility(items, mode, activeTab);

  return (
    <>
      {items.map(item =>
        isShown(item.key) ? (
          <Tabs.Tab
            key={item.key}
            value={item.key}
            leftSection={<item.icon size={16} />}
          >
            {tabLabel(item.label, item.count)}
          </Tabs.Tab>
        ) : null
      )}
      {mode === 'add' && (
        <LinkTabMenu hidden={hidden} onPick={value => onSelectTab?.(value)} />
      )}
    </>
  );
};

export default RecordLinkTabButtons;
