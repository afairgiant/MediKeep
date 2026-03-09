import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
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
import '../../../styles/pages/MedicationCard.css';

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

  const isInactive = ['inactive', 'stopped', 'completed', 'cancelled', 'on-hold'].includes(
    medication.status?.toLowerCase()
  );

  const getDateDisplay = () => {
    const start = medication.effective_period_start;
    const end = medication.effective_period_end;
    if (start && end) {
      return `${formatLongDate(start)} - ${formatLongDate(end)}`;
    }
    if (start) {
      return `${t('common:labels.started', 'Started')} ${formatLongDate(start)}`;
    }
    return null;
  };

  const dateDisplay = getDateDisplay();

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      p="sm"
      h="100%"
      className="clickable-card medication-card-compact"
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
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" align="center" wrap="wrap">
              <Text fw={600} size="sm" lineClamp={1}>
                {medication.medication_name}
              </Text>
              {medication.dosage && (
                <Badge variant="light" color="blue" size="xs">
                  {medication.dosage}
                </Badge>
              )}
              {medication.medication_type && medication.medication_type !== 'prescription' && (
                <Badge variant="light" color="grape" size="xs">
                  {getMedicationTypeLabel(medication.medication_type)}
                </Badge>
              )}
            </Group>
            <Group gap={4}>
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
          <StatusBadge status={medication.status} size="sm" />
        </Group>

        {/* Body detail rows - always rendered for uniform height */}
        <Stack gap={4}>
          <Group>
            <Text size="xs" fw={500} c="dimmed" w={90}>
              {t('medications.frequency.label')}:
            </Text>
            <Text size="xs">{medication.frequency || '-'}</Text>
          </Group>
          <Group>
            <Text size="xs" fw={500} c="dimmed" w={90}>
              {t('medications.route.label')}:
            </Text>
            {medication.route ? (
              <Badge variant="light" color="cyan" size="xs">
                {medication.route}
              </Badge>
            ) : (
              <Text size="xs" c="dimmed">-</Text>
            )}
          </Group>
          <Group align="flex-start">
            <Text size="xs" fw={500} c="dimmed" w={90}>
              {t('medications.indication.label')}:
            </Text>
            <Text size="xs" style={{ flex: 1 }}>
              {getMedicationPurpose(medication)}
            </Text>
          </Group>
          <Group>
            <Text size="xs" fw={500} c="dimmed" w={90}>
              {t('medications.prescribingProvider.label')}:
            </Text>
            {medication.practitioner ? (
              <Text
                size="xs"
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToEntity('practitioner', medication.practitioner.id, navigate);
                }}
                title={t('common:labels.viewPractitionerDetails')}
              >
                {medication.practitioner.name}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">-</Text>
            )}
          </Group>
          <Group>
            <Text size="xs" fw={500} c="dimmed" w={90}>
              {t('medications.pharmacy.label')}:
            </Text>
            {medication.pharmacy ? (
              <Text
                size="xs"
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToEntity('pharmacy', medication.pharmacy.id, navigate);
                }}
                title={t('common:labels.viewPharmacyDetails', 'View pharmacy details')}
              >
                {medication.pharmacy.name}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">-</Text>
            )}
          </Group>
        </Stack>
      </Stack>

      {/* Footer */}
      <Card.Section mt="auto" className="medication-card-footer">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text size="xs" c="dark" style={{ flex: 1 }} truncate>
            {dateDisplay || '\u00A0'}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Button
              variant="subtle"
              color="blue"
              size="compact-xs"
              onClick={(e) => { e.stopPropagation(); onView(medication); }}
            >
              {t('common:buttons.view')}
            </Button>
            <Button
              variant="subtle"
              color="dark"
              size="compact-xs"
              onClick={(e) => { e.stopPropagation(); onEdit(medication); }}
            >
              {t('common:buttons.edit')}
            </Button>
            <Button
              variant="subtle"
              color="red"
              size="compact-xs"
              onClick={(e) => { e.stopPropagation(); onDelete(medication.id); }}
            >
              {t('common:buttons.delete')}
            </Button>
          </Group>
        </Group>
      </Card.Section>
    </Card>
  );
};

export default MedicationCard;
