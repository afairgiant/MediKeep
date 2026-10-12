import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { conditionMedicationLinkSource } from '../../constants/conditionMedicationLinks';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from '../../constants/encounterLinkTypes';
import { LAB_RESULT_LINK_PURPOSES } from '../../constants/labResultLinkPurposes';
import { medicationConditionLinkSource } from '../../constants/medicationConditionLinks';
import {
  RECORD_LINK_KIND_CONFIG,
  type RecordLinkKind,
  type RecordLinkPath,
} from '../../constants/recordLinkKinds';
import {
  recordLabResultLinkSource,
  recordLabResultsHavePurpose,
} from '../../constants/recordLabResultLinks';
import { recordLinkCountKey } from '../../hooks/useRecordLinkCounts';
import { setLinkCount } from '../../utils/linkCountStore';
import LinkedRecordsSection from './LinkedRecordsSection';
import type { LinkSource, PendingLink } from '../../types/encounterLinks';

/** The kinds this card shows (visits have their own card, RecordVisitsCard). */
export type RecordLinkCardKind = Exclude<RecordLinkKind, 'visits'>;

type SourceBuilder = (
  _path: RecordLinkPath,
  _recordId: number,
  _patientId: number | null | undefined
) => LinkSource;

/** Where each kind's links are read and written. */
const SOURCES: Record<RecordLinkCardKind, SourceBuilder> = {
  // Medication, procedure and condition links to lab results share the record routes
  labResults: (path, id, patientId) =>
    recordLabResultLinkSource(path as 'medications', id, patientId),
  // The condition's medications and the medication's conditions are the same links
  medications: (_path, id, patientId) =>
    conditionMedicationLinkSource(id, patientId),
  conditions: (_path, id, patientId) =>
    medicationConditionLinkSource(id, patientId),
};

export interface RecordLinkCardProps {
  /** Which kind of record the card links to */
  kind: RecordLinkCardKind;
  /** The record the card belongs to */
  recordPath: RecordLinkPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Short line under the card title saying what the panel is for */
  description?: string;
  /** Links chosen in the Add form, saved after the record is created */
  pendingLinks?: PendingLink[];
  onPendingChange?: (_next: PendingLink[]) => void;
  navigate?: (_path: string) => void;
}

/**
 * The card of a record's Lab Results, Medications or Conditions tab: the same card as
 * its Visits tab, including "+ Add <type>" and "+ Link". The link is the same one the
 * other record edits, so it is seen and managed from both sides.
 */
const RecordLinkCard = ({
  kind,
  recordPath,
  recordId,
  patientId,
  isViewMode = false,
  description,
  pendingLinks,
  onPendingChange,
  navigate,
}: RecordLinkCardProps) => {
  const { t } = useTranslation(['shared']);
  const { icon, labelKey } = RECORD_LINK_KIND_CONFIG[kind];
  const linkType = ENCOUNTER_LINK_TYPE_BY_KEY[kind];
  const hasPurpose =
    kind === 'labResults' &&
    recordLabResultsHavePurpose(recordPath as 'medications');

  const source = useMemo(
    () => SOURCES[kind](recordPath, recordId ?? 0, patientId),
    [kind, recordPath, recordId, patientId]
  );

  return (
    <LinkedRecordsSection
      title={t(labelKey)}
      description={description}
      source={source}
      isSaved={Boolean(recordId)}
      entityType={linkType.entityType}
      icon={icon}
      color={linkType.color}
      supportsPurpose={hasPurpose}
      purposeConfig={LAB_RESULT_LINK_PURPOSES}
      isViewMode={isViewMode}
      hideWhenEmpty={false}
      navigate={navigate}
      pendingLinks={pendingLinks}
      onPendingChange={onPendingChange}
      onLoaded={count => {
        // Keep the tab's "(n)" current as links are added or removed
        if (recordId)
          setLinkCount(recordLinkCountKey(recordPath, recordId, kind), count);
      }}
      createType={linkType.createType}
      patientId={patientId}
      candidateLabel={linkType.candidateLabel}
    />
  );
};

export default RecordLinkCard;
