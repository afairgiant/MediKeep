import type { ReactElement } from 'react';
import { IconFlask, IconPill, IconStethoscope } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import type { RecordLabResultPath } from '../../constants/recordLabResultLinks';
import ConditionMedicationsTabButton, {
  useConditionMedicationsCount,
} from './ConditionMedicationsTabButton';
import MedicationConditionsTabButton, {
  useMedicationConditionsCount,
} from './MedicationConditionsTabButton';
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

/** Records whose dialogs show linked-record tabs through RecordLinkTabButtons. */
export type RecordLinkPath = RecordLabResultPath | 'injuries' | 'symptoms';

interface RecordLinkTabButtonsProps {
  /** The record type: a medication, procedure, condition, injury or symptom */
  recordPath: RecordLinkPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  pendingVisitLinks?: PendingLink[];
  pendingLabResultLinks?: PendingLink[];
  /** Conditions only: the medications chosen in the Add form */
  pendingMedicationLinks?: PendingLink[];
  /** Medications only: the conditions chosen in the Add form */
  pendingConditionLinks?: PendingLink[];
  /** The read-only dialog: only the types that have links, and no Link menu */
  isViewMode?: boolean;
  /** Value of the open tab: a type opened from the "Link" menu stays while it is open */
  activeTab?: string | null;
  /** Called with the tab value when the "Link" menu picks a type */
  onSelectTab?: (_value: string) => void;
}

/**
 * The linked-record tab buttons of a medication, procedure or condition Add/Edit form
 * (Visits and Lab Results; conditions also have Medications, and medications also
 * have Conditions), laid out like a lab
 * result's linked-record tabs. Render inside <Tabs.List>.
 * - Viewing a record: only the types that have links are shown, with no Link menu.
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
  pendingConditionLinks,
  isViewMode = false,
  activeTab,
  onSelectTab,
}: RecordLinkTabButtonsProps) => {
  const { t } = useTranslation(['shared']);
  const hasMedications = recordPath === 'conditions';
  const hasConditions = recordPath === 'medications';
  // Injuries and symptoms link to visits only
  const hasLabResults = recordPath !== 'injuries' && recordPath !== 'symptoms';

  // Every count hook runs for every record type; the ones a type does not have are off
  const visitsCount = useRecordVisitsCount(
    recordPath,
    recordId,
    pendingVisitLinks
  );
  const labResultsCount = useRecordLabResultsCount(
    recordPath,
    recordId,
    pendingLabResultLinks,
    hasLabResults
  );
  const medicationsCount = useConditionMedicationsCount(
    recordId,
    pendingMedicationLinks,
    hasMedications
  );
  const conditionsCount = useMedicationConditionsCount(
    recordId,
    pendingConditionLinks,
    hasConditions
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
  const conditionsItem: LinkTabItem = {
    key: 'conditions',
    label: t('shared:categories.conditions'),
    icon: IconStethoscope,
    count: conditionsCount,
  };
  let items = hasLabResults ? [visitsItem, labResultsItem] : [visitsItem];
  if (hasMedications) items = [medicationsItem, labResultsItem, visitsItem];
  if (hasConditions) items = [conditionsItem, labResultsItem, visitsItem];

  const mode = linkTabMode(isViewMode, Boolean(recordId));
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
    conditions: (
      <MedicationConditionsTabButton
        key="conditions"
        medicationId={recordId}
        managed
        count={conditionsCount}
      />
    ),
    labResults: (
      <RecordLabResultsTabButton
        key="labResults"
        recordPath={recordPath as RecordLabResultPath}
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
