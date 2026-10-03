import { useTranslation } from 'react-i18next';

import { ADD_LABEL_KEYS } from '../components/shared/LinkedRecordsSection';
import {
  useInlineCreate,
  type CreatedRecord,
  type InlineCreateOutcome,
  type InlineCreateType,
} from '../contexts/InlineCreateContext';
import { useSubDialog } from '../contexts/SubDialogContext';
import { usePatientPermissions } from './usePatientPermissions';

interface Options {
  createType: InlineCreateType;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Runs once the record exists: links it (or holds it) and says which */
  onCreated: (
    _record: CreatedRecord
  ) => InlineCreateOutcome | Promise<InlineCreateOutcome>;
}

/**
 * Props for the "Add <type>" button next to a treatment's "Link <type>" button. Empty
 * (no button) in view mode, inside another sub-dialog, without a patient, or without
 * permission to create: the same conditions as the Add buttons on a Visit's link tabs.
 */
export const useTreatmentInlineCreate = ({
  createType,
  patientId,
  isViewMode = false,
  onCreated,
}: Options): { onCreateNew?: () => void; createLabel?: string } => {
  const { t } = useTranslation(['common']);
  const inlineCreate = useInlineCreate();
  const subDialog = useSubDialog();
  const { canCreate } = usePatientPermissions();

  if (!inlineCreate || subDialog || !patientId || isViewMode || !canCreate) {
    return {};
  }
  return {
    onCreateNew: () => inlineCreate.open(createType, { patientId, onCreated }),
    createLabel: t(ADD_LABEL_KEYS[createType]),
  };
};
