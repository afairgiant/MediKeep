import { useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import logger from '../../services/logger';
import {
  INITIAL_VISIT_FORM_DATA,
  buildVisitPayload,
  validateVisitForm,
  type VisitFormData,
} from '../../utils/visitFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import MantineVisitForm from '../medical/MantineVisitForm';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const VisitForm = MantineVisitForm as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Visit, opened from inside another dialog (see InlineCreateContext). */
const VisitCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };

  // The visit form can attach a condition: the patient's conditions
  const [conditions, setConditions] = useState<unknown[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiService
      .getPatientConditions(props.patientId)
      .then((response: unknown) => {
        if (!cancelled) setConditions(Array.isArray(response) ? response : []);
      })
      .catch((err: unknown) => {
        logger.error('inline_create_visit_conditions_failed', {
          message: 'Failed to fetch conditions for the visit form',
          error: err instanceof Error ? err.message : String(err),
          component: 'VisitCreateDialog',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [props.patientId]);

  const flow = useInlineCreateFlow<VisitFormData>({
    ...props,
    entity: 'visit',
    initialData: INITIAL_VISIT_FORM_DATA,
    validate: validateVisitForm,
    buildPayload: buildVisitPayload,
    create: payload => apiService.createEncounter(payload),
  });

  return (
    <VisitForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.visit', 'Add Visit')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      practitioners={practitioners}
      conditionsOptions={conditions}
      editingVisit={null}
      isLoading={flow.busy}
      formError={flow.error}
      patientId={props.patientId}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default VisitCreateDialog;
