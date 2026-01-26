import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  ActionIcon,
  ThemeIcon,
  Paper,
  Loader,
  Center,
  Menu,
  Alert,
  Modal,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconMail,
  IconCheck,
  IconX,
  IconUsers,
  IconChevronRight,
  IconRefresh,
  IconBell,
  IconDots,
  IconUserShare,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import invitationApi from '../../services/api/invitationApi';
import { InvitationManager } from '../invitations';
import { PatientSharingModal } from '../medical';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useCacheManager, useCurrentPatient } from '../../hooks/useGlobalData';

const InvitationNotifications = () => {
  const { t } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');
  const { formatDateTime } = useDateFormat();
  const { colorScheme } = useMantineColorScheme();
  const { invalidatePatientList } = useCacheManager();
  const { patient: currentPatient } = useCurrentPatient();
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [invitationManagerOpened, { open: openInvitationManager, close: closeInvitationManager }] = useDisclosure(false);
  const [confirmModalOpened, { open: openConfirmModal, close: closeConfirmModal }] = useDisclosure(false);
  const [patientSharingOpened, { open: openPatientSharing, close: closePatientSharing }] = useDisclosure(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);

  const loadPendingInvitations = async () => {
    try {
      setLoading(true);
      const invitations = await invitationApi.getPendingInvitations();
      setPendingInvitations(invitations);
      setLastUpdate(new Date());
    } catch (error) {
      logger.error('Error loading pending invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingInvitations();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadPendingInvitations, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickResponse = async (invitation, response) => {
    // Show confirmation for accepted responses
    if (response === 'accepted') {
      setSelectedInvitation(invitation);
      openConfirmModal();
      return;
    }

    // Direct processing for rejected responses
    try {
      await invitationApi.respondToInvitation(invitation.id, response);
      
      notifications.show({
        title: t(`invitations.notification.${response}Title`, `Invitation ${response}`),
        message: t(`invitations.notification.${response}Message`, `Successfully ${response} the invitation`),
        color: response === 'accepted' ? 'green' : 'orange',
        icon: response === 'accepted' ? <IconCheck size="1rem" /> : <IconX size="1rem" />
      });
      
      // Refresh the list
      loadPendingInvitations();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Failed to ${response} invitation`,
        color: 'red',
        icon: <IconX size="1rem" />
      });
    }
  };

  const handleConfirmAccept = async () => {
    if (!selectedInvitation) return;

    try {
      await invitationApi.respondToInvitation(selectedInvitation.id, 'accepted');

      // Invalidate patient list cache if this was a patient share invitation
      if (selectedInvitation.invitation_type === 'patient_share') {
        await invalidatePatientList();
      }

      notifications.show({
        title: 'Invitation accepted',
        message: 'Successfully accepted the invitation',
        color: 'green',
        icon: <IconCheck size="1rem" />
      });

      // Refresh the list
      loadPendingInvitations();
      closeConfirmModal();
      setSelectedInvitation(null);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to accept invitation',
        color: 'red',
        icon: <IconX size="1rem" />
      });
    }
  };

  const getInvitationTypeDisplay = (type) => {
    switch (type) {
      case 'family_history_share':
        return t('invitations.types.familyHistory', 'Family History');
      case 'patient_share':
        return t('invitations.types.patientRecord', 'Patient Record');
      default:
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getInvitationIcon = (type) => {
    switch (type) {
      case 'family_history_share':
        return <IconUsers size="1rem" />;
      case 'patient_share':
        return <IconUserShare size="1rem" />;
      default:
        return <IconMail size="1rem" />;
    }
  };

  const handleInvitationUpdate = () => {
    loadPendingInvitations();
  };

  if (loading && !lastUpdate) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3} size="h4">
            {t('invitations.title', 'Invitations')}
          </Title>
        </Group>
        <Center py="md">
          <Loader size="sm" />
        </Center>
      </Card>
    );
  }

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Title order={3} size="h4">
              {t('invitations.title', 'Invitations')}
            </Title>
            {pendingInvitations.length > 0 && (
              <Badge color="orange" size="sm" variant="filled">
                {pendingInvitations.length}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              onClick={loadPendingInvitations}
              loading={loading}
              size="sm"
            >
              <IconRefresh size="0.9rem" />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              onClick={openInvitationManager}
              size="sm"
            >
              <IconDots size="0.9rem" />
            </ActionIcon>
          </Group>
        </Group>

        {lastUpdate && (
          <Text size="xs" c="dimmed" mb="sm">
            {t('invitations.lastUpdated', 'Last updated')}: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}

        {pendingInvitations.length > 0 ? (
          <Stack gap="xs">
            {pendingInvitations.slice(0, 3).map((invitation) => (
              <Paper
                key={invitation.id}
                p="sm"
                radius="md"
                withBorder
                styles={(theme) => ({
                  root: {
                    backgroundColor: colorScheme === 'dark' 
                      ? theme.colors.dark[6] 
                      : theme.colors.blue[0]
                  }
                })}
              >
                <Stack gap="xs">
                  <Group gap="xs" justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon
                        color="blue"
                        variant="light"
                        size="sm"
                        radius="md"
                      >
                        {getInvitationIcon(invitation.invitation_type)}
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {invitation.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('invitations.from', 'From')}: {invitation.sent_by?.name}
                        </Text>
                      </div>
                    </Group>
                    <Badge size="xs" variant="light" color="blue">
                      {getInvitationTypeDisplay(invitation.invitation_type)}
                    </Badge>
                  </Group>

                  <Group gap="xs" justify="space-between">
                    <Text size="xs" c="dimmed">
                      {formatDateTime(invitation.created_at)}
                    </Text>
                    <Group gap="xs">
                      <ActionIcon
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => handleQuickResponse(invitation, 'rejected')}
                      >
                        <IconX size="0.7rem" />
                      </ActionIcon>
                      <ActionIcon
                        size="xs"
                        color="green"
                        variant="light"
                        onClick={() => handleQuickResponse(invitation, 'accepted')}
                      >
                        <IconCheck size="0.7rem" />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            ))}
            
            {pendingInvitations.length > 3 && (
              <Button
                variant="light"
                size="xs"
                onClick={openInvitationManager}
                rightSection={<IconChevronRight size="0.8rem" />}
              >
                {t('invitations.viewAll', 'View all {{count}} invitations', { count: pendingInvitations.length })}
              </Button>
            )}
          </Stack>
        ) : (
          <Paper p="md" radius="md" withBorder>
            <Stack align="center" gap="xs">
              <ThemeIcon color="gray" variant="light" size="lg">
                <IconBell size={20} />
              </ThemeIcon>
              <Text size="sm" fw={500} c="dimmed" ta="center">
                {t('invitations.noPending', 'No pending invitations')}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                {t('invitations.noPendingDescription', 'New sharing invitations will appear here')}
              </Text>
            </Stack>
          </Paper>
        )}

        {pendingInvitations.length > 0 && (
          <Button
            variant="light"
            size="sm"
            onClick={openInvitationManager}
            rightSection={<IconChevronRight size="0.8rem" />}
            mt="sm"
            fullWidth
          >
            {t('invitations.manageAll', 'Manage All Invitations')}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={openPatientSharing}
          leftSection={<IconUserShare size="0.9rem" />}
          mt="xs"
          fullWidth
        >
          {t('invitations.sharePatient', 'Share Patient')}
        </Button>
      </Card>

      {/* Invitation Manager Modal */}
      <InvitationManager
        opened={invitationManagerOpened}
        onClose={closeInvitationManager}
        onUpdate={handleInvitationUpdate}
      />

      {/* Patient Sharing Modal */}
      <PatientSharingModal
        opened={patientSharingOpened}
        onClose={closePatientSharing}
        patient={currentPatient}
        onShareUpdate={handleInvitationUpdate}
      />

      {/* Confirmation Modal for Accepting Invitations */}
      <Modal
        opened={confirmModalOpened}
        onClose={() => {
          closeConfirmModal();
          setSelectedInvitation(null);
        }}
        title={t('invitations.confirmTitle', 'Confirm Invitation Acceptance')}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            {t('invitations.confirmQuestion', 'Are you sure you want to accept this invitation?')}
          </Text>
          
          {selectedInvitation && (
            <Paper p="sm" withBorder radius="md" bg={colorScheme === 'dark' ? 'dark.6' : 'gray.0'}>
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon color="blue" variant="light" size="sm">
                    {getInvitationIcon(selectedInvitation.invitation_type)}
                  </ThemeIcon>
                  <Text size="sm" fw={500}>
                    {selectedInvitation.title}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  From: {selectedInvitation.sent_by?.name}
                </Text>
                <Badge size="xs" variant="light" color="blue">
                  {getInvitationTypeDisplay(selectedInvitation.invitation_type)}
                </Badge>
              </Stack>
            </Paper>
          )}

          <Text size="xs" c="dimmed">
            {t('invitations.confirmDescription', 'By accepting, you will gain access to view the shared medical information.')}
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeConfirmModal();
                setSelectedInvitation(null);
              }}
            >
              {tCommon('buttons.cancel')}
            </Button>
            <Button
              color="green"
              onClick={handleConfirmAccept}
              leftSection={<IconCheck size="1rem" />}
            >
              {t('invitations.acceptButton', 'Accept Invitation')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default InvitationNotifications;