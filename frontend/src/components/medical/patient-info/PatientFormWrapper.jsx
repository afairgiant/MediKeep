import {
  Modal,
  Stack,
  Alert,
  Text,
  Group,
  ThemeIcon,
} from '@mantine/core';
import { IconUserEdit, IconUserPlus } from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import MantinePatientForm from '../MantinePatientForm';
import logger from '../../../services/logger';

const PatientFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners = [],
  isLoading,
  statusMessage,
  isCreating = false,
  error = '',
  onPhotoChange,
}) => {
  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    onSubmit();
  };

  if (!isOpen) return null;

  const modalTitle = (
    <Group gap="sm">
      <ThemeIcon variant="light" size="md" radius="md" color={isCreating ? 'teal' : 'blue'}>
        {isCreating ? <IconUserPlus size={16} /> : <IconUserEdit size={16} />}
      </ThemeIcon>
      <Text fw={600} size="lg">{title}</Text>
    </Group>
  );

  try {
    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        title={modalTitle}
        size="lg"
        closeOnClickOutside={!isLoading}
        closeOnEscape={!isLoading}
        radius="lg"
        overlayProps={{ backgroundOpacity: 0.4, blur: 4 }}
        styles={{
          header: {
            borderBottom: '1px solid var(--mantine-color-default-border)',
            paddingBottom: 12,
          },
          body: {
            paddingTop: 16,
          },
        }}
      >
        <FormLoadingOverlay visible={isLoading} statusMessage={statusMessage} />

        <Stack gap="md">
          {error && (
            <Alert variant="light" color="red" title="Error" radius="md">
              {error}
            </Alert>
          )}

          <MantinePatientForm
            formData={formData}
            onInputChange={onInputChange}
            onSave={handleSubmit}
            onCancel={onClose}
            practitioners={practitioners}
            saving={isLoading}
            isCreating={isCreating}
            onPhotoChange={onPhotoChange}
          />
        </Stack>
      </Modal>
    );
  } catch (error) {
    logger.error('patient_form_wrapper_error', {
      message: 'Error in PatientFormWrapper',
      error: error.message,
      component: 'PatientFormWrapper',
      editingItemId: editingItem?.id,
    });

    return (
      <Modal opened={isOpen} onClose={onClose} title="Error" radius="lg">
        <Stack align="center" gap="md">
          {/* eslint-disable-next-line i18next/no-literal-string -- error fallback */}
          <Alert variant="light" color="red" title={'Form Error'} radius="md">
            Unable to display the patient form. Please try refreshing the page.
          </Alert>
        </Stack>
      </Modal>
    );
  }
};

export default PatientFormWrapper;