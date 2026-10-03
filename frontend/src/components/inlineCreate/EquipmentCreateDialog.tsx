import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import {
  INITIAL_EQUIPMENT_FORM_DATA,
  buildEquipmentPayload,
  validateEquipmentForm,
  type EquipmentFormData,
} from '../../utils/equipmentFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import EquipmentFormWrapper from '../medical/equipment/EquipmentFormWrapper';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const EquipmentForm = EquipmentFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Medical Equipment, opened from inside another dialog (see InlineCreateContext). */
const EquipmentCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };

  const flow = useInlineCreateFlow<EquipmentFormData>({
    ...props,
    entity: 'equipment',
    initialData: INITIAL_EQUIPMENT_FORM_DATA,
    validate: validateEquipmentForm,
    buildPayload: buildEquipmentPayload,
    create: payload => apiService.createMedicalEquipment(payload),
  });

  return (
    <EquipmentForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.equipment', 'Add Equipment')}
      editingEquipment={null}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      practitionersOptions={practitioners}
      isLoading={flow.busy}
      formError={flow.error}
    />
  );
};

export default EquipmentCreateDialog;
