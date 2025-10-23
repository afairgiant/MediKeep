import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ImmunizationCard = ({
  immunization,
  onEdit,
  onDelete,
  onView,
  practitioners = [],
  navigate,
  onError
}) => {
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
        label: `Dose ${immunization.dose_number}`, 
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
        label: 'Date Administered',
        value: immunization.date_administered,
        render: (value) => value ? formatDate(value) : 'Not specified'
      },
      immunization.lot_number && {
        label: 'Lot Number',
        value: immunization.lot_number,
        render: (value) => value
      },
      immunization.ndc_number && {
        label: 'NDC Number',
        value: immunization.ndc_number,
        render: (value) => value
      },
      immunization.site && {
        label: 'Injection Site',
        value: immunization.site,
        render: (value) => value
      },
      immunization.route && {
        label: 'Route',
        value: immunization.route,
        render: (value) => value
      },
      immunization.location && {
        label: 'Location',
        value: immunization.location,
        render: (value) => value
      },
      immunization.expiration_date && {
        label: 'Expiration Date',
        value: immunization.expiration_date,
        render: (value) => formatDate(value)
      },
      immunization.practitioner_id && {
        label: 'Practitioner',
        value: immunization.practitioner_id,
        render: (value) => {
          if (!value) return 'Not specified';
          const practitioner = practitioners.find(p => p.id === value);
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