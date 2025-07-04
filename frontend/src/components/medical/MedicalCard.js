import React from 'react';
import { formatDate, formatDateTime } from '../../utils/helpers';
import {
  Card,
  Group,
  Text,
  Stack,
  Badge,
  Button,
  ActionIcon,
  Box,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';

/**
 * Reusable card component for medical records using Mantine
 */
const MedicalCard = ({
  title,
  subtitle,
  status,
  statusType = 'general',
  children,
  actions,
  dateInfo,
  className = '',
  onClick,
  onEdit,
  onDelete,
  ...props
}) => {
  const getStatusColor = (status, type) => {
    if (!status) return 'gray';

    const statusLower = status.toLowerCase();

    if (type === 'medication') {
      switch (statusLower) {
        case 'active':
          return 'green';
        case 'stopped':
          return 'red';
        case 'on-hold':
          return 'yellow';
        case 'completed':
          return 'blue';
        case 'cancelled':
          return 'gray';
        default:
          return 'gray';
      }
    }

    if (type === 'lab-result') {
      switch (statusLower) {
        case 'completed':
          return 'green';
        case 'in-progress':
          return 'blue';
        case 'ordered':
          return 'yellow';
        case 'cancelled':
          return 'red';
        default:
          return 'gray';
      }
    }

    // General status colors
    switch (statusLower) {
      case 'active':
      case 'completed':
      case 'normal':
        return 'green';
      case 'inactive':
      case 'cancelled':
        return 'red';
      case 'pending':
      case 'scheduled':
        return 'yellow';
      case 'in-progress':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      p="md"
      className={className}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      {...props}
    >
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Box style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {title}
            </Text>
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
          </Box>

          {status && (
            <Badge
              variant="light"
              color={getStatusColor(status, statusType)}
              size="md"
            >
              {status}
            </Badge>
          )}
        </Group>

        {/* Body */}
        {children && <Box>{children}</Box>}

        {/* Date Information */}
        {dateInfo && (
          <Stack gap="xs">
            {dateInfo.created && (
              <Text size="xs" c="dimmed">
                Created: {formatDate(dateInfo.created)}
              </Text>
            )}
            {dateInfo.updated && (
              <Text size="xs" c="dimmed">
                Updated: {formatDateTime(dateInfo.updated)}
              </Text>
            )}
            {dateInfo.custom && (
              <Text size="xs" c="dimmed">
                {dateInfo.custom.label}: {formatDate(dateInfo.custom.date)}
              </Text>
            )}
          </Stack>
        )}

        {/* Actions */}
        {(onEdit || onDelete || actions) && (
          <Group justify="flex-end" gap="xs" mt="sm">
            {onEdit && (
              <ActionIcon
                variant="light"
                color="blue"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <IconEdit size={16} />
              </ActionIcon>
            )}
            {onDelete && (
              <ActionIcon
                variant="light"
                color="red"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            )}
            {actions}
          </Group>
        )}
      </Stack>
    </Card>
  );
};

export default MedicalCard;
