import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatDate } from '../../../utils/helpers';
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
  const { t } = useTranslation('common');
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
        label: t('procedures.card.procedureDate', 'Procedure Date'),
        value: procedure.date,
        render: (value) => value ? formatDate(value) : t('procedures.card.notSpecified', 'Not specified')
      },
      {
        label: t('procedures.card.code', 'Code'),
        value: procedure.procedure_code
      },
      {
        label: t('procedures.card.setting', 'Setting'),
        value: procedure.procedure_setting,
        render: (value) => value ? (
          <Badge variant="light" color="cyan" size="sm">
            {value}
          </Badge>
        ) : t('procedures.card.notSpecified', 'Not specified')
      },
      {
        label: t('procedures.card.duration', 'Duration'),
        value: procedure.procedure_duration,
        render: (value) => value ? t('procedures.card.durationMinutes', '{{minutes}} minutes', { minutes: value }) : t('procedures.card.notSpecified', 'Not specified')
      },
      {
        label: t('procedures.card.facility', 'Facility'),
        value: procedure.facility
      },
      {
        label: t('procedures.card.doctor', 'Doctor'),
        value: procedure.practitioner_id,
        render: (value) => {
          if (!value) return t('procedures.card.notSpecified', 'Not specified');

          const practitionerName = practitioner?.name || t('procedures.card.practitionerId', 'Practitioner ID: {{id}}', { id: value });
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title={t('procedures.card.viewPractitioner', 'View practitioner details')}
            >
              {practitionerName}
            </Text>
          );
        }
      },
      {
        label: t('procedures.card.description', 'Description'),
        value: procedure.description,
        align: 'flex-start',
        style: { flex: 1 }
      }
    ];

    // Add complications field if it exists
    if (procedure.procedure_complications) {
      fields.push({
        label: t('procedures.card.complications', 'Complications'),
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