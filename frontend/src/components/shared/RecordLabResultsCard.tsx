import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconFlask } from '@tabler/icons-react';

import {
  recordLabResultLinkSource,
  type RecordLabResultPath,
} from '../../constants/recordLabResultLinks';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from '../../constants/encounterLinkTypes';
import { setLinkCount } from '../../utils/linkCountStore';
import LinkedRecordsSection from './LinkedRecordsSection';
import { recordLabResultsCountKey } from './RecordLabResultsTabButton';
import type { PendingLink } from '../../types/encounterLinks';

export interface RecordLabResultsCardProps {
  /** Which record type this card belongs to */
  recordPath: RecordLabResultPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Lab results chosen in the Add form, saved after the record is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  navigate?: (_path: string) => void;
}

/**
 * The "Lab Results" card shown in a medication's or procedure's Lab Results tab. The
 * same card the lab result uses for its own links, so a link looks and behaves the
 * same from either side.
 */
const RecordLabResultsCard = ({
  recordPath,
  recordId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  navigate,
}: RecordLabResultsCardProps) => {
  const { t } = useTranslation(['shared']);
  const config = ENCOUNTER_LINK_TYPE_BY_KEY.labResults;

  const source = useMemo(
    () => recordLabResultLinkSource(recordPath, recordId ?? 0, patientId),
    [recordPath, recordId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t('shared:tabs.labResults')}
      description={description}
      source={source}
      isSaved={Boolean(recordId)}
      entityType={config.entityType}
      icon={IconFlask}
      color={config.color}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        // Keep the tab's "(n)" current as lab results are linked or unlinked
        if (recordId)
          setLinkCount(recordLabResultsCountKey(recordPath, recordId), count);
      }}
      createType={config.createType}
      patientId={patientId}
      candidateLabel={config.candidateLabel}
    />
  );
};

export default RecordLabResultsCard;
