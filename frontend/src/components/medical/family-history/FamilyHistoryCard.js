import React, { useState } from 'react';
import {
  Badge,
  Text,
  Group,
  Stack,
  Box,
  Collapse,
  Divider,
  Button,
  Menu,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconStethoscope,
  IconEdit,
  IconTrash,
  IconDots,
  IconShare,
  IconX
} from '@tabler/icons-react';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useMantineColorScheme } from '@mantine/core';
import logger from '../../../services/logger';

// Style constants for consistency
const CARD_STYLES = {
  conditionBox: (colorScheme, severityColor) => ({
    borderLeft: `3px solid var(--mantine-color-${severityColor}-6)`,
    backgroundColor:
      colorScheme === 'dark'
        ? 'var(--mantine-color-dark-6)'
        : 'var(--mantine-color-gray-0)',
    borderRadius: '4px',
    padding: '8px',
  }),
  disabledAction: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

const FamilyHistoryCard = ({
  member,
  onView,
  onEdit,
  onDelete,
  onAddCondition,
  onEditCondition,
  onDeleteCondition,
  onShare,
  expandedMembers,
  onToggleExpanded,
  bulkSelectionMode = false,
  isSelected = false,
  onBulkToggle,
  onError
}) => {
  const { colorScheme } = useMantineColorScheme();

  const handleError = (error, action) => {
    logger.error('family_history_card_error', {
      message: `Error in FamilyHistoryCard during ${action}`,
      memberId: member?.id,
      error: error.message,
      component: 'FamilyHistoryCard',
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

  const handleCardClick = () => {
    if (bulkSelectionMode && !member.is_shared) {
      onBulkToggle(member.id);
    } else {
      onToggleExpanded(member.id);
    }
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    try {
      onView(member);
    } catch (error) {
      handleError(error, 'view');
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        logger.warn('Attempted to edit shared family member', {
          memberId: member.id,
          component: 'FamilyHistoryCard'
        });
        return;
      }
      onEdit(member);
    } catch (error) {
      handleError(error, 'edit');
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        logger.warn('Attempted to delete shared family member', {
          memberId: member.id,
          component: 'FamilyHistoryCard'
        });
        return;
      }
      onDelete(member.id);
    } catch (error) {
      handleError(error, 'delete');
    }
  };

  const handleAddConditionClick = (e) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        return;
      }
      onAddCondition(member);
    } catch (error) {
      handleError(error, 'add_condition');
    }
  };

  const handleEditConditionClick = (e, condition) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        return;
      }
      onEditCondition(member, condition);
    } catch (error) {
      handleError(error, 'edit_condition');
    }
  };

  const handleDeleteConditionClick = (e, conditionId) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        return;
      }
      onDeleteCondition(member.id, conditionId);
    } catch (error) {
      handleError(error, 'delete_condition');
    }
  };

  const handleShareClick = (e) => {
    e.stopPropagation();
    try {
      if (member.is_shared) {
        return;
      }
      onShare(member);
    } catch (error) {
      handleError(error, 'share');
    }
  };

  if (!member) {
    return null;
  }

  try {
    const isExpanded = expandedMembers?.has ? expandedMembers.has(member.id) : false;
    const conditionCount = member.family_conditions?.length || 0;
    const age = calculateAge(member.birth_year, member.death_year);
    const isSelectable = bulkSelectionMode && !member.is_shared;

    // Generate badges for BaseMedicalCard
    const badges = [];
    
    if (member.relationship) {
      badges.push({
        label: member.relationship.replace('_', ' '),
        color: 'blue'
      });
    }

    if (member.is_shared) {
      badges.push({
        label: bulkSelectionMode ? 'Not Selectable' : 'Shared',
        color: bulkSelectionMode ? 'gray' : 'blue'
      });
    }

    if (isSelected) {
      badges.push({
        label: 'Selected',
        color: 'green'
      });
    }

    // Generate fields for BaseMedicalCard
    const fields = [];
    
    if (age) {
      fields.push({
        label: 'Age',
        value: `${age} years${member.is_deceased ? ' (Deceased)' : ''}`
      });
    }

    if (member.gender) {
      fields.push({
        label: 'Gender',
        value: member.gender
      });
    }

    if (member.birth_year) {
      fields.push({
        label: 'Birth Year',
        value: member.birth_year
      });
    }

    if (member.is_deceased && member.death_year) {
      fields.push({
        label: 'Death Year',
        value: member.death_year
      });
    }

    if (member.is_shared && member.shared_by) {
      fields.push({
        label: 'Shared By',
        value: member.shared_by.name || 'Unknown'
      });
    }

    // Custom content for conditions
    const conditionsContent = (
      <Stack gap="xs">
        <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={handleCardClick}>
          <Badge
            variant="light"
            size="sm"
            color={conditionCount > 0 ? 'blue' : 'gray'}
          >
            {conditionCount} Condition{conditionCount !== 1 ? 's' : ''}
          </Badge>
          {isExpanded ? (
            <IconChevronUp size={16} />
          ) : (
            <IconChevronDown size={16} />
          )}
        </Group>

        <Collapse in={isExpanded}>
          <Divider mb="md" />
          <Group justify="space-between" mb="md">
            <Text fw={500}>Medical Conditions</Text>
            {!member.is_shared && (
              <Button
                size="xs"
                variant="filled"
                leftSection={<IconStethoscope size={14} />}
                onClick={handleAddConditionClick}
              >
                Add Condition
              </Button>
            )}
          </Group>

          {conditionCount === 0 ? (
            <Box style={{ textAlign: 'center', padding: '1rem 0' }}>
              <Text size="sm" c="dimmed">
                No medical conditions recorded
              </Text>
            </Box>
          ) : (
            <Stack gap="xs">
              {member.family_conditions?.map(condition => (
                <Box
                  key={condition.id}
                  style={CARD_STYLES.conditionBox(
                    colorScheme,
                    getSeverityColor(condition.severity)
                  )}
                >
                  <Group justify="space-between">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb="xs">
                        <Text fw={500}>{condition.condition_name}</Text>
                        {condition.severity && (
                          <Badge
                            size="xs"
                            color={getSeverityColor(condition.severity)}
                          >
                            {condition.severity}
                          </Badge>
                        )}
                        {condition.condition_type && (
                          <Badge
                            size="xs"
                            variant="outline"
                            color={getConditionTypeColor(condition.condition_type)}
                          >
                            {condition.condition_type.replace('_', ' ')}
                          </Badge>
                        )}
                      </Group>

                      {condition.diagnosis_age && (
                        <Text size="xs" c="dimmed">
                          Diagnosed at age {condition.diagnosis_age}
                        </Text>
                      )}

                      {condition.notes && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {condition.notes}
                        </Text>
                      )}
                    </div>

                    {!member.is_shared && (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="filled"
                          onClick={(e) => handleEditConditionClick(e, condition)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="filled"
                          color="red"
                          onClick={(e) => handleDeleteConditionClick(e, condition.id)}
                        >
                          Delete
                        </Button>
                      </Group>
                    )}
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </Collapse>
      </Stack>
    );

    // Additional actions content for menu
    const additionalActionsContent = (
      <Group justify="flex-end" gap="xs" mt="sm">
        <Menu shadow="md" width={150} position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="light" onClick={(e) => e.stopPropagation()}>
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!member.is_shared && (
              <>
                <Menu.Item
                  leftSection={<IconShare size={14} />}
                  onClick={handleShareClick}
                >
                  Share
                </Menu.Item>
              </>
            )}
            {member.is_shared && (
              <Menu.Item
                leftSection={<IconX size={14} />}
                color="orange"
                disabled
              >
                Cannot Edit Shared Member
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    );

    return (
      <div
        style={{
          cursor: isSelectable ? 'pointer' : 'default',
          opacity: isSelectable && !isSelected ? 0.8 : 1,
          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s ease',
          border: isSelected ? '2px solid var(--mantine-color-blue-6)' : 'none',
          borderRadius: '8px',
          backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : 'transparent',
        }}
        onClick={isSelectable ? handleCardClick : undefined}
        onMouseEnter={(e) => {
          if (isSelectable) {
            e.currentTarget.style.transform = isSelected ? 'scale(1.02)' : 'scale(1.01)';
            e.currentTarget.style.opacity = '1';
          }
        }}
        onMouseLeave={(e) => {
          if (isSelectable) {
            e.currentTarget.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
            e.currentTarget.style.opacity = isSelected ? '1' : '0.8';
          }
        }}
      >
        <BaseMedicalCard
          title={member.name}
          subtitle="Family Member"
          badges={badges}
          fields={fields}
          notes={member.notes}
          onView={handleViewClick}
          onEdit={!member.is_shared ? handleEditClick : undefined}
          onDelete={!member.is_shared ? handleDeleteClick : undefined}
          onError={handleError}
        >
          {conditionsContent}
          {additionalActionsContent}
        </BaseMedicalCard>
      </div>
    );
  } catch (error) {
    handleError(error, 'render');
    return null;
  }
};

export default FamilyHistoryCard;