import React from 'react';
import { Badge, Text, Group, Anchor } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import logger from '../../../services/logger';
import { useTranslation } from 'react-i18next';

const PharmacyCard = ({
  pharmacy,
  onEdit,
  onDelete,
  onView,
  navigate,
  onError,
}) => {
  const { t } = useTranslation(['common', 'shared']);

  const handleError = error => {
    logger.error('pharmacy_card_error', {
      message: 'Error in PharmacyCard',
      pharmacyId: pharmacy?.id,
      error: error.message,
      component: 'PharmacyCard',
    });

    if (onError) {
      onError(error);
    }
  };

  try {
    // Generate badges based on pharmacy properties
    const badges = [];
    if (pharmacy.brand) {
      badges.push({ label: pharmacy.brand, color: 'blue' });
    }

    // Generate dynamic fields for pharmacy information
    const fields = [
      {
        label: t('shared:labels.address'),
        value: pharmacy.street_address,
      },
      {
        label: t('shared:labels.city'),
        value: pharmacy.city,
      },
      pharmacy.state && {
        label: t('shared:labels.stateProvince'),
        value: pharmacy.state,
      },
      pharmacy.zip_code && {
        label: t('shared:labels.postalCode'),
        value: pharmacy.zip_code,
      },
      pharmacy.country && {
        label: t('shared:labels.country'),
        value: pharmacy.country,
      },
      {
        label: t('pharmacies.card.storeNumber'),
        value: pharmacy.store_number,
      },
      {
        label: t('shared:labels.phone'),
        value: pharmacy.phone_number,
      },
      {
        label: t('shared:labels.website'),
        value: pharmacy.website,
        render: value => {
          if (!value)
            return (
              <Text size="sm" c="dimmed">
                {t('shared:labels.notSpecified')}
              </Text>
            );
          return (
            <Anchor
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              c="blue"
            >
              {value}
            </Anchor>
          );
        },
      },
      pharmacy.specialty_services && {
        label: t('shared:labels.specialties'),
        value: pharmacy.specialty_services,
      },
    ].filter(Boolean);

    return (
      <BaseMedicalCard
        title={pharmacy.name}
        badges={badges}
        fields={fields}
        onView={() => onView(pharmacy)}
        onEdit={() => onEdit(pharmacy)}
        onDelete={() => onDelete(pharmacy)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default PharmacyCard;
