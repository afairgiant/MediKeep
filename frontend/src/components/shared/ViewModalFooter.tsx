import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Tooltip } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

interface ViewModalFooterProps {
  onClose: () => void;
  /** Edit handler; when omitted the Edit button is not rendered */
  onEdit?: () => void;
  /** Already translated Edit label; defaults to the shared "Edit" label */
  editLabel?: string;
  disableEdit?: boolean;
  /** Tooltip shown on the Edit button while it is disabled */
  disableEditTooltip?: string;
  /** Extra actions, rendered between Close and Edit */
  children?: ReactNode;
}

/**
 * The single footer used by every record view modal, so the actions always sit
 * bottom right in the same order: Close, any extra actions, then Edit.
 */
function ViewModalFooter({
  onClose,
  onEdit,
  editLabel,
  disableEdit = false,
  disableEditTooltip,
  children,
}: ViewModalFooterProps) {
  const { t } = useTranslation('common');

  return (
    <Group justify="flex-end" gap="sm">
      <Button variant="default" onClick={onClose}>
        {t('shared:labels.close', 'Close')}
      </Button>
      {children}
      {onEdit && (
        <Tooltip
          label={disableEditTooltip}
          disabled={!disableEdit || !disableEditTooltip}
        >
          <span>
            <Button
              variant="filled"
              leftSection={<IconEdit size={16} aria-hidden="true" />}
              onClick={onEdit}
              disabled={disableEdit}
            >
              {editLabel ?? t('shared:labels.edit', 'Edit')}
            </Button>
          </span>
        </Tooltip>
      )}
    </Group>
  );
}

export default ViewModalFooter;
