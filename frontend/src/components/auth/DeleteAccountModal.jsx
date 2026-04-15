import logger from '../../services/logger';

import { useState } from 'react';
import {
  Modal,
  Button,
  Text,
  Alert,
  TextInput,
  List,
  Stack,
  Group,
  Paper,
  Title,
  Code,
} from '@mantine/core';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import BaseApiService from '../../services/api/baseApi';

const DeleteAccountModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation(['auth', 'common', 'shared']);
  const { user, logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // Step 1: Warning, Step 2: Confirmation

  const requiredConfirmationText = 'DELETE MY ACCOUNT';

  const handleDeleteAccount = async () => {
    if (confirmationText !== requiredConfirmationText) {
      setError(t('deleteAccount.mustMatchExactly'));
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      logger.info('Attempting to delete account...');

      // Use BaseApiService for proper URL handling and authentication
      const apiService = new BaseApiService();
      await apiService.delete('/users/me', 'Failed to delete account');

      logger.info('Account deleted successfully');

      // Account deleted successfully, logout and redirect
      logout();
      // The logout function should handle the redirect
    } catch (err) {
      logger.error('Delete account error:', err);
      setError(err.message || 'An error occurred while deleting your account');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setStep(1);
      setConfirmationText('');
      setError(null);
      onClose();
    }
  };

  const handleNextStep = () => {
    setStep(2);
    setError(null);
  };

  const handlePreviousStep = () => {
    setStep(1);
    setConfirmationText('');
    setError(null);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        step === 1
          ? t('deleteAccount.title')
          : t('deleteAccount.confirmAccountDeletion')
      }
      size="md"
      closeOnClickOutside={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <Stack spacing="md">
        {step === 1 && (
          <>
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title={t('deleteAccount.warningTitle')}
              color="red"
              variant="light"
            />

            <Stack spacing="sm">
              <Title order={4}>{t('deleteAccount.permanentlyDelete')}</Title>
              <List spacing="xs" size="sm">
                <List.Item>
                  {t('deleteAccount.userAccount', { username: user?.username })}
                </List.Item>
                <List.Item>{t('deleteAccount.patientProfile')}</List.Item>
                <List.Item>
                  {t('deleteAccount.allMedicalRecords')}
                  <List withPadding spacing="xs" size="sm" mt="xs">
                    <List.Item>
                      {t('deleteAccount.records.medicationsAndPrescriptions')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.labResultsAndFiles')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.allergiesAndConditions')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.proceduresAndTreatments')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.immunizationRecords')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.vitalSigns')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.encountersAndVisits')}
                    </List.Item>
                    <List.Item>
                      {t('deleteAccount.records.emergencyContacts')}
                    </List.Item>
                  </List>
                </List.Item>
              </List>

              <Paper p="md" withBorder bg="red.1">
                <Text size="sm">
                  <Text component="span" fw={700}>
                    {t('deleteAccount.dataCannotBeRecovered')}
                  </Text>{' '}
                  {t('deleteAccount.contactSupport')}
                </Text>
              </Paper>
            </Stack>

            <Group position="right">
              <Button variant="default" onClick={handleClose}>
                {t('shared:fields.cancel')}
              </Button>
              <Button color="red" onClick={handleNextStep}>
                {t('deleteAccount.understand')}
              </Button>
            </Group>
          </>
        )}

        {step === 2 && (
          <>
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title={t('deleteAccount.finalConfirmation')}
              color="red"
              variant="light"
            />

            <Stack spacing="sm">
              <Text size="sm">{t('deleteAccount.typeConfirmation')}</Text>

              <Paper p="sm" bg="gray.2">
                <Code color="red" fw={700}>
                  {requiredConfirmationText}
                </Code>
              </Paper>

              <TextInput
                label={t('deleteAccount.confirmationLabel')}
                value={confirmationText}
                onChange={e => setConfirmationText(e.target.value)}
                placeholder={t('deleteAccount.confirmationPlaceholder')}
                disabled={isDeleting}
                error={
                  confirmationText &&
                  confirmationText !== requiredConfirmationText
                    ? t('deleteAccount.exactMatchError')
                    : null
                }
                autoFocus
              />

              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
            </Stack>

            <Group position="apart">
              <Button
                variant="default"
                onClick={handlePreviousStep}
                disabled={isDeleting}
              >
                {t('common:buttons.back')}
              </Button>
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleDeleteAccount}
                disabled={
                  isDeleting || confirmationText !== requiredConfirmationText
                }
                loading={isDeleting}
              >
                {isDeleting
                  ? t('deleteAccount.deleting')
                  : t('deleteAccount.deleteForever')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default DeleteAccountModal;
