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
import { navigateToEntity } from '../../../utils/linkNavigation';
import { createCardClickHandler } from '../../../utils/helpers';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import { useTagColors } from '../../../hooks/useTagColors';
import { MEDICATION_TYPES } from '../../../constants/medicationTypes';
import '../../../styles/shared/MedicalPageShared.css';

const MedicationCard = ({
  medication,
  onView,
  onEdit,
  onDelete,
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  onError,
}) => {
  const { t } = useTranslation(['medical', 'common']);
  const { formatLongDate } = useDateFormat();
  const { getTagColor } = useTagColors();

  const getMedicationPurpose = (medication) => {
    const indication = medication.indication?.trim();
    return indication || t('common:labels.notSpecified');
  };

  const getMedicationTypeLabel = (type) => {
    const typeKey = `medications.types.${type}`;
    switch(type) {
      case MEDICATION_TYPES.PRESCRIPTION:
        return t('common:' + typeKey, 'Prescription');
      case MEDICATION_TYPES.OTC:
        return t('common:' + typeKey, 'Over-the-Counter');
      case MEDICATION_TYPES.SUPPLEMENT:
        return t('common:' + typeKey, 'Supplement/Vitamin');
      case MEDICATION_TYPES.HERBAL:
        return t('common:' + typeKey, 'Herbal/Natural');
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
      className="clickable-card"
      onClick={createCardClickHandler(onView, medication)}
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
            <Group gap="xs">
              {medication.tags && medication.tags.length > 0 && medication.tags.slice(0, 2).map((tag) => (
                <ClickableTagBadge
                  key={tag}
                  tag={tag}
                  color={getTagColor(tag)}
                  size="sm"
                  compact
                />
              ))}
              {medication.tags && medication.tags.length > 2 && (
                <Text size="xs" c="dimmed">+{medication.tags.length - 2}</Text>
              )}
              <FileCountBadge
                count={fileCount}
                entityType="medication"
                variant="badge"
                size="sm"
                loading={fileCountLoading}
                onClick={() => onView(medication)}
              />
            </Group>
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
                title={t('common:labels.viewPractitionerDetails')}
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
                title={t('common:labels.viewPharmacyDetails', 'View pharmacy details')}
              >
                {medication.pharmacy.name}
              </Text>
            </Group>
          )}
          {medication.effective_period_start && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('common:labels.startDate', 'Start Date')}:
              </Text>
              <Text size="sm">
                {formatLongDate(medication.effective_period_start)}
              </Text>
            </Group>
          )}
          {medication.effective_period_end && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('common:labels.endDate', 'End Date')}:
              </Text>
              <Text size="sm">
                {formatLongDate(medication.effective_period_end)}
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
            {t('common:buttons.view')}
          </Button>
          <Button
            variant="filled"
            size="xs"
            onClick={() => onEdit(medication)}
          >
            {t('common:buttons.edit')}
          </Button>
          <Button
            variant="filled"
            color="red"
            size="xs"
            onClick={() => onDelete(medication.id)}
          >
            {t('common:buttons.delete')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default MedicationCard;