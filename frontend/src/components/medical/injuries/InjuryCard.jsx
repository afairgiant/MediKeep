import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconExclamationCircle,
  IconAlertCircle,
  IconShield,
  IconBandage,
} from '@tabler/icons-react';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';

const InjuryCard = ({
  injury,
  onEdit,
  onDelete,
  onView,
  practitioners = [],
  injuryTypes = [],
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  onError,
}) => {
  const { t } = useTranslation(['medical', 'common']);
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('injury_card_error', {
      message: 'Error in InjuryCard',
      injuryId: injury?.id,
      error: error.message,
      component: 'InjuryCard',
    });

    if (onError) {
      onError(error);
    }
  };

  // Helper function to get severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return IconExclamationCircle;
      case 'severe':
        return IconAlertTriangle;
      case 'moderate':
        return IconAlertCircle;
      case 'mild':
        return IconShield;
      default:
        return IconBandage;
    }
  };

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return 'red';
      case 'severe':
        return 'orange';
      case 'moderate':
        return 'yellow';
      case 'mild':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'red';
      case 'healing':
        return 'yellow';
      case 'resolved':
        return 'green';
      case 'chronic':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Helper function to get practitioner details
  const getPractitionerDetails = (practitionerId) => {
    if (!practitionerId || practitioners.length === 0) return null;
    return practitioners.find((prac) => prac.id === practitionerId);
  };

  // Helper function to get injury type details
  const getInjuryTypeDetails = (typeId) => {
    if (!typeId || injuryTypes.length === 0) return null;
    return injuryTypes.find((type) => type.id === typeId);
  };

  // Format laterality display
  const formatLaterality = (laterality) => {
    if (!laterality) return null;
    const lateralityMap = {
      left: 'Left',
      right: 'Right',
      bilateral: 'Both Sides',
      not_applicable: 'N/A',
    };
    return lateralityMap[laterality] || laterality;
  };

  try {
    const SeverityIcon = getSeverityIcon(injury.severity);
    const practitioner = getPractitionerDetails(injury.practitioner_id);
    const injuryType = getInjuryTypeDetails(injury.injury_type_id);

    // Generate badges based on injury properties
    const badges = [];

    if (injury.severity) {
      badges.push({
        label: injury.severity,
        color: getSeverityColor(injury.severity),
      });
    }

    if (injury.laterality && injury.laterality !== 'not_applicable') {
      badges.push({
        label: formatLaterality(injury.laterality),
        color: 'blue',
        variant: 'outline',
      });
    }

    // Add tags as badges
    if (injury.tags && injury.tags.length > 0) {
      badges.push({
        label: `${injury.tags[0]}${injury.tags.length > 1 ? ` +${injury.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline',
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: t('injuries.bodyPart.label', 'Body Part'),
        value: injury.body_part,
        render: (value) => value || t('common:labels.unknown', 'Not specified'),
      },
      {
        label: t('injuries.dateOfInjury.label', 'Date of Injury'),
        value: injury.date_of_injury,
        render: (value) =>
          value ? formatLongDate(value) : t('common:labels.unknown', 'Not specified'),
      },
    ].filter((field) => field.value); // Only show fields with values

    // Custom title with injury type and severity icon
    const titleContent = (
      <Group gap="xs" align="center">
        {React.createElement(SeverityIcon, {
          size: 20,
          color: `var(--mantine-color-${getSeverityColor(injury.severity)}-6)`,
        })}
        <Text fw={600} size="lg">
          {injury.injury_name}
        </Text>
        {injuryType && (
          <Badge size="xs" variant="light" color="gray">
            {injuryType.name}
          </Badge>
        )}
      </Group>
    );

    // Custom content for practitioner linking
    const customContent = practitioner ? (
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          {t('injuries.practitioner.label', 'Treating Practitioner')}:
        </Text>
        <Text
          size="sm"
          fw={500}
          c="blue"
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToEntity('practitioner', practitioner.id, navigate)}
          title={t('injuries.viewPractitioner', 'View practitioner details')}
        >
          {practitioner.name}
        </Text>
      </Group>
    ) : null;

    return (
      <BaseMedicalCard
        title={titleContent}
        subtitle={t('injuries.cardSubtitle', 'Physical Injury')}
        status={injury.status}
        statusColor={getStatusColor(injury.status)}
        badges={badges}
        fields={fields}
        notes={injury.notes}
        entityType="injury"
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(injury)}
        onEdit={() => onEdit(injury)}
        onDelete={() => onDelete(injury.id)}
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

export default InjuryCard;
