import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconExclamationCircle,
  IconAlertCircle,
  IconShield,
  IconShieldCheck,
} from '@tabler/icons-react';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';

const AllergyCard = ({
  allergy,
  onEdit,
  onDelete,
  onView,
  medications = [],
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  onError
}) => {
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('allergy_card_error', {
      message: 'Error in AllergyCard',
      allergyId: allergy?.id,
      error: error.message,
      component: 'AllergyCard',
    });

    if (onError) {
      onError(error);
    }
  };

  // Helper function to get severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return IconExclamationCircle;
      case 'severe':
        return IconAlertTriangle;
      case 'moderate':
        return IconAlertCircle;
      case 'mild':
        return IconShield;
      default:
        return IconShieldCheck;
    }
  };

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return 'red';
      case 'severe':
        return 'orange';
      case 'moderate':
        return 'yellow';
      case 'mild':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Helper function to get medication details
  const getMedicationDetails = (medicationId) => {
    if (!medicationId || medications.length === 0) return null;
    return medications.find(med => med.id === medicationId);
  };

  try {
    const SeverityIcon = getSeverityIcon(allergy.severity);
    const medication = getMedicationDetails(allergy.medication_id);

    // Generate badges based on allergy properties
    const badges = [];
    
    if (allergy.severity) {
      badges.push({ 
        label: allergy.severity, 
        color: getSeverityColor(allergy.severity)
      });
    }

    // Add tags as badges
    if (allergy.tags && allergy.tags.length > 0) {
      badges.push({
        label: `🏷️ ${allergy.tags[0]}${allergy.tags.length > 1 ? ` +${allergy.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('allergies.reaction.label'),
        value: allergy.reaction,
        render: (value) => value || tCommon('labels.unknown', 'Not specified')
      },
      {
        label: t('allergies.onsetDate.label'),
        value: allergy.onset_date,
        render: (value) => value ? formatLongDate(value) : tCommon('labels.unknown', 'Not specified')
      }
    ].filter(field => field.value); // Only show fields with values

    // Custom title with severity icon
    const titleContent = (
      <Group gap="xs" align="center">
        {React.createElement(SeverityIcon, {
          size: 20,
          color: `var(--mantine-color-${getSeverityColor(allergy.severity)}-6)`,
        })}
        <Text fw={600} size="lg">
          {allergy.allergen}
        </Text>
      </Group>
    );

    // Custom content for medication linking
    const customContent = medication ? (
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          {t('allergies.relatedMedication.label')}:
        </Text>
        <Text
          size="sm"
          fw={500}
          c="blue"
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToEntity('medication', medication.id, navigate)}
          title={t('allergies.viewMedication', 'View medication details')}
        >
          {medication.medication_name}
        </Text>
      </Group>
    ) : null;

    return (
      <BaseMedicalCard
        title={titleContent}
        subtitle={t('allergies.cardSubtitle', 'Medical Allergy')}
        status={allergy.status}
        badges={badges}
        fields={fields}
        notes={allergy.notes}
        entityType="allergy"
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(allergy)}
        onEdit={() => onEdit(allergy)}
        onDelete={() => onDelete(allergy.id)}
        onError={handleError}
      >
        {customContent}
      </BaseMedicalCard>
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default AllergyCard;