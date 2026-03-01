import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ConditionCard = ({
  condition,
  onEdit,
  onDelete,
  onView,
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  onError
}) => {
  const { t } = useTranslation(['medical', 'common']);
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('condition_card_error', {
      message: 'Error in ConditionCard',
      conditionId: condition?.id,
      error: error.message,
      component: 'ConditionCard',
    });

    if (onError) {
      onError(error);
    }
  };

  // Helper function to get condition icon based on diagnosis
  const getConditionIcon = (diagnosis) => {
    const diagnosisLower = diagnosis.toLowerCase();
    if (diagnosisLower.includes('diabetes')) return '💉';
    if (diagnosisLower.includes('hypertension') || diagnosisLower.includes('blood pressure')) return '❤️';
    if (diagnosisLower.includes('asthma') || diagnosisLower.includes('respiratory')) return '🫁';
    if (diagnosisLower.includes('arthritis') || diagnosisLower.includes('joint')) return '🦴';
    if (diagnosisLower.includes('heart') || diagnosisLower.includes('cardiac')) return '❤️';
    if (diagnosisLower.includes('cancer') || diagnosisLower.includes('tumor')) return '🎗️';
    if (diagnosisLower.includes('migraine') || diagnosisLower.includes('headache')) return '🧠';
    if (diagnosisLower.includes('allergy') || diagnosisLower.includes('allergic')) return '⚠️';
    return '🏥'; // Default medical icon
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'severe': return 'orange';
      case 'moderate': return 'yellow';
      case 'mild': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'resolved': return 'blue';
      case 'chronic': return 'orange';
      default: return 'gray';
    }
  };

  // Helper function to calculate condition duration
  const getConditionDuration = (onsetDate, endDate, status) => {
    if (!onsetDate) return null;

    const onset = new Date(onsetDate);
    const endPoint = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(endPoint - onset);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let duration;
    if (diffDays < 30) {
      const unit = diffDays === 1 ? t('common:time.day') : t('common:time.days');
      duration = `${diffDays} ${unit}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const unit = months === 1 ? t('common:time.month') : t('common:time.months');
      duration = `${months} ${unit}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const unit = years === 1 ? t('common:time.year') : t('common:time.years');
      duration = `${years} ${unit}`;
    }

    // Add appropriate suffix based on condition status
    if (endDate || status === 'resolved' || status === 'inactive') {
      return `${duration} (${t('common:time.ended')})`;
    } else {
      return `${duration} (${t('common:time.ongoing')})`;
    }
  };

  try {
    // Generate badges based on condition properties
    const badges = [];
    
    if (condition.severity) {
      badges.push({ 
        label: condition.severity, 
        color: getSeverityColor(condition.severity) 
      });
    }

    if (condition.icd10_code) {
      badges.push({ 
        label: `ICD-10: ${condition.icd10_code}`, 
        color: 'blue' 
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('common:fields.onsetDate.label'),
        value: condition.onset_date,
        render: (value) => value ? formatLongDate(value) : t('common:labels.notSpecified')
      },
      {
        label: t('common:labels.duration'),
        value: condition.onset_date,
        render: () => condition.onset_date
          ? getConditionDuration(condition.onset_date, condition.end_date, condition.status)
          : t('common:labels.notSpecified')
      },
      condition.end_date && {
        label: t('common:fields.endDate.label'),
        value: condition.end_date,
        render: (value) => formatLongDate(value)
      },
      condition.snomed_code && {
        label: t('conditions.snomedCode.label'),
        value: condition.snomed_code,
        render: (value) => value
      },
      condition.code_description && {
        label: t('conditions.codeDescription.label'),
        value: condition.code_description,
        render: (value) => value,
        align: 'flex-start',
        style: { flex: 1 }
      }
    ].filter(Boolean);

    return (
      <BaseMedicalCard
        title={condition.diagnosis}
        subtitle={getConditionIcon(condition.diagnosis)}
        status={condition.status}
        badges={badges}
        tags={condition.tags || []}
        fields={fields}
        notes={condition.notes}
        entityType="condition"
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(condition)}
        onEdit={() => onEdit(condition)}
        onDelete={() => onDelete(condition.id)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default ConditionCard;