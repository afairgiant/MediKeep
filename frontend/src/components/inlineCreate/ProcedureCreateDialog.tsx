import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import {
  INITIAL_PROCEDURE_FORM_DATA,
  buildProcedurePayload,
  validateProcedureForm,
  type ProcedureFormData,
} from '../../utils/procedureFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import ProcedureFormWrapper from '../medical/procedures/ProcedureFormWrapper';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const ProcedureForm = ProcedureFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Procedure, opened from inside another dialog (see InlineCreateContext). */
const ProcedureCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };

  const flow = useInlineCreateFlow<ProcedureFormData>({
    ...props,
    entity: 'procedure',
    initialData: INITIAL_PROCEDURE_FORM_DATA,
    validate: validateProcedureForm,
    buildPayload: buildProcedurePayload,
    create: payload => apiService.createProcedure(payload),
  });

  return (
    <ProcedureForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.procedure', 'Add Procedure')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      editingItem={null}
      practitioners={practitioners}
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default ProcedureCreateDialog;
