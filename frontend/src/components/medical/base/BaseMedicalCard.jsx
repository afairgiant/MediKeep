import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Stack, Group, Text, Badge, Button, Divider, Tooltip } from '@mantine/core';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import { useTagColors } from '../../../hooks/useTagColors';
import logger from '../../../services/logger';
import { createCardClickHandler } from '../../../utils/helpers';
import '../../../styles/shared/MedicalPageShared.css';

const BaseMedicalCard = ({
  title,
  subtitle,
  status,
  badges = [],
  tags = [],
  fields = [],
  notes,
  fileCount = 0,
  fileCountLoading = false,
  onView,
  onEdit,
  onDelete,
  entityType,
  children,
  onError,
  disableCardClick = false,
  disableActions = false,
  disableActionsTooltip,
  getTagColor: getTagColorProp
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const { getTagColor: getTagColorHook } = useTagColors();
  const getTagColor = getTagColorProp || getTagColorHook;
  const handleError = (error, action) => {
    logger.error('base_medical_card_error', {
      message: `Error in BaseMedicalCard during ${action}`,
      entityType,
      error: error.message,
      component: 'BaseMedicalCard',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const safeOnView = () => {
    try {
      if (onView) onView();
    } catch (error) {
      handleError(error, 'view');
    }
  };

  const safeOnEdit = () => {
    try {
      if (onEdit) onEdit();
    } catch (error) {
      handleError(error, 'edit');
    }
  };

  const safeOnDelete = () => {
    try {
      if (onDelete) onDelete();
    } catch (error) {
      handleError(error, 'delete');
    }
  };

  try {
    return (
      <Card
        withBorder
        shadow="sm"
        radius="md"
        h="100%"
        className={disableCardClick ? undefined : "clickable-card"}
        onClick={disableCardClick ? undefined : createCardClickHandler(safeOnView)}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack gap="sm" style={{ flex: 1 }}>
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs" style={{ flex: 1 }}>
              {/* Handle title as either string or complex element */}
              {typeof title === 'string' ? (
                <Text fw={600} size="lg">{title}</Text>
              ) : (
                <div>{title}</div>
              )}
              {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
              <Group gap="xs">
                {badges.map((badge, index) => (
                  <Badge key={index} variant="light" color={badge.color} size="md">
                    {badge.label}
                  </Badge>
                ))}
                {tags.length > 0 && tags.slice(0, 2).map((tag) => (
                  <ClickableTagBadge
                    key={tag}
                    tag={tag}
                    color={getTagColor(tag)}
                    size="sm"
                    compact
                  />
                ))}
                {tags.length > 2 && (
                  <Text size="xs" c="dimmed">+{tags.length - 2}</Text>
                )}
                {entityType && (
                  <FileCountBadge
                    count={fileCount}
                    entityType={entityType}
                    variant="badge"
                    size="sm"
                    loading={fileCountLoading}
                    onClick={safeOnView}
                  />
                )}
              </Group>
            </Stack>
            {/* Only show status badge if it's not already included in the title */}
            {typeof title === 'string' && <StatusBadge status={status} />}
          </Group>

          {/* Dynamic Fields */}
          <Stack gap="xs">
            {fields.map((field, index) => (
              <Group key={index} align={field.align || 'center'}>
                <Text size="sm" fw={500} c="dimmed" w={120}>
                  {field.label}:
                </Text>
                {field.render ? field.render(field.value) : (
                  <Text size="sm" style={field.style || {}}>
                    {field.value || t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>

          {children}

          {/* Notes */}
          {notes && (
            <Stack gap="xs">
              <Divider />
              <Text size="sm" fw={500} c="dimmed">{t('shared:tabs.notes', 'Notes')}</Text>
              <Text size="sm" lineClamp={notesExpanded ? undefined : 2}>{notes}</Text>
              {notes.length > 120 && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  onClick={() => setNotesExpanded((prev) => !prev)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {notesExpanded
                    ? t('buttons.showLess', 'Show less')
                    : t('buttons.showMore', 'Show more')}
                </Button>
              )}
            </Stack>
          )}
        </Stack>

        {/* Action Buttons */}
        <Stack gap={0} mt="auto">
          <Divider />
          <Group justify="flex-end" gap="xs" pt="sm">
            <Button variant="filled" size="xs" onClick={safeOnView}>
              {t('buttons.view')}
            </Button>
            <Tooltip label={disableActionsTooltip} disabled={!disableActions || !disableActionsTooltip}>
              <span>
                <Button variant="filled" size="xs" onClick={safeOnEdit} disabled={disableActions}>
                  {t('shared:labels.edit')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip label={disableActionsTooltip} disabled={!disableActions || !disableActionsTooltip}>
              <span>
                <Button variant="filled" color="red" size="xs" onClick={safeOnDelete} disabled={disableActions}>
                  {t('buttons.delete')}
                </Button>
              </span>
            </Tooltip>
          </Group>
        </Stack>
      </Card>
    );
  } catch (error) {
    handleError(error, 'render');
    
    return (
      <Card withBorder shadow="sm" radius="md" h="100%">
        <Stack align="center" justify="center" h="100%">
          <Text c="red" size="sm" ta="center">
            {t('messages.displayError', 'Unable to display this item. Please try refreshing the page.')}
          </Text>
        </Stack>
      </Card>
    );
  }
};

export default BaseMedicalCard;