import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import {
  IconAlertTriangle,
  IconExclamationCircle,
  IconAlertCircle,
  IconShield,
  IconShieldCheck,
} from '@tabler/icons-react';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const AllergyCard = ({
  allergy,
  onEdit,
  onDelete,
  onView,
  medications = [],
  navigate,
  onError
}) => {
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

    // Generate dynamic fields
    const fields = [
      {
        label: 'Reaction',
        value: allergy.reaction,
        render: (value) => value || 'Not specified'
      },
      {
        label: 'Onset Date',
        value: allergy.onset_date,
        render: (value) => value ? formatDate(value) : 'Not specified'
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
          Related Medication:
        </Text>
        <Text
          size="sm"
          fw={500}
          c="blue"
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToEntity('medication', medication.id, navigate)}
          title="View medication details"
        >
          {medication.medication_name}
        </Text>
      </Group>
    ) : null;

    return (
      <BaseMedicalCard
        title={titleContent}
        subtitle="Medical Allergy"
        status={allergy.status}
        badges={badges}
        fields={fields}
        notes={allergy.notes}
        onView={() => onView(allergy)}
        onEdit={() => onEdit(allergy)}
        onDelete={() => onDelete(allergy.id)}
        onError={handleError}
        entityType="allergy"
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