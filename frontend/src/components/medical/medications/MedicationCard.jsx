import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { createCardClickHandler } from '../../../utils/helpers';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import { MEDICATION_TYPES } from '../../../constants/medicationTypes';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import '../../../styles/shared/MedicalPageShared.css';

const TYPE_FALLBACKS = {
  [MEDICATION_TYPES.PRESCRIPTION]: 'Prescription',
  [MEDICATION_TYPES.OTC]: 'Over-the-Counter',
  [MEDICATION_TYPES.SUPPLEMENT]: 'Supplement/Vitamin',
  [MEDICATION_TYPES.HERBAL]: 'Herbal/Natural',
};

const INACTIVE_STATUSES = [
  'inactive',
  'stopped',
  'completed',
  'cancelled',
  'on-hold',
];

const MedicationCard = ({
  medication,
  onView,
  onEdit,
  onDelete,
  navigate,
  fileCount = 0,
  fileCountLoading = false,
  disableActions = false,
  disableActionsTooltip,
  onError: _onError,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { formatLongDate } = useDateFormat();
  const { getTagColor } = useTagColors();

  const getMedicationPurpose = medication => {
    const indication = medication.indication?.trim();
    return indication || t('shared:labels.notSpecified');
  };

  const getMedicationTypeLabel = type => {
    const fallback = TYPE_FALLBACKS[type];
    if (!fallback) return type;
    return t(`common:medications.types.${type}`, fallback);
  };

  const isInactive = INACTIVE_STATUSES.includes(
    medication.status?.toLowerCase()
  );

  const handleEntityClick = (entityType, entityId) => e => {
    e.stopPropagation();
    navigateToEntity(entityType, entityId, navigate);
  };

  const handleEntityKeyDown = (entityType, entityId) => e => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      navigateToEntity(entityType, entityId, navigate);
    }
  };

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      className="clickable-card"
      role="button"
      tabIndex={0}
      aria-label={t('common:labels.viewDetails', {
        name: medication.medication_name,
        defaultValue: `View ${medication.medication_name} details`,
      })}
      onClick={createCardClickHandler(onView, medication)}
      onKeyDown={e => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          e.currentTarget === e.target
        ) {
          e.preventDefault();
          onView(medication);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isInactive
          ? '4px solid var(--mantine-color-red-6)'
          : '4px solid var(--mantine-color-green-6)',
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
              {medication.medication_type &&
                medication.medication_type !== 'prescription' && (
                  <Badge variant="light" color="grape" size="sm">
                    {getMedicationTypeLabel(medication.medication_type)}
                  </Badge>
                )}
            </Group>
            <Group gap="xs">
              {medication.tags &&
                medication.tags.length > 0 &&
                medication.tags
                  .slice(0, 2)
                  .map(tag => (
                    <ClickableTagBadge
                      key={tag}
                      tag={tag}
                      color={getTagColor(tag)}
                      size="sm"
                      compact
                    />
                  ))}
              {medication.tags && medication.tags.length > 2 && (
                <Text size="xs" c="dimmed">
                  +{medication.tags.length - 2}
                </Text>
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
                {t('shared:fields.frequency')}:
              </Text>
              <Text size="sm">{medication.frequency}</Text>
            </Group>
          )}
          {medication.route && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('shared:labels.route')}:
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
                role="link"
                tabIndex={0}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={handleEntityClick(
                  'practitioner',
                  medication.practitioner.id
                )}
                onKeyDown={handleEntityKeyDown(
                  'practitioner',
                  medication.practitioner.id
                )}
                aria-label={t('shared:labels.viewPractitionerDetails')}
              >
                {medication.practitioner.name}
              </Text>
            </Group>
          )}
          {medication.pharmacy && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('shared:fields.pharmacy')}:
              </Text>
              <Text
                size="sm"
                c="blue"
                role="link"
                tabIndex={0}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={handleEntityClick('pharmacy', medication.pharmacy.id)}
                onKeyDown={handleEntityKeyDown(
                  'pharmacy',
                  medication.pharmacy.id
                )}
                aria-label={t(
                  'common:labels.viewPharmacyDetails',
                  'View pharmacy details'
                )}
              >
                {medication.pharmacy.name}
              </Text>
            </Group>
          )}
          {medication.effective_period_start && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('shared:labels.startDate', 'Start Date')}:
              </Text>
              <Text size="sm">
                {formatLongDate(medication.effective_period_start)}
              </Text>
            </Group>
          )}
          {medication.effective_period_end && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                {t('shared:labels.endDate', 'End Date')}:
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
            onClick={e => {
              e.stopPropagation();
              onView(medication);
            }}
          >
            {t('common:buttons.view')}
          </Button>
          <Tooltip
            label={disableActionsTooltip}
            disabled={!disableActions || !disableActionsTooltip}
          >
            <span onClick={e => e.stopPropagation()}>
              <Button
                variant="filled"
                size="xs"
                disabled={disableActions}
                onClick={e => {
                  e.stopPropagation();
                  onEdit(medication);
                }}
              >
                {t('shared:labels.edit')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip
            label={disableActionsTooltip}
            disabled={!disableActions || !disableActionsTooltip}
          >
            <span onClick={e => e.stopPropagation()}>
              <Button
                variant="filled"
                color="red"
                size="xs"
                disabled={disableActions}
                onClick={e => {
                  e.stopPropagation();
                  onDelete(medication.id);
                }}
              >
                {t('common:buttons.delete')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Stack>
    </Card>
  );
};

export default MedicationCard;
