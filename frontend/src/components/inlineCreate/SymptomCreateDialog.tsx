import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { symptomApi } from '../../services/api/symptomApi';
import {
  applySymptomInputChange,
  buildSymptomPayload,
  createInitialSymptomFormData,
  validateSymptomForm,
  type SymptomFormData,
} from '../../utils/symptomFormUtils';
import type {
  CreatedRecord,
  InlineCreateDialogProps,
} from '../../contexts/InlineCreateContext';
import MantineSymptomForm from '../medical/MantineSymptomForm';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const SymptomForm = MantineSymptomForm as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Symptom, opened from inside another dialog (see InlineCreateContext). */
const SymptomCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);

  const flow = useInlineCreateFlow<SymptomFormData>({
    ...props,
    entity: 'symptom',
    initialData: createInitialSymptomFormData(),
    validate: validateSymptomForm,
    buildPayload: buildSymptomPayload,
    applyInputChange: applySymptomInputChange,
    create: payload =>
      symptomApi.create(payload as never) as unknown as Promise<CreatedRecord>,
  });

  return (
    <SymptomForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.symptom', 'Add Symptom')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      editingSymptom={null}
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default SymptomCreateDialog;
