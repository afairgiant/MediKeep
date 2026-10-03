import { useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { usePractitioners } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import logger from '../../services/logger';
import {
  INITIAL_INJURY_FORM_DATA,
  buildInjuryPayload,
  validateInjuryForm,
  type InjuryFormData,
} from '../../utils/injuryFormUtils';
import type { InlineCreateDialogProps } from '../../contexts/InlineCreateContext';
import InjuryFormWrapper from '../medical/injuries/InjuryFormWrapper';
import { useInlineCreateFlow } from './useInlineCreateFlow';

// The JS form infers every destructured prop as required; the dialog passes what it needs.
const InjuryForm = InjuryFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

/** Add Injury, opened from inside another dialog (see InlineCreateContext). */
const InjuryCreateDialog = (props: InlineCreateDialogProps) => {
  const { t } = useTranslation(['common']);
  const { practitioners } = usePractitioners() as {
    practitioners: unknown[];
  };
  // A practitioner created from inside this dialog's own "New practitioner" link
  const [addedPractitioners, setAddedPractitioners] = useState<unknown[]>([]);

  const [injuryTypes, setInjuryTypes] = useState<unknown[]>([]);
  const [injuryTypesLoading, setInjuryTypesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiService
      .getInjuryTypes()
      .then((response: unknown) => {
        if (!cancelled) {
          setInjuryTypes(Array.isArray(response) ? response : []);
        }
      })
      .catch((err: unknown) => {
        logger.error('inline_create_injury_types_failed', {
          message: 'Failed to fetch injury types',
          error: err instanceof Error ? err.message : String(err),
          component: 'InjuryCreateDialog',
        });
      })
      .finally(() => {
        if (!cancelled) setInjuryTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flow = useInlineCreateFlow<InjuryFormData>({
    ...props,
    entity: 'injury',
    initialData: INITIAL_INJURY_FORM_DATA,
    validate: validateInjuryForm,
    buildPayload: buildInjuryPayload,
    create: payload => apiService.createInjury(payload),
  });

  return (
    <InjuryForm
      isOpen
      onClose={flow.close}
      title={t('common:inlineCreate.add.injury', 'Add Injury')}
      formData={flow.formData}
      onInputChange={flow.handleInputChange}
      onSubmit={flow.handleSubmit}
      editingInjury={null}
      practitionersOptions={[...practitioners, ...addedPractitioners]}
      onPractitionerCreated={(p: unknown) =>
        setAddedPractitioners(prev => [...prev, p])
      }
      injuryTypes={injuryTypes}
      injuryTypesLoading={injuryTypesLoading}
      isLoading={flow.busy}
      formError={flow.error}
      onDocumentManagerRef={flow.setDocumentManager}
    />
  );
};

export default InjuryCreateDialog;
