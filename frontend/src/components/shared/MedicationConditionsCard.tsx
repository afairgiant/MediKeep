import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconStethoscope } from '@tabler/icons-react';

import { medicationConditionLinkSource } from '../../constants/medicationConditionLinks';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from '../../constants/encounterLinkTypes';
import { setLinkCount } from '../../utils/linkCountStore';
import LinkedRecordsSection from './LinkedRecordsSection';
import { medicationConditionsCountKey } from './MedicationConditionsTabButton';
import type { PendingLink } from '../../types/encounterLinks';

export interface MedicationConditionsCardProps {
  /** Saved medication id; null/undefined while a new medication is being created */
  medicationId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Conditions chosen in the Add form, saved after the medication is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  navigate?: (_path: string) => void;
}

/**
 * The "Conditions" card shown in a medication's Conditions tab: the same card as the
 * Visits and Lab Results tabs, and the other side of the condition's Medications card.
 */
const MedicationConditionsCard = ({
  medicationId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  navigate,
}: MedicationConditionsCardProps) => {
  const { t } = useTranslation(['shared']);
  const config = ENCOUNTER_LINK_TYPE_BY_KEY.conditions;

  const source = useMemo(
    () => medicationConditionLinkSource(medicationId ?? 0, patientId),
    [medicationId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t('shared:categories.conditions')}
      description={description}
      source={source}
      isSaved={Boolean(medicationId)}
      entityType={config.entityType}
      icon={IconStethoscope}
      color={config.color}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        // Keep the tab's "(n)" current as conditions are linked or unlinked
        if (medicationId)
          setLinkCount(medicationConditionsCountKey(medicationId), count);
      }}
      createType={config.createType}
      patientId={patientId}
      candidateLabel={config.candidateLabel}
    />
  );
};

export default MedicationConditionsCard;
