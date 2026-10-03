import { useCallback } from 'react';

import { usePractitioners } from '../../hooks/useGlobalData';
import logger from '../../services/logger';
import { notifySuccess, notifyWarning } from '../../utils/notifyTranslated';
import type {
  CreatedRecord,
  InlineCreateDialogProps,
} from '../../contexts/InlineCreateContext';
import TestPanelCreateDialog from '../medical/labresults/TestPanelCreateDialog';

/**
 * Add Lab Result, opened from inside another dialog (see InlineCreateContext).
 * Uses the quick panel dialog only (no Simple/Advanced switch, no follow-on edit
 * screen): one level deep, so the user returns to where they were.
 */
const LabResultCreateDialog = ({
  patientId,
  onCreated,
  onClose,
}: InlineCreateDialogProps) => {
  const { practitioners } = usePractitioners() as {
    practitioners: Array<{ id: number; name: string; specialty?: string }>;
  };
  const handleCreateSuccess = useCallback(
    async (record: CreatedRecord) => {
      // The lab result and its components exist now: whatever happens next, the dialog
      // closes, so it can never be submitted twice
      let outcome: Awaited<ReturnType<typeof onCreated>> = undefined;
      let linkFailed = false;
      try {
        outcome = await onCreated(record);
      } catch (err) {
        linkFailed = true;
        logger.error('inline_create_link_failed', {
          message: 'Record was created but could not be linked',
          entity: 'lab_result',
          recordId: record.id,
          error: err instanceof Error ? err.message : String(err),
          component: 'LabResultCreateDialog',
        });
        notifyWarning('common:inlineCreate.linkFailed');
      }
      if (!linkFailed) {
        notifySuccess(
          outcome === 'pending'
            ? 'common:inlineCreate.createdPending'
            : outcome === 'linked'
              ? 'common:inlineCreate.createdLinked'
              : 'common:inlineCreate.created'
        );
      }
      onClose();
    },
    [onCreated, onClose]
  );

  return (
    <TestPanelCreateDialog
      opened
      onClose={onClose}
      onCreateSuccess={handleCreateSuccess}
      practitioners={practitioners}
      currentPatient={{ id: patientId }}
    />
  );
};

export default LabResultCreateDialog;
