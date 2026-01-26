import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ProcedureCard = ({
  procedure,
  onEdit,
  onDelete,
  onView,
  fileCount,
  fileCountLoading,
  practitioners,
  navigate,
  onError
}) => {
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const { formatLongDate } = useDateFormat();
  const handleError = (error) => {
    logger.error('procedure_card_error', {
      message: 'Error in ProcedureCard',
      procedureId: procedure?.id,
      error: error.message,
      component: 'ProcedureCard',
    });
    
    if (onError) {
      onError(error);
    }
  };

  try {
    // Find practitioner for this procedure
    const practitioner = practitioners.find(p => p.id === procedure.practitioner_id);

    // Generate badges
    const badges = [];
    if (procedure.procedure_type) {
      badges.push({ label: procedure.procedure_type, color: 'blue' });
    }

    // Add tags as badges
    if (procedure.tags && procedure.tags.length > 0) {
      badges.push({
        label: `🏷️ ${procedure.tags[0]}${procedure.tags.length > 1 ? ` +${procedure.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('procedures.procedureDate.label'),
        value: procedure.date,
        render: (value) => value ? formatLongDate(value) : tCommon('labels.notSpecified')
      },
      {
        label: t('procedures.procedureCode.label'),
        value: procedure.procedure_code
      },
      {
        label: t('procedures.procedureSetting.label'),
        value: procedure.procedure_setting,
        render: (value) => value ? (
          <Badge variant="light" color="cyan" size="sm">
            {value}
          </Badge>
        ) : tCommon('labels.notSpecified')
      },
      {
        label: t('procedures.procedureDuration.label'),
        value: procedure.procedure_duration,
        render: (value) => value ? tCommon('procedures.card.durationMinutes', '{{minutes}} minutes', { minutes: value }) : tCommon('labels.notSpecified')
      },
      {
        label: tCommon('labels.facility'),
        value: procedure.facility
      },
      {
        label: t('procedures.performingPractitioner.label'),
        value: procedure.practitioner_id,
        render: (value) => {
          if (!value) return tCommon('labels.notSpecified');

          const practitionerName = practitioner?.name || tCommon('procedures.card.practitionerId', 'Practitioner ID: {{id}}', { id: value });
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title={tCommon('procedures.card.viewPractitioner', 'View practitioner details')}
            >
              {practitionerName}
            </Text>
          );
        }
      },
      {
        label: tCommon('labels.description'),
        value: procedure.description,
        align: 'flex-start',
        style: { flex: 1 }
      }
    ];

    // Add complications field if it exists
    if (procedure.procedure_complications) {
      fields.push({
        label: t('procedures.complications.label'),
        value: procedure.procedure_complications,
        align: 'flex-start',
        style: { flex: 1, color: '#d63384' }
      });
    }

    return (
      <BaseMedicalCard
        title={procedure.procedure_name}
        status={procedure.status}
        badges={badges}
        fields={fields}
        notes={procedure.notes}
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(procedure)}
        onEdit={() => onEdit(procedure)}
        onDelete={() => onDelete(procedure)}
        entityType="procedure"
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default ProcedureCard;