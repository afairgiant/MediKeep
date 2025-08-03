import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const VitalCard = ({
  vital,
  onEdit,
  onDelete,
  onView,
  practitioners = [],
  navigate,
  onError
}) => {
  const handleError = (error) => {
    logger.error('vital_card_error', {
      message: 'Error in VitalCard',
      vitalId: vital?.id,
      error: error.message,
      component: 'VitalCard',
    });

    if (onError) {
      onError(error);
    }
  };

  try {
    // Generate badges based on vital properties
    const badges = [];
    
    // Add measurement type badges
    if (vital.systolic_bp && vital.diastolic_bp) {
      badges.push({ label: 'Blood Pressure', color: 'red' });
    }
    if (vital.heart_rate) {
      badges.push({ label: 'Heart Rate', color: 'blue' });
    }
    if (vital.temperature) {
      badges.push({ label: 'Temperature', color: 'green' });
    }
    if (vital.weight) {
      badges.push({ label: 'Weight', color: 'violet' });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: 'Recorded Date',
        value: vital.recorded_date,
        render: (value) => value ? formatDate(value) : 'Not specified'
      },
      {
        label: 'Blood Pressure',
        value: vital.systolic_bp && vital.diastolic_bp 
          ? `${vital.systolic_bp}/${vital.diastolic_bp} mmHg`
          : null,
        render: (value) => value || 'Not recorded'
      },
      {
        label: 'Heart Rate',
        value: vital.heart_rate,
        render: (value) => value ? `${value} BPM` : 'Not recorded'
      },
      {
        label: 'Temperature',
        value: vital.temperature,
        render: (value) => value ? `${value}°F` : 'Not recorded'
      },
      {
        label: 'Weight',
        value: vital.weight,
        render: (value) => value ? `${value} lbs` : 'Not recorded'
      },
      {
        label: 'Oxygen Saturation',
        value: vital.oxygen_saturation,
        render: (value) => value ? `${value}%` : 'Not recorded'
      }
    ].filter(field => field.value !== null && field.value !== undefined);

    // Add practitioner field if available
    if (vital.practitioner_id) {
      const practitioner = practitioners.find(p => p.id === vital.practitioner_id);
      fields.push({
        label: 'Recorded By',
        value: vital.practitioner_id,
        render: (value) => {
          if (!value) return 'Not specified';
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
            >
              {practitioner?.name || `ID: ${value}`}
            </Text>
          );
        },
      });
    }

    // Generate a display title
    const title = vital.recorded_date 
      ? `Vitals - ${formatDate(vital.recorded_date)}`
      : 'Vital Signs Record';

    return (
      <BaseMedicalCard
        title={title}
        subtitle={vital.location ? `Location: ${vital.location}` : null}
        badges={badges}
        fields={fields}
        notes={vital.notes}
        onView={() => onView(vital)}
        onEdit={() => onEdit(vital)}
        onDelete={() => onDelete(vital)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default VitalCard;