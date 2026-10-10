import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LAB_RESULT_LINK_TYPE_BY_KEY,
  labResultRecordLinkSource,
  type LabResultLinkKey,
} from '../../../constants/labResultRecordLinks';
import LinkedRecordsSection from '../../shared/LinkedRecordsSection';
import type { PendingLink } from '../../../types/encounterLinks';

export interface LabResultRecordLinksCardProps {
  /** Which kind of record this card links to */
  linkKey: LabResultLinkKey;
  /** Saved lab result id; null/undefined while a new lab result is being created */
  labResultId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Links chosen in the Add form, saved after the lab result is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  /** Reports how many saved links the lab result has, as links are added or removed */
  onCountChange?: (_key: LabResultLinkKey, _count: number) => void;
  navigate?: (_path: string) => void;
}

/**
 * The card shown in a lab result's Conditions, Medications, Procedures and
 * Treatments tabs: the same card as its Visits tab, including "Add <type>".
 */
const LabResultRecordLinksCard = ({
  linkKey,
  labResultId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  onCountChange,
  navigate,
}: LabResultRecordLinksCardProps) => {
  const { t } = useTranslation(['shared']);
  const config = LAB_RESULT_LINK_TYPE_BY_KEY[linkKey];

  const source = useMemo(
    () => labResultRecordLinkSource(linkKey, labResultId ?? 0, patientId),
    [linkKey, labResultId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t(`shared:categories.${linkKey}`)}
      description={description}
      source={source}
      isSaved={Boolean(labResultId)}
      entityType={config.entityType}
      icon={config.icon}
      color={config.color}
      supportsPurpose={config.supportsPurpose}
      purposeConfig={config.purposeConfig}
      supportsExpectedFrequency={config.supportsExpectedFrequency}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        if (labResultId) onCountChange?.(linkKey, count);
      }}
      createType={config.createType}
      patientId={patientId}
      candidateLabel={config.candidateLabel}
    />
  );
};

export default LabResultRecordLinksCard;
