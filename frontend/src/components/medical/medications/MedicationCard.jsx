import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Divider,
} from '@mantine/core';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import StatusBadge from '../StatusBadge';
import { MEDICATION_TYPES } from '../../../constants/medicationTypes';

const MedicationCard = ({
  medication,
  onView,
  onEdit,
  onDelete,
  navigate,
  onError,
}) => {
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');

  const getMedicationPurpose = (medication) => {
    const indication = medication.indication?.trim();
    return indication || tCommon('labels.notSpecified');
  };

  const getMedicationTypeLabel = (type) => {
    const typeKey = `medications.types.${type}`;
    switch(type) {
      case MEDICATION_TYPES.PRESCRIPTION:
        return tCommon(typeKey, 'Prescription');
      case MEDICATION_TYPES.OTC:
        return tCommon(typeKey, 'Over-the-Counter');
      case MEDICATION_TYPES.SUPPLEMENT:
        return tCommon(typeKey, 'Supplement/Vitamin');
      case MEDICATION_TYPES.HERBAL:
        return tCommon(typeKey, 'Herbal/Natural');
      default:
        return type;
    }
  };

  // Check if medication is inactive/stopped/finished/completed/on-hold
  const isInactive = ['inactive', 'stopped', 'completed', 'cancelled', 'on-hold'].includes(
    medication.status?.toLowerCase()
  );

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isInactive
          ? '4px solid var(--mantine-color-red-6)'
          : '4px solid var(--mantine-color-green-6)'
      }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {medication.medication_name}
            </Text>
            <Group gap="xs">
              {medication.dosage && (
                <Badge variant="light" color="blue" size="md">
                  {medication.dosage}
                </Badge>
              )}
              {medication.medication_type && medication.medication_type !== 'prescription' && (
                <Badge variant="light" color="grape" size="sm">
                  {getMedicationTypeLabel(medication.medication_type)}
                </Badge>
              )}
            </Group>
            {medication.tags && medication.tags.length > 0 && (
              <Group gap="xs">
                <Badge
                  variant="outline"
                  color="gray"
                  size="sm"
                  style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  🏷️ {medication.tags[0]}{medication.tags.length > 1 ? ` +${medication.tags.length - 1}` : ''}
                </Badge>
              </Group>
            )}
          </Stack>
          <StatusBadge status={medication.status} />
        </Group>

        <Stack gap="xs">
          {medication.frequency && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('medications.frequency.label')}:
              </Text>
              <Text size="sm">{medication.frequency}</Text>
            </Group>
          )}
          {medication.route && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('medications.route.label')}:
              </Text>
              <Badge variant="light" color="cyan" size="sm">
                {medication.route}
              </Badge>
            </Group>
          )}
          <Group align="flex-start">
            <Text size="sm" fw={500} c="dimmed" w={120}>
              {t('medications.indication.label')}:
            </Text>
            <Text size="sm" style={{ flex: 1 }}>
              {getMedicationPurpose(medication)}
            </Text>
          </Group>
          {medication.practitioner && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('medications.prescribingProvider.label')}:
              </Text>
              <Text
                size="sm"
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigateToEntity('practitioner', medication.practitioner.id, navigate)}
                title={tCommon('labels.viewPractitionerDetails')}
              >
                {medication.practitioner.name}
              </Text>
            </Group>
          )}
          {medication.pharmacy && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('medications.pharmacy.label')}:
              </Text>
              <Text
                size="sm"
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigateToEntity('pharmacy', medication.pharmacy.id, navigate)}
                title={tCommon('labels.viewPharmacyDetails', 'View pharmacy details')}
              >
                {medication.pharmacy.name}
              </Text>
            </Group>
          )}
          {medication.effective_period_start && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {tCommon('labels.startDate', 'Start Date')}:
              </Text>
              <Text size="sm">
                {formatDate(medication.effective_period_start)}
              </Text>
            </Group>
          )}
          {medication.effective_period_end && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {tCommon('labels.endDate', 'End Date')}:
              </Text>
              <Text size="sm">
                {formatDate(medication.effective_period_end)}
              </Text>
            </Group>
          )}
        </Stack>
      </Stack>

      <Stack gap={0} mt="auto">
        <Divider />
        <Group justify="flex-end" gap="xs" pt="sm">
          <Button
            variant="filled"
            size="xs"
            onClick={() => onView(medication)}
          >
            {tCommon('buttons.view')}
          </Button>
          <Button
            variant="filled"
            size="xs"
            onClick={() => onEdit(medication)}
          >
            {tCommon('buttons.edit')}
          </Button>
          <Button
            variant="filled"
            color="red"
            size="xs"
            onClick={() => onDelete(medication.id)}
          >
            {tCommon('buttons.delete')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default MedicationCard;