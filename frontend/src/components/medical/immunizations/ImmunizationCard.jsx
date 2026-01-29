import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ImmunizationCard = ({
  immunization,
  onEdit,
  onDelete,
  onView,
  practitioners = [],
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  onError
}) => {
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('immunization_card_error', {
      message: 'Error in ImmunizationCard',
      immunizationId: immunization?.id,
      error: error.message,
      component: 'ImmunizationCard',
    });

    if (onError) {
      onError(error);
    }
  };

  // Helper function to get immunization icon based on vaccine name
  const getImmunizationIcon = (vaccineName) => {
    const vaccineLower = vaccineName.toLowerCase();
    if (vaccineLower.includes('covid') || vaccineLower.includes('corona')) return '🛡️';
    if (vaccineLower.includes('flu') || vaccineLower.includes('influenza')) return '💉';
    if (vaccineLower.includes('tetanus') || vaccineLower.includes('diphtheria')) return '🛡️';
    if (vaccineLower.includes('measles') || vaccineLower.includes('mumps') || vaccineLower.includes('rubella')) return '💉';
    if (vaccineLower.includes('hepatitis')) return '💉';
    if (vaccineLower.includes('pneumonia') || vaccineLower.includes('pneumococcal')) return '💉';
    return '💉'; // Default immunization icon
  };

  // Helper function to get dose color
  const getDoseColor = (doseNumber) => {
    switch (doseNumber) {
      case 1: return 'blue';
      case 2: return 'green';
      case 3: return 'orange';
      case 4: return 'red';
      default: return 'gray';
    }
  };

  try {
    // Generate badges based on immunization properties
    const badges = [];
    
    if (immunization.dose_number) {
      badges.push({
        label: tCommon('immunizations.card.dose', 'Dose {{number}}', { number: immunization.dose_number }),
        color: getDoseColor(immunization.dose_number)
      });
    }

    if (immunization.manufacturer) {
      badges.push({ 
        label: immunization.manufacturer, 
        color: 'gray' 
      });
    }

    // Add tags as badges
    if (immunization.tags && immunization.tags.length > 0) {
      badges.push({
        label: `🏷️ ${immunization.tags[0]}${immunization.tags.length > 1 ? ` +${immunization.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('immunizations.dateAdministered.label'),
        value: immunization.date_administered,
        render: (value) => value ? formatLongDate(value) : tCommon('labels.notSpecified')
      },
      immunization.lot_number && {
        label: t('immunizations.lotNumber.label'),
        value: immunization.lot_number,
        render: (value) => value
      },
      immunization.ndc_number && {
        label: t('immunizations.ndcNumber.label'),
        value: immunization.ndc_number,
        render: (value) => value
      },
      immunization.site && {
        label: t('immunizations.site.label'),
        value: immunization.site,
        render: (value) => value
      },
      immunization.route && {
        label: t('immunizations.route.label'),
        value: immunization.route,
        render: (value) => value
      },
      immunization.location && {
        label: t('immunizations.location.label'),
        value: immunization.location,
        render: (value) => value
      },
      immunization.expiration_date && {
        label: t('immunizations.expirationDate.label'),
        value: immunization.expiration_date,
        render: (value) => formatLongDate(value)
      },
      immunization.practitioner_id && {
        label: tCommon('labels.practitioner'),
        value: immunization.practitioner_id,
        render: (value) => {
          if (!value) return tCommon('labels.notSpecified');
          const practitioner = practitioners.find(p => p.id === value);
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title={tCommon('immunizations.card.viewPractitioner', 'View practitioner details')}
            >
              {practitioner?.name || tCommon('immunizations.card.practitionerId', 'ID: {{id}}', { id: value })}
            </Text>
          );
        }
      }
    ].filter(Boolean);

    return (
      <BaseMedicalCard
        title={immunization.vaccine_name}
        subtitle={immunization.vaccine_trade_name ?
          `${getImmunizationIcon(immunization.vaccine_name)} ${immunization.vaccine_trade_name}` :
          getImmunizationIcon(immunization.vaccine_name)}
        badges={badges}
        fields={fields}
        notes={immunization.notes}
        entityType="immunization"
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(immunization)}
        onEdit={() => onEdit(immunization)}
        onDelete={() => onDelete(immunization.id)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default ImmunizationCard;