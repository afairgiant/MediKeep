import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPill } from '@tabler/icons-react';

import { conditionMedicationLinkSource } from '../../constants/conditionMedicationLinks';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from '../../constants/encounterLinkTypes';
import { setLinkCount } from '../../utils/linkCountStore';
import { conditionMedicationsCountKey } from './ConditionMedicationsTabButton';
import LinkedRecordsSection from './LinkedRecordsSection';
import type { PendingLink } from '../../types/encounterLinks';

export interface ConditionMedicationsCardProps {
  /** Saved condition id; null/undefined while a new condition is being created */
  conditionId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Medications chosen in the Add form, saved after the condition is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  navigate?: (_path: string) => void;
}

/**
 * The "Medications" card shown in a condition's Medications tab: the same card as the
 * Visits and Lab Results tabs, including "+ Add medication" and "+ Link".
 */
const ConditionMedicationsCard = ({
  conditionId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  navigate,
}: ConditionMedicationsCardProps) => {
  const { t } = useTranslation(['shared']);
  const config = ENCOUNTER_LINK_TYPE_BY_KEY.medications;

  const source = useMemo(
    () => conditionMedicationLinkSource(conditionId ?? 0, patientId),
    [conditionId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t('shared:categories.medications')}
      description={description}
      source={source}
      isSaved={Boolean(conditionId)}
      entityType={config.entityType}
      icon={IconPill}
      color={config.color}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        // Keep the tab's "(n)" current as medications are linked or unlinked
        if (conditionId)
          setLinkCount(conditionMedicationsCountKey(conditionId), count);
      }}
      createType={config.createType}
      patientId={patientId}
      candidateLabel={config.candidateLabel}
    />
  );
};

export default ConditionMedicationsCard;
