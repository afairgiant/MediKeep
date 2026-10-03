import type { ComponentType } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

import { usePharmacies, usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import {
  INITIAL_MEDICATION_FORM_DATA,
  buildMedicationPayload,
  validateMedicationForm,
  type MedicationFormData,
} from '../../utils/medicationFormUtils';
import { getWontFireWarning } from '../../utils/medicationReminders';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import MantineMedicationForm from '../medical/MantineMedicationForm';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const MedicationForm = MantineMedicationForm as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Medication, opened from inside another dialog (see InlineCreateContext). */
const MedicationCreateDialog = (props: InlineCreateDialogProps) => {
  // Same namespaces as the Medications page: the reminder warning reads the medical ones
  const { t } = useTranslation(['common', 'medical', 'shared']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };
  const { pharmacies } = usePharmacies() as { pharmacies: unknown[] };

  const flow = useInlineCreateFlow<MedicationFormData>({
    ...props,
    entity: 'medication',
    initialData: INITIAL_MEDICATION_FORM_DATA,
    validate: validateMedicationForm,
    buildPayload: buildMedicationPayload,
    create: payload => apiService.createMedication(payload),
    // Same as the Medications page: say so at the moment of saving when a reminder
    // that was set up will not actually fire
    afterCreate: payload => {
      const warning = getWontFireWarning(payload, t);
      if (warning) {
        notifications.show({
          title: warning.title,
          message: warning.message,
          color: 'yellow',
          autoClose: 10000,
        });
      }
    },
  });

  return (
    <MedicationForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.medication', 'Add Medication')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      editingMedication={null}
      practitioners={practitioners}
      pharmacies={pharmacies}
      conditions={[]}
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default MedicationCreateDialog;
