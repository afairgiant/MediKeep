import type { ReactElement } from 'react';
import { IconFlask, IconPill, IconStethoscope } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import type { RecordLabResultPath } from '../../constants/recordLabResultLinks';
import ConditionMedicationsTabButton, {
  useConditionMedicationsCount,
} from './ConditionMedicationsTabButton';
import {
  LinkTabMenu,
  linkTabMode,
  useLinkTabVisibility,
  type LinkTabItem,
} from './LinkTabMenu';
import RecordLabResultsTabButton, {
  useRecordLabResultsCount,
} from './RecordLabResultsTabButton';
import RecordVisitsTabButton, {
  useRecordVisitsCount,
} from './RecordVisitsTabButton';
import type { PendingLink } from '../../types/encounterLinks';

interface RecordLinkTabButtonsProps {
  /** The record type: a medication, a procedure or a condition */
  recordPath: RecordLabResultPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  pendingVisitLinks?: PendingLink[];
  pendingLabResultLinks?: PendingLink[];
  /** Conditions only: the medications chosen in the Add form */
  pendingMedicationLinks?: PendingLink[];
  /** Value of the open tab: a type opened from the "Link" menu stays while it is open */
  activeTab?: string | null;
  /** Called with the tab value when the "Link" menu picks a type */
  onSelectTab?: (_value: string) => void;
}

/**
 * The linked-record tab buttons of a medication, procedure or condition Add/Edit form
 * (Visits and Lab Results; conditions also have Medications), laid out like a lab
 * result's linked-record tabs. Render inside <Tabs.List>.
 * - Editing a saved record: every tab is shown.
 * - Adding a new record: only the types with links are shown (plus the open tab), and
 *   a "Link" menu offers the others.
 */
const RecordLinkTabButtons = ({
  recordPath,
  recordId,
  pendingVisitLinks,
  pendingLabResultLinks,
  pendingMedicationLinks,
  activeTab,
  onSelectTab,
}: RecordLinkTabButtonsProps) => {
  const { t } = useTranslation(['shared']);
  const hasMedications = recordPath === 'conditions';

  // Every count hook runs for every record type; the ones a type does not have are off
  const visitsCount = useRecordVisitsCount(
    recordPath,
    recordId,
    pendingVisitLinks
  );
  const labResultsCount = useRecordLabResultsCount(
    recordPath,
    recordId,
    pendingLabResultLinks
  );
  const medicationsCount = useConditionMedicationsCount(
    recordId,
    pendingMedicationLinks,
    hasMedications
  );

  const visitsItem: LinkTabItem = {
    key: 'visits',
    label: t('shared:tabs.visits', 'Visits'),
    icon: IconStethoscope,
    count: visitsCount,
  };
  const labResultsItem: LinkTabItem = {
    key: 'labResults',
    label: t('shared:tabs.labResults'),
    icon: IconFlask,
    count: labResultsCount,
  };
  const medicationsItem: LinkTabItem = {
    key: 'medications',
    label: t('shared:categories.medications'),
    icon: IconPill,
    count: medicationsCount,
  };
  const items = hasMedications
    ? [medicationsItem, labResultsItem, visitsItem]
    : [visitsItem, labResultsItem];

  const mode = linkTabMode(false, Boolean(recordId));
  const { isShown, hidden } = useLinkTabVisibility(items, mode, activeTab);

  const buttons: Record<string, ReactElement> = {
    medications: (
      <ConditionMedicationsTabButton
        key="medications"
        conditionId={recordId}
        managed
        count={medicationsCount}
      />
    ),
    labResults: (
      <RecordLabResultsTabButton
        key="labResults"
        recordPath={recordPath}
        recordId={recordId}
        managed
        count={labResultsCount}
      />
    ),
    visits: (
      <RecordVisitsTabButton
        key="visits"
        recordType={recordPath}
        recordId={recordId}
        managed
        count={visitsCount}
      />
    ),
  };

  return (
    <>
      {items.map(item => (isShown(item.key) ? buttons[item.key] : null))}
      {mode === 'add' && (
        <LinkTabMenu hidden={hidden} onPick={value => onSelectTab?.(value)} />
      )}
    </>
  );
};

export default RecordLinkTabButtons;
