import React from 'react';
import { Badge, Text, Group, Box, Divider } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const VisitCard = ({
  visit,
  onEdit,
  onDelete,
  onView,
  fileCount,
  fileCountLoading,
  practitioners,
  conditions,
  navigate,
  onError
}) => {
  const { t } = useTranslation(['medical', 'common']);
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('visit_card_error', {
      message: 'Error in VisitCard',
      visitId: visit?.id,
      error: error.message,
      component: 'VisitCard',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const getPractitionerDisplay = (practitionerId) => {
    if (!practitionerId) return t('common:visits.card.noPractitionerAssigned', 'No practitioner assigned');

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`;
    }
    return t('common:visits.card.practitionerId', 'Practitioner ID: {{id}}', { id: practitionerId });
  };

  const getConditionDetails = (conditionId) => {
    if (!conditionId || !conditions) return null;
    return conditions.find(c => c.id === conditionId);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getVisitTypeColor = (visitType) => {
    switch (visitType?.toLowerCase()) {
      case 'emergency':
        return 'red';
      case 'urgent care':
        return 'orange';
      case 'follow-up':
        return 'blue';
      case 'routine':
        return 'green';
      case 'consultation':
        return 'purple';
      default:
        return 'gray';
    }
  };

  try {
    // Find practitioner and condition for this visit
    const practitioner = practitioners.find(p => p.id === visit.practitioner_id);
    const condition = getConditionDetails(visit.condition_id);

    // Generate badges
    const badges = [];
    if (visit.visit_type) {
      badges.push({ 
        label: visit.visit_type, 
        color: getVisitTypeColor(visit.visit_type) 
      });
    }
    if (visit.priority) {
      badges.push({ 
        label: visit.priority, 
        color: getPriorityColor(visit.priority) 
      });
    }

    // Add tags as badges
    if (visit.tags && visit.tags.length > 0) {
      badges.push({
        label: `🏷️ ${visit.tags[0]}${visit.tags.length > 1 ? ` +${visit.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('common:labels.date'),
        value: visit.date,
        render: (value) => value ? formatLongDate(value) : t('common:labels.notSpecified')
      },
      {
        label: t('visits.attendingPractitioner.label'),
        value: visit.practitioner_id,
        render: (value) => {
          if (!value) return t('common:visits.card.noPractitionerAssigned', 'No practitioner assigned');

          const practitionerDisplay = getPractitionerDisplay(value);
          if (practitioner) {
            return (
              <Text
                size="sm"
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigateToEntity('practitioner', value, navigate)}
                title={t('common:visits.card.viewPractitioner', 'View practitioner details')}
              >
                {practitionerDisplay}
              </Text>
            );
          }
          return practitionerDisplay;
        }
      },
      {
        label: t('visits.chiefComplaint.label'),
        value: visit.chief_complaint
      },
      {
        label: t('common:labels.location'),
        value: visit.location
      },
      {
        label: t('visits.durationMinutes.label'),
        value: visit.duration_minutes,
        render: (value) => value ? t('common:visits.card.durationMinutes', '{{minutes}} minutes', { minutes: value }) : t('common:labels.notSpecified')
      }
    ];

    // Add related condition if exists
    if (condition) {
      fields.push({
        label: t('visits.relatedCondition.label'),
        value: condition.id,
        render: (value) => (
          <Text
            size="sm"
            c="blue"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigateToEntity('condition', value, navigate)}
            title={t('common:visits.card.viewCondition', 'View condition details')}
          >
            {condition.diagnosis}
          </Text>
        )
      });
    }

    // Create additional content sections for SOAP notes
    const additionalContent = (
      <>
        {visit.diagnosis && (
          <Box
            mt="md"
            pt="md"
            style={{
              borderTop: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Text size="sm" c="dimmed" mb="xs">
              📋 {t('visits.diagnosisAssessment.label')}
            </Text>
            <Text size="sm">
              {visit.diagnosis}
            </Text>
          </Box>
        )}

        {visit.treatment_plan && (
          <Box
            mt="md"
            pt="md"
            style={{
              borderTop: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Text size="sm" c="dimmed" mb="xs">
              💊 {t('visits.treatmentPlan.label')}
            </Text>
            <Text size="sm">
              {visit.treatment_plan}
            </Text>
          </Box>
        )}

        {visit.follow_up_instructions && (
          <Box
            mt="md"
            pt="md"
            style={{
              borderTop: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Text size="sm" c="dimmed" mb="xs">
              📅 {t('visits.followUpInstructions.label')}
            </Text>
            <Text size="sm">
              {visit.follow_up_instructions}
            </Text>
          </Box>
        )}
      </>
    );

    return (
      <BaseMedicalCard
        title={
          <Group gap="xs">
            <IconCalendar size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={600} size="lg">
              {visit.reason || t('common:visits.card.generalVisit', 'General Visit')}
            </Text>
          </Group>
        }
        status={visit.status}
        badges={badges}
        fields={fields}
        notes={visit.notes}
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(visit)}
        onEdit={() => onEdit(visit)}
        onDelete={() => onDelete(visit)}
        entityType="visit"
        onError={handleError}
      >
        {additionalContent}
      </BaseMedicalCard>
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default VisitCard;