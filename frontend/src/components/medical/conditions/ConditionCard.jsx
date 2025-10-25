import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';
import {
  IconShieldCheck,
  IconHeart,
  IconBrain,
  IconLungs,
  IconBone,
  IconDroplet,
  IconAward,
  IconAlertTriangle,
} from '@tabler/icons-react';

const ConditionCard = ({
  condition,
  onEdit,
  onDelete,
  onView,
  navigate,
  onError
}) => {
  const { t } = useTranslation('common');

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
      duration = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      duration = `${months} month${months === 1 ? '' : 's'}`;
    } else {
      const years = Math.floor(diffDays / 365);
      duration = `${years} year${years === 1 ? '' : 's'}`;
    }

    // Add appropriate suffix based on condition status
    if (endDate || status === 'resolved' || status === 'inactive') {
      return t('conditions.card.durationEnded', '{{duration}} (ended)', { duration });
    } else {
      return t('conditions.card.durationOngoing', '{{duration}} (ongoing)', { duration });
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

    // Add tags as badges
    if (condition.tags && condition.tags.length > 0) {
      badges.push({
        label: `🏷️ ${condition.tags[0]}${condition.tags.length > 1 ? ` +${condition.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('conditions.card.onsetDate', 'Onset Date'),
        value: condition.onset_date,
        render: (value) => value ? formatDate(value) : t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('conditions.card.duration', 'Duration'),
        value: condition.onset_date,
        render: () => condition.onset_date
          ? getConditionDuration(condition.onset_date, condition.end_date, condition.status)
          : t('labels.notSpecified', 'Not specified')
      },
      condition.end_date && {
        label: t('conditions.card.endDate', 'End Date'),
        value: condition.end_date,
        render: (value) => formatDate(value)
      },
      condition.snomed_code && {
        label: t('conditions.card.snomedCode', 'SNOMED Code'),
        value: condition.snomed_code,
        render: (value) => value
      },
      condition.code_description && {
        label: t('conditions.card.codeDescription', 'Code Description'),
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
        fields={fields}
        notes={condition.notes}
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