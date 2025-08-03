import React from 'react';
import { Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import StatusBadge from '../StatusBadge';
import { formatDate } from '../../../utils/helpers';
import logger from '../../../services/logger';

const TreatmentCard = ({
  treatment,
  onEdit,
  onDelete,
  onView,
  conditions = [],
  onConditionClick,
  navigate,
  onError
}) => {
  const handleError = (error) => {
    logger.error('treatment_card_error', {
      message: 'Error in TreatmentCard',
      treatmentId: treatment?.id,
      error: error.message,
      component: 'TreatmentCard',
    });

    if (onError) {
      onError(error);
    }
  };

  // Helper function to get condition name from ID
  const getConditionName = (conditionId) => {
    if (!conditionId || !conditions || conditions.length === 0) {
      return null;
    }
    const condition = conditions.find(c => c.id === conditionId);
    return condition ? condition.diagnosis || condition.name : null;
  };

  const handleConditionClick = (conditionId) => {
    if (onConditionClick) {
      onConditionClick(conditionId);
    }
  };

  try {
    // Generate badges based on treatment properties
    const badges = [];
    
    if (treatment.treatment_type) {
      badges.push({ 
        label: treatment.treatment_type, 
        color: 'blue' 
      });
    }

    if (treatment.condition_id) {
      badges.push({
        label: treatment.condition?.diagnosis ||
                getConditionName(treatment.condition_id) ||
                `Condition #${treatment.condition_id}`,
        color: 'teal',
        clickable: true,
        onClick: () => handleConditionClick(treatment.condition_id)
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: 'Start Date',
        value: treatment.start_date,
        render: (value) => value ? formatDate(value) : 'Not specified'
      },
      {
        label: 'End Date',
        value: treatment.end_date,
        render: (value) => value ? formatDate(value) : 'Not specified'
      },
      {
        label: 'Amount',
        value: treatment.dosage,
        render: (value) => value || 'Not specified'
      },
      {
        label: 'Frequency',
        value: treatment.frequency,
        render: (value) => value || 'Not specified'
      },
      {
        label: 'Description',
        value: treatment.description,
        render: (value) => value || 'Not specified',
        style: { flex: 1 }
      }
    ].filter(field => field.value); // Only show fields with values

    // Custom status badge in title area
    const titleContent = (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
        <Text fw={600} size="lg" style={{ flex: 1 }}>
          {treatment.treatment_name}
        </Text>
        <StatusBadge status={treatment.status} />
      </div>
    );

    // Custom content for clickable condition link
    const customContent = treatment.condition_id ? (
      <Group gap="xs" style={{ marginBottom: '8px' }}>
        <Text size="sm" c="dimmed">
          Related Condition:
        </Text>
        <Text
          size="sm"
          fw={500}
          c="blue"
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => handleConditionClick(treatment.condition_id)}
          title="View condition details"
        >
          {treatment.condition?.diagnosis ||
           getConditionName(treatment.condition_id) ||
           `Condition #${treatment.condition_id}`}
        </Text>
      </Group>
    ) : null;

    return (
      <BaseMedicalCard
        title={titleContent}
        subtitle="Medical Treatment"
        badges={badges.filter(badge => !badge.clickable)} // Only include non-clickable badges
        fields={fields}
        notes={treatment.notes}
        onView={() => onView(treatment)}
        onEdit={() => onEdit(treatment)}
        onDelete={() => onDelete(treatment.id)}
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

export default TreatmentCard;