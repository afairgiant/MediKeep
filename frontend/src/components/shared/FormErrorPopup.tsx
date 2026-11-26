import { useEffect, useRef, useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNestedDialog } from '../../hooks/useNestedDialog';
import { useRecordFormErrors } from './RecordForm';

// Above every dialog that can hold a record form: the record dialogs (2000), the
// inline-create dialogs (2050), New practitioner (2100) and SpecialtySelect's
// dialog (2200). Below the combobox dropdowns (3000).
const POPUP_Z_INDEX = 2300;

interface FormErrorPopupProps {
  /** Why the save failed (the page's own form check or the server) */
  error?: string | null;
}

/**
 * Shows why a record form could not be saved in a small dialog on top of the
 * form, which the user dismisses with OK. Every record form has one, placed
 * right after its RecordForm opening tag: <FormErrorPopup error={formError} />.
 *
 * It opens for a required field that RecordForm stopped the submit on, and for
 * an `error` from the page's own form check or the server. The same error
 * after another Save opens it again, so pages must clear `error` when a save
 * starts (useMedicalData's createItem and updateItem do). When it is about a
 * field, the cursor goes to that field on OK. Escape closes only this popup,
 * not the form underneath it.
 */
const FormErrorPopup = ({ error }: FormErrorPopupProps) => {
  const { t } = useTranslation('shared');
  const { fieldError, passedSubmits } = useRecordFormErrors();

  // Which error this is, so a new one opens the popup even with the same text.
  // A field message wins over `error`, which is then left from an earlier save.
  let errorKey: string | null = null;
  if (fieldError) errorKey = `field-${fieldError.attempt}`;
  else if (error) errorKey = `error-${passedSubmits}-${error}`;
  const message = fieldError ? fieldError.message : error;

  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  useEffect(() => {
    // The error went away (a new save started), so the next one is new
    if (errorKey === null) setDismissedKey(null);
  }, [errorKey]);
  const opened = errorKey !== null && errorKey !== dismissedKey;

  // Keep the text while the popup fades out, after the error itself is cleared
  const shownMessage = useRef(message);
  if (message) shownMessage.current = message;

  const dismiss = () => {
    setDismissedKey(errorKey);
    // Once this popup has closed, so its focus trap no longer holds the cursor
    if (fieldError) setTimeout(() => fieldError.focusField(), 0);
  };

  useNestedDialog(opened, dismiss);

  return (
    <Modal
      opened={opened}
      onClose={dismiss}
      title={
        <Group gap="xs" wrap="nowrap">
          <IconAlertCircle
            size={20}
            color="var(--mantine-color-red-6)"
            aria-hidden="true"
          />
          <Text fw={600}>{t('formValidation.popupTitle', 'Cannot save')}</Text>
        </Group>
      }
      size="sm"
      centered
      zIndex={POPUP_Z_INDEX}
      withCloseButton={false}
      closeOnClickOutside={false}
      // Escape is handled by useNestedDialog, so it does not also close the form
      closeOnEscape={false}
      // A field error puts the cursor in the field instead (see dismiss)
      returnFocus={!fieldError}
    >
      <Stack>
        <Text style={{ whiteSpace: 'pre-line' }}>{shownMessage.current}</Text>
        <Group justify="flex-end">
          <Button onClick={dismiss} data-autofocus>
            {t('formValidation.ok', 'OK')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default FormErrorPopup;
