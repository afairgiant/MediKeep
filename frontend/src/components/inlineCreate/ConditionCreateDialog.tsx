import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import {
  INITIAL_CONDITION_FORM_DATA,
  buildConditionPayload,
  validateConditionForm,
  type ConditionFormData,
} from '../../utils/conditionFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import ConditionFormWrapper from '../medical/conditions/ConditionFormWrapper';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const ConditionForm = ConditionFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Condition, opened from inside another dialog (see InlineCreateContext). */
const ConditionCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };
  // A practitioner created from this dialog's own "New practitioner" link
  const [addedPractitioners, setAddedPractitioners] = useState<unknown[]>([]);

  const flow = useInlineCreateFlow<ConditionFormData>({
    ...props,
    entity: 'condition',
    initialData: INITIAL_CONDITION_FORM_DATA,
    validate: validateConditionForm,
    buildPayload: buildConditionPayload,
    create: payload => apiService.createCondition(payload),
  });

  return (
    <ConditionForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.condition', 'Add Condition')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      editingCondition={null}
      practitioners={[...practitioners, ...addedPractitioners]}
      onPractitionerCreated={(p: unknown) =>
        setAddedPractitioners(prev => [...prev, p])
      }
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default ConditionCreateDialog;
