import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Card,
  Box,
  ActionIcon,
  Title,
  Paper,
  Tooltip,
} from '@mantine/core';
import {
  IconEdit,
  IconStethoscope,
} from '@tabler/icons-react';
import { useMantineColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../StatusBadge';
import logger from '../../../services/logger';
import { useDateFormat } from '../../../hooks/useDateFormat';

// Style constants matching the main component
const CARD_STYLES = {
  viewModalConditionBox: (colorScheme, severityColor) => ({
    borderLeft: `4px solid var(--mantine-color-${severityColor}-6)`,
    backgroundColor:
      colorScheme === 'dark'
        ? 'var(--mantine-color-dark-6)'
        : 'var(--mantine-color-gray-0)',
    borderRadius: '8px',
    padding: '16px',
  }),
  disabledAction: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

const FamilyHistoryViewModal = ({
  isOpen,
  onClose,
  member,
  onEdit,
  onAddCondition,
  onEditCondition,
  onDeleteCondition,
  onError,
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { colorScheme } = useMantineColorScheme();
  const { formatDate } = useDateFormat();

  const handleError = (error, action) => {
    logger.error('family_history_view_modal_error', {
      message: `Error in FamilyHistoryViewModal during ${action}`,
      memberId: member?.id,
      error: error.message,
      component: 'FamilyHistoryViewModal',
    });

    if (onError) {
      onError(error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'mild':
        return 'green';
      case 'moderate':
        return 'yellow';
      case 'severe':
        return 'red';
      case 'critical':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getConditionTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'cardiovascular':
        return 'red';
      case 'diabetes':
        return 'blue';
      case 'cancer':
        return 'purple';
      case 'mental_health':
        return 'teal';
      case 'neurological':
        return 'indigo';
      case 'genetic':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const calculateAge = (birthYear, deathYear = null) => {
    const currentYear = new Date().getFullYear();
    const endYear = deathYear || currentYear;
    return birthYear ? endYear - birthYear : null;
  };

  const handleEdit = () => {
    try {
      if (isReadOnly) {
        logger.warn('Attempted to edit read-only family member from view modal', {
          memberId: member.id,
          isShared: member.is_shared,
          disableEdit,
          component: 'FamilyHistoryViewModal'
        });
        return;
      }
      onEdit(member);
      onClose();
    } catch (error) {
      handleError(error, 'edit');
    }
  };

  const handleAddCondition = () => {
    try {
      if (isReadOnly) {
        return;
      }
      onAddCondition();
    } catch (error) {
      handleError(error, 'add_condition');
    }
  };

  const handleEditCondition = (condition) => {
    try {
      if (isReadOnly) {
        return;
      }
      onEditCondition(condition);
    } catch (error) {
      handleError(error, 'edit_condition');
    }
  };

  const handleDeleteCondition = (conditionId) => {
    try {
      if (isReadOnly) {
        return;
      }
      onDeleteCondition(member.id, conditionId);
    } catch (error) {
      handleError(error, 'delete_condition');
    }
  };

  const isReadOnly = disableEdit || member?.is_shared;

  if (!isOpen || !member) {
    return null;
  }

  try {
    const age = calculateAge(member.birth_year, member.death_year);

    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        zIndex={2000}
        centered
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }
        }}
        title={t('familyHistory.viewModal.modalTitle', 'Family Medical History')}
        size="lg"
        withinPortal
      >
        <Stack gap="md">
          {/* Header Card */}
          <Paper withBorder p="md" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} mb="xs">{member.name}</Title>
                <Group gap="xs">
                  <Badge variant="light" color="gray" size="sm">
                    {member.relationship?.replace('_', ' ')}
                  </Badge>
                  {member.is_shared && (
                    <Badge color="blue" variant="light" size="sm">
                      {t('shared:categories.shared', 'Shared')}
                    </Badge>
                  )}
                </Group>
              </div>
              {member.family_conditions && member.family_conditions.length > 0 && (
                <Badge variant="filled" color="orange" size="lg">
                  {member.family_conditions.length} {t('familyHistory.card.conditions', 'conditions')}
                </Badge>
              )}
            </Group>
          </Paper>

          {/* Family Member Info */}
          <Card withBorder p="md">
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="lg">
                {t('familyHistory.viewModal.memberDetails', 'Member Details')}
              </Text>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  onClick={handleEdit}
                  disabled={isReadOnly}
                  title={
                    isReadOnly
                      ? t('familyHistory.viewModal.cannotEditShared', 'Cannot edit shared family member')
                      : t('familyHistory.viewModal.editMember', 'Edit family member')
                  }
                  aria-label={
                    isReadOnly
                      ? t('familyHistory.viewModal.cannotEditShared', 'Cannot edit shared family member')
                      : t('familyHistory.viewModal.editMember', 'Edit family member')
                  }
                  style={
                    isReadOnly
                      ? CARD_STYLES.disabledAction
                      : {}
                  }
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Group>
            </Group>

            <Stack gap="xs">
              {member.gender && (
                <Text size="sm">
                  <strong>{t('shared:fields.gender', 'Gender')}:</strong> {member.gender}
                </Text>
              )}
              {member.birth_year && (
                <Text size="sm">
                  <strong>{t('familyHistory.card.birthYear', 'Birth Year')}:</strong> {member.birth_year}
                  {age && ` (${t('familyHistory.card.age', 'Age')} ${age})`}
                </Text>
              )}
              {member.is_deceased && member.death_year && (
                <Text size="sm">
                  <strong>{t('familyHistory.card.deathYear', 'Death Year')}:</strong> {member.death_year}
                </Text>
              )}
              {member.is_shared && member.shared_by && (
                <Text size="sm">
                  <strong>{t('familyHistory.card.sharedBy', 'Shared By')}:</strong> {member.shared_by.name || t('shared:labels.unknown', 'Unknown')}
                </Text>
              )}
              {member.is_shared && member.shared_at && (
                <Text size="sm">
                  <strong>{t('familyHistory.viewModal.sharedAt', 'Shared At')}:</strong> {formatDate(member.shared_at)}
                </Text>
              )}
              {member.is_shared && member.sharing_note && (
                <Text size="sm">
                  <strong>{t('familyHistory.viewModal.sharingNote', 'Sharing Note')}:</strong> {member.sharing_note}
                </Text>
              )}
              {member.notes && (
                <Text size="sm">
                  <strong>{t('shared:tabs.notes', 'Notes')}:</strong> {member.notes}
                </Text>
              )}
            </Stack>
          </Card>

          {/* Medical Conditions Section */}
          <Card withBorder p="md">
            <Group justify="space-between" mb="md">
              <Text fw={500} size="lg">
                {t('shared:labels.medicalConditions', 'Medical Conditions')}
              </Text>
              <Button
                size="xs"
                variant="filled"
                leftSection={<IconStethoscope size={16} />}
                onClick={handleAddCondition}
                disabled={isReadOnly}
                title={
                  isReadOnly
                    ? t('familyHistory.viewModal.cannotAddConditionsShared', 'Cannot add conditions to shared family member')
                    : t('familyHistory.viewModal.addCondition', 'Add medical condition')
                }
                aria-label={
                  isReadOnly
                    ? t('familyHistory.viewModal.cannotAddConditionsShared', 'Cannot add conditions to shared family member')
                    : t('familyHistory.viewModal.addCondition', 'Add medical condition')
                }
                style={
                  isReadOnly
                    ? CARD_STYLES.disabledAction
                    : {}
                }
              >
                {t('familyHistory.card.addCondition', 'Add Condition')}
              </Button>
            </Group>

            {!member.family_conditions || member.family_conditions.length === 0 ? (
              <Text
                size="sm"
                c="dimmed"
                style={{ textAlign: 'center', padding: '2rem 0' }}
              >
                {t('familyHistory.card.noConditionsRecorded', 'No medical conditions recorded')}
              </Text>
            ) : (
              <Stack gap="md">
                {member.family_conditions.map(condition => (
                  <Box
                    key={condition.id}
                    style={CARD_STYLES.viewModalConditionBox(
                      colorScheme,
                      getSeverityColor(condition.severity)
                    )}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Text fw={500} size="md">
                          {condition.condition_name}
                        </Text>
                        {condition.status && (
                          <StatusBadge status={condition.status} size="sm" />
                        )}
                        {condition.severity && (
                          <Badge color={getSeverityColor(condition.severity)}>
                            {condition.severity}
                          </Badge>
                        )}
                        {condition.condition_type && (
                          <Badge
                            variant="outline"
                            color={getConditionTypeColor(condition.condition_type)}
                          >
                            {condition.condition_type.replace('_', ' ')}
                          </Badge>
                        )}
                      </Group>

                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="filled"
                          onClick={() => handleEditCondition(condition)}
                          disabled={isReadOnly}
                          title={
                            isReadOnly
                              ? t('familyHistory.viewModal.cannotEditConditionsShared', 'Cannot edit conditions of shared family member')
                              : t('familyHistory.viewModal.editCondition', 'Edit condition')
                          }
                          aria-label={
                            isReadOnly
                              ? t('familyHistory.viewModal.cannotEditConditionsShared', 'Cannot edit conditions of shared family member')
                              : t('familyHistory.viewModal.editCondition', 'Edit condition')
                          }
                          style={
                            isReadOnly
                              ? CARD_STYLES.disabledAction
                              : {}
                          }
                        >
                          {t('shared:labels.edit', 'Edit')}
                        </Button>
                        <Button
                          size="xs"
                          variant="filled"
                          color="red"
                          onClick={() => handleDeleteCondition(condition.id)}
                          disabled={isReadOnly}
                          title={
                            isReadOnly
                              ? t('familyHistory.viewModal.cannotDeleteConditionsShared', 'Cannot delete conditions of shared family member')
                              : t('familyHistory.viewModal.deleteCondition', 'Delete condition')
                          }
                          aria-label={
                            isReadOnly
                              ? t('familyHistory.viewModal.cannotDeleteConditionsShared', 'Cannot delete conditions of shared family member')
                              : t('familyHistory.viewModal.deleteCondition', 'Delete condition')
                          }
                          style={
                            isReadOnly
                              ? CARD_STYLES.disabledAction
                              : {}
                          }
                        >
                          {t('buttons.delete', 'Delete')}
                        </Button>
                      </Group>
                    </Group>

                    {condition.diagnosis_age && (
                      <Text size="sm" c="dimmed" mb="xs">
                        {t('familyHistory.card.diagnosedAtAge', 'Diagnosed at age {{age}}', { age: condition.diagnosis_age })}
                      </Text>
                    )}

                    {condition.icd10_code && (
                      <Text size="sm" c="dimmed" mb="xs">
                        {/* eslint-disable-next-line i18next/no-literal-string -- medical coding standard name */}
                        <strong>{'ICD-10:'}</strong> {condition.icd10_code}
                      </Text>
                    )}

                    {condition.notes && (
                      <Text size="sm" c="dimmed">
                        {condition.notes}
                      </Text>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Action Buttons */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              {t('shared:labels.close', 'Close')}
            </Button>
            {!isReadOnly && (
              <Tooltip label={disableEditTooltip} disabled={!disableEdit || !disableEditTooltip}>
                <span>
                  <Button
                    variant="filled"
                    onClick={handleEdit}
                    leftSection={<IconEdit size={16} />}
                    disabled={disableEdit}
                  >
                    {t('familyHistory.viewModal.editFamilyMember', 'Edit Family Member')}
                  </Button>
                </span>
              </Tooltip>
            )}
          </Group>
        </Stack>
      </Modal>
    );
  } catch (error) {
    handleError(error, 'render');
    return null;
  }
};

export default FamilyHistoryViewModal;