import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
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
import { formatDateTime } from '../../utils/helpers';
import { useCacheManager, useCurrentPatient } from '../../hooks/useGlobalData';

const InvitationNotifications = () => {
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
        title: `Invitation ${response}`,
        message: `Successfully ${response} the invitation`,
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
        return 'Family History';
      case 'patient_share':
        return 'Patient Record';
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
            Invitations
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
              Invitations
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
            Last updated: {lastUpdate.toLocaleTimeString()}
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
                          From: {invitation.sent_by?.name}
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
                View all {pendingInvitations.length} invitations
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
                No pending invitations
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                New sharing invitations will appear here
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
            Manage All Invitations
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
          Share Patient
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
        title="Confirm Invitation Acceptance"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to accept this invitation?
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
            By accepting, you will gain access to view the shared medical information.
          </Text>
          
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeConfirmModal();
                setSelectedInvitation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleConfirmAccept}
              leftSection={<IconCheck size="1rem" />}
            >
              Accept Invitation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default InvitationNotifications;