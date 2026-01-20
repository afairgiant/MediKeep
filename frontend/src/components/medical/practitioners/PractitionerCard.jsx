import React from 'react';
import { Badge, Text, Group, Anchor } from '@mantine/core';
import { IconStethoscope, IconUser, IconStar } from '@tabler/icons-react';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import logger from '../../../services/logger';
import { useTranslation } from 'react-i18next';

const PractitionerCard = ({
  practitioner,
  onEdit,
  onDelete,
  onView,
  navigate,
  onError
}) => {
  const { t } = useTranslation('common');

  const handleError = (error) => {
    logger.error('practitioner_card_error', {
      message: 'Error in PractitionerCard',
      practitionerId: practitioner?.id,
      error: error.message,
      component: 'PractitionerCard',
    });

    if (onError) {
      onError(error);
    }
  };

  const getSpecialtyColor = (specialty) => {
    const specialtyColors = {
      Cardiology: 'red',
      'Emergency Medicine': 'red',
      'Family Medicine': 'green',
      'Internal Medicine': 'green',
      Pediatrics: 'blue',
      Surgery: 'orange',
      'General Surgery': 'orange',
      Psychiatry: 'purple',
      Neurology: 'yellow',
    };

    return specialtyColors[specialty] || 'gray';
  };

  const getSpecialtyIcon = (specialty) => {
    const specialtyIcons = {
      Cardiology: IconStethoscope,
      'Emergency Medicine': IconStethoscope,
      'Family Medicine': IconUser,
      'Internal Medicine': IconUser,
      Pediatrics: IconUser,
      Surgery: IconStethoscope,
      'General Surgery': IconStethoscope,
      Psychiatry: IconUser,
      Neurology: IconStethoscope,
    };

    return specialtyIcons[specialty] || IconUser;
  };

  try {
    // Generate badges based on practitioner properties
    const badges = [];
    if (practitioner.specialty) {
      badges.push({ 
        label: practitioner.specialty, 
        color: getSpecialtyColor(practitioner.specialty) 
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('practitioners.card.practice', 'Practice'),
        value: practitioner.practice,
        render: (value) => value || t('common.labels.notSpecified', 'Not specified')
      },
      {
        label: t('practitioners.card.phone', 'Phone'),
        value: practitioner.phone_number,
        render: (value) => value ? formatPhoneNumber(value) : t('common.labels.notSpecified', 'Not specified')
      },
      {
        label: t('practitioners.card.email', 'Email'),
        value: practitioner.email,
        render: (value) => value ? (
          <Anchor
            href={`mailto:${value}`}
            size="sm"
            c="blue"
          >
            {value}
          </Anchor>
        ) : t('common.labels.notSpecified', 'Not specified')
      },
      {
        label: t('practitioners.card.website', 'Website'),
        value: practitioner.website,
        render: (value) => value ? (
          <Anchor
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            c="blue"
          >
            {t('practitioners.card.visitWebsite', 'Visit Website')}
          </Anchor>
        ) : t('common.labels.notSpecified', 'Not specified')
      },
      {
        label: t('practitioners.card.rating', 'Rating'),
        value: practitioner.rating,
        render: (value) => {
          if (value !== null && value !== undefined) {
            return (
              <Group gap="xs">
                <IconStar
                  size={16}
                  color="var(--mantine-color-yellow-6)"
                  fill="var(--mantine-color-yellow-6)"
                />
                <Text size="sm" fw={500}>
                  {value}/5
                </Text>
              </Group>
            );
          }
          return t('common.labels.notSpecified', 'Not specified');
        }
      }
    ];

    const SpecialtyIcon = getSpecialtyIcon(practitioner.specialty);

    return (
      <BaseMedicalCard
        title={
          <Group gap="xs">
            <SpecialtyIcon
              size={20}
              color={`var(--mantine-color-${getSpecialtyColor(practitioner.specialty)}-6)`}
            />
            {practitioner.name}
          </Group>
        }
        subtitle={t('practitioners.card.subtitle', 'Healthcare Practitioner')}
        badges={badges}
        fields={fields}
        onView={() => onView(practitioner)}
        onEdit={() => onEdit(practitioner)}
        onDelete={() => onDelete(practitioner.id)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default PractitionerCard;