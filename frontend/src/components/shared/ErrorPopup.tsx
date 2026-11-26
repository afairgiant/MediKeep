import { useRef } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNestedDialog } from '../../hooks/useNestedDialog';

// Above every dialog that can hold a record form: the record dialogs (2000), the
// inline-create dialogs (2050), New practitioner (2100) and SpecialtySelect's
// dialog (2200). Below the combobox dropdowns (3000).
const POPUP_Z_INDEX = 2300;

interface ErrorPopupProps {
  opened: boolean;
  title: string;
  message?: string | null;
  /** Called for OK and for Escape */
  onDismiss: () => void;
  /** Whether focus goes back to where it was when the popup closes */
  returnFocus?: boolean;
}

/**
 * A small dialog on top of a record dialog that says why something failed,
 * which the user dismisses with OK. Unlike an alert inside the dialog, it is
 * seen however far the dialog is scrolled. Escape closes only this popup, not
 * the dialog underneath it.
 */
const ErrorPopup = ({
  opened,
  title,
  message,
  onDismiss,
  returnFocus = true,
}: ErrorPopupProps) => {
  const { t } = useTranslation('shared');

  // Keep the text while the popup fades out, after the error itself is cleared
  const shownMessage = useRef(message);
  if (message) shownMessage.current = message;

  useNestedDialog(opened, onDismiss);

  return (
    <Modal
      opened={opened}
      onClose={onDismiss}
      title={
        <Group gap="xs" wrap="nowrap">
          <IconAlertCircle
            size={20}
            color="var(--mantine-color-red-6)"
            aria-hidden="true"
          />
          <Text fw={600}>{title}</Text>
        </Group>
      }
      size="sm"
      centered
      zIndex={POPUP_Z_INDEX}
      withCloseButton={false}
      closeOnClickOutside={false}
      // Escape is handled by useNestedDialog, so it does not also close the dialog
      closeOnEscape={false}
      returnFocus={returnFocus}
    >
      <Stack>
        <Text style={{ whiteSpace: 'pre-line' }}>{shownMessage.current}</Text>
        <Group justify="flex-end">
          <Button onClick={onDismiss} data-autofocus>
            {t('formValidation.ok', 'OK')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ErrorPopup;
