import { useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import logger from '../../services/logger';
import {
  INITIAL_TREATMENT_FORM_DATA,
  buildTreatmentPayload,
  validateTreatmentForm,
  type TreatmentFormData,
} from '../../utils/treatmentFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import TreatmentFormWrapper from '../medical/treatments/TreatmentFormWrapper';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const TreatmentForm = TreatmentFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Treatment, opened from inside another dialog (see InlineCreateContext). */
const TreatmentCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };
  // The page supplies the conditions for the dropdown; here they are loaded for the patient
  const [conditions, setConditions] = useState<unknown[]>([]);
  const [conditionsLoading, setConditionsLoading] = useState(true);
  const [addedPractitioners, setAddedPractitioners] = useState<unknown[]>([]);

  const { patientId } = props;
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const list = await apiService.getPatientConditions(
          patientId,
          controller.signal
        );
        setConditions(Array.isArray(list) ? list : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.error('treatment_create_conditions_load_error', {
          error: error instanceof Error ? error.message : String(error),
          component: 'TreatmentCreateDialog',
        });
      } finally {
        if (!controller.signal.aborted) setConditionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [patientId]);

  const flow = useInlineCreateFlow<TreatmentFormData>({
    ...props,
    entity: 'treatment',
    initialData: INITIAL_TREATMENT_FORM_DATA,
    validate: validateTreatmentForm,
    buildPayload: buildTreatmentPayload,
    create: payload => apiService.createTreatment(payload),
  });

  return (
    <TreatmentForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.treatment', 'Add Treatment')}
      editingTreatment={null}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      conditionsOptions={conditions}
      conditionsLoading={conditionsLoading}
      practitionersOptions={[...practitioners, ...addedPractitioners]}
      onPractitionerCreated={(p: unknown) =>
        setAddedPractitioners(prev => [...prev, p])
      }
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default TreatmentCreateDialog;
