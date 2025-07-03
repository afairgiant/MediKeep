import React, { useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';

const DeleteAccountModal = ({ isOpen, onClose }) => {
  const { user, logout, token } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // Step 1: Warning, Step 2: Confirmation

  const requiredConfirmationText = 'DELETE MY ACCOUNT';

  const handleDeleteAccount = async () => {
    if (confirmationText !== requiredConfirmationText) {
      setError('Please type the exact confirmation text to proceed.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      console.log('Attempting to delete account...');
      console.log('Token:', token);

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log('Auth headers:', headers);

      // Try direct backend first, then proxy as fallback
      const urls = [
        'http://localhost:8000/api/v1/users/me', // Direct backend
        '/api/v1/users/me', // Proxy
      ];

      let response;
      let lastError;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          console.log(`Attempting DELETE to: ${url}`);
          response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
          });

          console.log(`Response from ${url}: ${response.status}`);

          if (response.status !== 404) {
            // Found a working endpoint (even if auth failed, at least the endpoint exists)
            break;
          }
        } catch (error) {
          console.warn(`Failed to connect to ${url}:`, error.message);
          lastError = error;
          if (i < urls.length - 1) {
            console.log('Trying next URL...');
            continue;
          }
        }
      }

      if (!response) {
        throw new Error(
          `All endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`
        );
      }

      console.log('Delete response status:', response.status);
      console.log(
        'Delete response headers:',
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Delete failed with error:', errorData);
        throw new Error(errorData.detail || 'Failed to delete account');
      }

      const result = await response.json().catch(() => ({}));
      console.log('Delete successful:', result);

      // Account deleted successfully, logout and redirect
      logout();
      // The logout function should handle the redirect
    } catch (err) {
      console.error('Delete account error:', err);
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
      title={step === 1 ? 'Delete Account' : 'Confirm Account Deletion'}
      size="md"
      closeOnClickOutside={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <Stack spacing="md">
        {step === 1 && (
          <>
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title="WARNING: This action cannot be undone!"
              color="red"
              variant="light"
            />

            <Stack spacing="sm">
              <Title order={4}>This will permanently delete:</Title>
              <List spacing="xs" size="sm">
                <List.Item>Your user account ({user?.username})</List.Item>
                <List.Item>
                  Your patient profile and personal information
                </List.Item>
                <List.Item>
                  ALL medical records including:
                  <List withPadding spacing="xs" size="sm" mt="xs">
                    <List.Item>Medications and prescriptions</List.Item>
                    <List.Item>Lab results and medical files</List.Item>
                    <List.Item>Allergies and medical conditions</List.Item>
                    <List.Item>Procedures and treatments</List.Item>
                    <List.Item>Immunization records</List.Item>
                    <List.Item>Vital signs and measurements</List.Item>
                    <List.Item>Medical encounters and visits</List.Item>
                    <List.Item>Emergency contacts</List.Item>
                  </List>
                </List.Item>
              </List>

              <Paper p="md" withBorder bg="red.0">
                <Text size="sm">
                  <Text component="span" fw={700}>
                    Once deleted, this data cannot be recovered.
                  </Text>{' '}
                  If you're having issues with the application, please consider
                  contacting support instead of deleting your account.
                </Text>
              </Paper>
            </Stack>

            <Group position="right">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button color="red" onClick={handleNextStep}>
                I Understand, Continue
              </Button>
            </Group>
          </>
        )}

        {step === 2 && (
          <>
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title="Final Confirmation Required"
              color="red"
              variant="light"
            />

            <Stack spacing="sm">
              <Text size="sm">
                To confirm that you want to permanently delete your account and
                all associated data, please type the following text exactly:
              </Text>

              <Paper p="sm" bg="gray.1">
                <Code color="red" fw={700}>
                  {requiredConfirmationText}
                </Code>
              </Paper>

              <TextInput
                label="Type confirmation text:"
                value={confirmationText}
                onChange={e => setConfirmationText(e.target.value)}
                placeholder="Type the confirmation text"
                disabled={isDeleting}
                error={
                  confirmationText &&
                  confirmationText !== requiredConfirmationText
                    ? 'Text must match exactly'
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
                Back
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
                  ? 'Deleting Account...'
                  : 'Delete My Account Forever'}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default DeleteAccountModal;
