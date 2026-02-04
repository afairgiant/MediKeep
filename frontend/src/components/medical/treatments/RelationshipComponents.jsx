import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconCheck,
  IconEdit,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

/**
 * Container with loading overlay for relationship components.
 */
export function RelationshipContainer({ loading, children }) {
  return (
    <Box pos="relative">
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 2 }}
      />
      {children}
    </Box>
  );
}

RelationshipContainer.propTypes = {
  loading: PropTypes.bool,
  children: PropTypes.node,
};

/**
 * Dismissible error alert for relationship components.
 */
export function RelationshipErrorAlert({ error, onDismiss }) {
  if (!error) return null;

  return (
    <Alert
      icon={<IconInfoCircle size={16} />}
      color="red"
      variant="light"
      onClose={onDismiss}
      withCloseButton
    >
      {error}
    </Alert>
  );
}

RelationshipErrorAlert.propTypes = {
  error: PropTypes.string,
  onDismiss: PropTypes.func,
};

/**
 * Empty state display when no relationships exist.
 */
export function RelationshipEmptyState({
  message,
  description,
  isViewMode,
}) {
  return (
    <Paper withBorder p="md" ta="center">
      <Text c="dimmed">{message}</Text>
      {!isViewMode && description && (
        <Text size="xs" c="dimmed" mt="xs">
          {description}
        </Text>
      )}
    </Paper>
  );
}

RelationshipEmptyState.propTypes = {
  message: PropTypes.string.isRequired,
  description: PropTypes.string,
  isViewMode: PropTypes.bool,
};

/**
 * Footer section with available count and add button.
 */
export function RelationshipAddFooter({
  availableCount,
  entityName,
  entityNamePlural,
  buttonLabel,
  onAdd,
  loading,
}) {
  const { t } = useTranslation('common');
  const plural = availableCount !== 1;
  const displayName = plural ? (entityNamePlural || `${entityName}s`) : entityName;

  return (
    <Group justify="space-between" align="center">
      <Text size="sm" c="dimmed">
        {availableCount} {displayName} available to link
      </Text>
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={onAdd}
        disabled={loading || availableCount === 0}
      >
        {buttonLabel || t('buttons.link', 'Link')}
      </Button>
    </Group>
  );
}

RelationshipAddFooter.propTypes = {
  availableCount: PropTypes.number.isRequired,
  entityName: PropTypes.string.isRequired,
  entityNamePlural: PropTypes.string,
  buttonLabel: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

/**
 * Edit/Delete action buttons for a relationship row.
 */
export function RelationshipRowActions({
  isEditing,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  loading,
}) {
  if (isEditing) {
    return (
      <Group gap="xs">
        <ActionIcon
          variant="light"
          color="green"
          size="sm"
          onClick={onSave}
          disabled={loading}
        >
          <IconCheck size={14} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color="gray"
          size="sm"
          onClick={onCancel}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group gap="xs">
      <ActionIcon
        variant="light"
        color="blue"
        size="sm"
        onClick={onEdit}
      >
        <IconEdit size={14} />
      </ActionIcon>
      <ActionIcon
        variant="light"
        color="red"
        size="sm"
        onClick={onDelete}
        disabled={loading}
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}

RelationshipRowActions.propTypes = {
  isEditing: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

/**
 * Standard modal for adding relationships.
 */
export function RelationshipAddModal({
  opened,
  onClose,
  title,
  children,
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="md"
      centered
      zIndex={3000}
    >
      <Stack gap="md">
        {children}
      </Stack>
    </Modal>
  );
}

RelationshipAddModal.propTypes = {
  opened: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

/**
 * Modal footer with cancel and submit buttons.
 */
export function RelationshipModalFooter({
  onCancel,
  onSubmit,
  loading,
  disabled,
  submitLabel,
}) {
  const { t } = useTranslation('common');

  return (
    <Group justify="flex-end" gap="sm">
      <Button variant="light" onClick={onCancel}>
        {t('buttons.cancel', 'Cancel')}
      </Button>
      <Button
        onClick={onSubmit}
        loading={loading}
        disabled={disabled}
      >
        {submitLabel}
      </Button>
    </Group>
  );
}

RelationshipModalFooter.propTypes = {
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  submitLabel: PropTypes.string.isRequired,
};

/**
 * Wrapper for relationship row in the list.
 */
export function RelationshipRow({ children }) {
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" align="flex-start">
        {children}
      </Group>
    </Paper>
  );
}

RelationshipRow.propTypes = {
  children: PropTypes.node,
};

/**
 * Formats a date string for display with readable format (e.g., "Jan 15, 2025").
 */
export function formatDateDisplay(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Gets display label from options array.
 */
export function getOptionLabel(value, options) {
  if (!value) return value;
  const option = options.find(opt => opt.value === value);
  return option ? option.label : value;
}

/**
 * Filters available options by removing already linked items.
 */
export function filterAvailableOptions(allOptions, linkedItems, idField) {
  if (!Array.isArray(allOptions)) return [];
  if (!Array.isArray(linkedItems)) return allOptions;
  const linkedIdStrings = linkedItems.map(rel => rel[idField]?.toString());
  return allOptions.filter(option => !linkedIdStrings.includes(option.value));
}

/**
 * Creates options array for MultiSelect from entity list.
 */
export function createSelectOptions(entities, labelFn) {
  if (!Array.isArray(entities)) return [];
  return entities.map(entity => ({
    value: entity.id.toString(),
    label: labelFn(entity),
  }));
}

/**
 * Creates options array sorted by date (most recent first).
 * @param {Array} entities - List of entities with date field
 * @param {Function} labelFn - Function to create label from entity
 * @param {string} dateField - Name of the date field to sort by
 * @returns {Array} Sorted options array
 */
export function createDateSortedOptions(entities, labelFn, dateField) {
  if (!Array.isArray(entities)) return [];

  // Sort by date (most recent first), items without dates go to the end
  const sorted = [...entities].sort((a, b) => {
    const dateA = a[dateField] ? new Date(a[dateField]) : null;
    const dateB = b[dateField] ? new Date(b[dateField]) : null;

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateB - dateA; // Most recent first
  });

  return sorted.map(entity => ({
    value: entity.id.toString(),
    label: labelFn(entity),
  }));
}
