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
  onError
}) => {
  const { t } = useTranslation('common');

  const handleError = (error) => {
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
        label: t('pharmacies.card.address'),
        value: pharmacy.street_address,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.city'),
        value: pharmacy.city,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.stateProvince'),
        value: pharmacy.state,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.postalCode'),
        value: pharmacy.zip_code,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.country'),
        value: pharmacy.country,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.storeNumber'),
        value: pharmacy.store_number,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.phone'),
        value: pharmacy.phone_number,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      },
      {
        label: t('pharmacies.card.website'),
        value: pharmacy.website,
        render: (value) => {
          if (!value) return <Text size="sm" c="dimmed">{t('labels.notSpecified')}</Text>;
          return (
            <Anchor
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              c="blue"
            >
              {t('pharmacies.card.visitWebsite')}
            </Anchor>
          );
        }
      },
      {
        label: t('pharmacies.card.specialtyServices'),
        value: pharmacy.specialty_services,
        render: (value) => (
          <Text size="sm" fw={500}>
            {value || t('labels.notSpecified')}
          </Text>
        )
      }
    ];

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