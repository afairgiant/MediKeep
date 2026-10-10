import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconStethoscope } from '@tabler/icons-react';

import {
  genericVisitLinkSource,
  labResultVisitLinkSource,
  visitCandidateLabel,
} from '../../constants/recordEncounterLinks';
import { setLinkCount } from '../../utils/linkCountStore';
import LinkedRecordsSection from './LinkedRecordsSection';
import { recordVisitsCountKey } from './RecordVisitsTabButton';
import type { PendingLink, RecordTabType } from '../../types/encounterLinks';

export interface RecordVisitsCardProps {
  /** Which record type this card belongs to */
  recordType: RecordTabType;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Visits chosen in the Add form, saved after the record is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  navigate?: (_path: string) => void;
}

/**
 * The "Visits" card shown in a record's Visits tab. The same card layout
 * the visit uses for its linked records, so a link looks and behaves the same
 * from either side. Lab results also edit the link's purpose.
 */
const RecordVisitsCard = ({
  recordType,
  recordId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  navigate,
}: RecordVisitsCardProps) => {
  const { t } = useTranslation(['shared']);
  const isLabResult = recordType === 'labResults';

  const source = useMemo(
    () =>
      isLabResult
        ? labResultVisitLinkSource(recordId ?? 0, patientId)
        : genericVisitLinkSource(recordType, recordId ?? 0, patientId),
    [isLabResult, recordType, recordId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t('shared:tabs.visits')}
      description={description}
      source={source}
      isSaved={Boolean(recordId)}
      entityType="encounter"
      icon={IconStethoscope}
      color="blue"
      supportsPurpose={isLabResult}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        // Keep the tab's "(n)" current as visits are linked or unlinked
        if (recordId)
          setLinkCount(recordVisitsCountKey(recordType, recordId), count);
      }}
      createType="visits"
      patientId={patientId}
      candidateLabel={visitCandidateLabel}
    />
  );
};

export default RecordVisitsCard;
