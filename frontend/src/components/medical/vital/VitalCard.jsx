import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { formatMeasurement, convertForDisplay } from '../../../utils/unitConversion';

const VitalCard = ({
  vital,
  onEdit,
  onDelete,
  onView,
  practitioners = [],
  navigate,
  onError
}) => {
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();
  const { formatLongDate } = useDateFormat();

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
      badges.push({ label: t('vitals.stats.bloodPressure', 'Blood Pressure'), color: 'red' });
    }
    if (vital.heart_rate) {
      badges.push({ label: t('vitals.stats.heartRate', 'Heart Rate'), color: 'blue' });
    }
    if (vital.temperature) {
      badges.push({ label: t('vitals.stats.temperature', 'Temperature'), color: 'green' });
    }
    if (vital.weight) {
      badges.push({ label: t('vitals.stats.weight', 'Weight'), color: 'violet' });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('vitals.card.recordedDate', 'Recorded Date'),
        value: vital.recorded_date,
        render: (value) => value ? formatLongDate(value) : t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('vitals.stats.bloodPressure', 'Blood Pressure'),
        value: vital.systolic_bp && vital.diastolic_bp
          ? `${vital.systolic_bp}/${vital.diastolic_bp} ${t('vitals.units.mmHg', 'mmHg')}`
          : null,
        render: (value) => value || t('vitals.card.notRecorded', 'Not recorded')
      },
      {
        label: t('vitals.stats.heartRate', 'Heart Rate'),
        value: vital.heart_rate,
        render: (value) => value ? `${value} ${t('vitals.units.bpm', 'BPM')}` : t('vitals.card.notRecorded', 'Not recorded')
      },
      {
        label: t('vitals.stats.temperature', 'Temperature'),
        value: vital.temperature,
        render: (value) => value ? formatMeasurement(
          convertForDisplay(value, 'temperature', unitSystem),
          'temperature',
          unitSystem
        ) : t('vitals.card.notRecorded', 'Not recorded')
      },
      {
        label: t('vitals.stats.weight', 'Weight'),
        value: vital.weight,
        render: (value) => value ? formatMeasurement(
          convertForDisplay(value, 'weight', unitSystem),
          'weight',
          unitSystem
        ) : t('vitals.card.notRecorded', 'Not recorded')
      },
      {
        label: t('vitals.card.oxygenSaturation', 'Oxygen Saturation'),
        value: vital.oxygen_saturation,
        render: (value) => value ? `${value}%` : t('vitals.card.notRecorded', 'Not recorded')
      }
    ].filter(field => field.value !== null && field.value !== undefined);

    // Add practitioner field if available
    if (vital.practitioner_id) {
      const practitioner = practitioners.find(p => p.id === vital.practitioner_id);
      fields.push({
        label: t('vitals.card.recordedBy', 'Recorded By'),
        value: vital.practitioner_id,
        render: (value) => {
          if (!value) return t('labels.notSpecified', 'Not specified');
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
      ? `${t('vitals.title', 'Vitals')} - ${formatLongDate(vital.recorded_date)}`
      : t('vitals.card.title', 'Vital Signs Record');

    return (
      <BaseMedicalCard
        title={title}
        subtitle={vital.location ? `${t('vitals.card.location', 'Location')}: ${vital.location}` : null}
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