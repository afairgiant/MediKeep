import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Title,
  Badge,
  Paper,
  Text,
  Button,
  Tabs,
  Loader,
  Alert,
  ThemeIcon,
  SimpleGrid,
  ActionIcon,
  Menu,
  Divider,
} from '@mantine/core';
import {
  IconMail,
  IconSend,
  IconCheck,
  IconX,
  IconUsers,
  IconInfoCircle,
  IconRefresh,
  IconTrash,
  IconClock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../../contexts/AuthContext';
import invitationApi from '../../services/api/invitationApi';
import familyHistoryApi from '../../services/api/familyHistoryApi';
import logger from '../../services/logger';
import InvitationCard from './InvitationCard';
import InvitationResponseModal from './InvitationResponseModal';

const InvitationManager = ({ opened, onClose, onUpdate }) => {
  const { user: authUser } = useAuth();
  const [sentInvitations, setSentInvitations] = useState([]);
  const [receivedInvitations, setReceivedInvitations] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sent_by_me');
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [
    responseModalOpened,
    { open: openResponseModal, close: closeResponseModal },
  ] = useDisclosure(false);

  useEffect(() => {
    if (opened) {
      loadInvitations();
    }
  }, [opened]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      logger.debug('Loading invitations and family history shares', {
        component: 'InvitationManager',
        user: authUser?.id
      });

      const [pending, sent, sharedData] = await Promise.all([
        invitationApi.getPendingInvitations(),
        invitationApi.getSentInvitations(),
        familyHistoryApi.getSharedFamilyHistory(),
      ]);

      // For received invitations, only show pending ones (since accepted ones will appear in "Shared with Me")
      const filteredReceived = pending.filter(
        inv =>
          inv.status === 'pending' &&
          !['revoked', 'cancelled', 'expired'].includes(inv.status)
      );

      // For sent invitations, show all statuses (pending, accepted, rejected) but filter out revoked/cancelled
      const filteredSent = sent.filter(
        inv => !['revoked', 'cancelled', 'expired'].includes(inv.status)
      );

      setReceivedInvitations(filteredReceived);
      setSentInvitations(filteredSent);
      setSharedWithMe(sharedData.shared_family_history || []);

      logger.info('Successfully loaded invitation manager data', {
        component: 'InvitationManager',
        receivedCount: filteredReceived.length,
        sentCount: filteredSent.length,
        sharedCount: sharedData.shared_family_history?.length || 0
      });
    } catch (error) {
      logger.error('Failed to load invitations and shares', {
        component: 'InvitationManager',
        error: error.message,
        user: authUser?.id
      });
      
      notifications.show({
        title: 'Error',
        message: 'Failed to load invitations and shares',
        color: 'red',
        icon: <IconX size="1rem" />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickResponse = async (invitation, response) => {
    try {
      logger.debug('Responding to invitation', {
        component: 'InvitationManager',
        invitationId: invitation.id,
        response,
        user: authUser?.id
      });

      await invitationApi.respondToInvitation(invitation.id, response);

      logger.info('Successfully responded to invitation', {
        component: 'InvitationManager',
        invitationId: invitation.id,
        response
      });

      notifications.show({
        title: `Invitation ${response}`,
        message: `Successfully ${response} the invitation`,
        color: response === 'accepted' ? 'green' : 'orange',
        icon:
          response === 'accepted' ? (
            <IconCheck size="1rem" />
          ) : (
            <IconX size="1rem" />
          ),
      });

      loadInvitations();
      if (onUpdate) onUpdate();
    } catch (error) {
      logger.error('Failed to respond to invitation', {
        component: 'InvitationManager',
        invitationId: invitation.id,
        response,
        error: error.message
      });

      notifications.show({
        title: 'Error',
        message: `Failed to ${response} invitation`,
        color: 'red',
        icon: <IconX size="1rem" />,
      });
    }
  };

  const handleDetailedResponse = invitation => {
    setSelectedInvitation(invitation);
    openResponseModal();
  };

  const handleCancelInvitation = async invitation => {
    try {
      logger.debug('Handling invitation cancellation/revocation', {
        component: 'InvitationManager',
        invitationId: invitation.id,
        status: invitation.status,
        user: authUser?.id
      });

      if (invitation.status === 'pending') {
        // Cancel pending invitation
        await invitationApi.cancelInvitation(invitation.id);

        logger.info('Successfully cancelled pending invitation', {
          component: 'InvitationManager',
          invitationId: invitation.id
        });

        notifications.show({
          title: 'Invitation Cancelled',
          message: 'The invitation has been cancelled',
          color: 'orange',
          icon: <IconTrash size="1rem" />,
        });
      } else if (
        invitation.status === 'accepted' &&
        invitation.invitation_type === 'family_history_share'
      ) {
        // Revoke accepted family history share using invitation ID
        await invitationApi.revokeInvitation(invitation.id);

        logger.info('Successfully revoked family history sharing access', {
          component: 'InvitationManager',
          invitationId: invitation.id
        });

        notifications.show({
          title: 'Access Revoked',
          message: 'Family history sharing has been revoked',
          color: 'orange',
          icon: <IconTrash size="1rem" />,
        });
      } else if (invitation.status === 'revoked') {
        // Already revoked - just show a message
        logger.debug('Attempted to revoke already revoked invitation', {
          component: 'InvitationManager',
          invitationId: invitation.id
        });

        notifications.show({
          title: 'Already Revoked',
          message: 'This invitation has already been revoked',
          color: 'gray',
          icon: <IconTrash size="1rem" />,
        });
      }

      loadInvitations();
      if (onUpdate) onUpdate();
    } catch (error) {
      logger.error('Failed to handle invitation action', {
        component: 'InvitationManager',
        invitationId: invitation.id,
        status: invitation.status,
        error: error.message
      });

      notifications.show({
        title: 'Error',
        message:
          invitation.status === 'pending'
            ? 'Failed to cancel invitation'
            : 'Failed to revoke access',
        color: 'red',
        icon: <IconX size="1rem" />,
      });
    }
  };

  const handleResponseModalSuccess = () => {
    closeResponseModal();
    setSelectedInvitation(null);
    loadInvitations();
    if (onUpdate) onUpdate();
  };

  // Helper function to revoke share access
  const handleRevokeShare = async shareItem => {
    try {
      // Find the family member ID from the share item
      const familyMemberId = shareItem.family_member?.id;

      logger.debug('Removing own access to shared family history', {
        component: 'InvitationManager',
        familyMemberId,
        user: authUser?.id
      });

      if (familyMemberId) {
        // Use the new endpoint for recipients to remove their own access
        await familyHistoryApi.removeMyAccess(familyMemberId);

        logger.info('Successfully removed own access to shared family history', {
          component: 'InvitationManager',
          familyMemberId,
          familyMemberName: shareItem.family_member?.name
        });

        notifications.show({
          title: 'Access Removed',
          message: 'You no longer have access to this family history',
          color: 'orange',
          icon: <IconTrash size="1rem" />,
        });

        // Immediately remove the item from local state for better UX
        setSharedWithMe(prev => prev.filter(item => 
          item.family_member?.id !== familyMemberId
        ));

        // Also refresh from server to ensure consistency
        loadInvitations();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      logger.error('Failed to remove access to shared family history', {
        component: 'InvitationManager',
        familyMemberId: shareItem.family_member?.id,
        error: error.message
      });

      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to remove access',
        color: 'red',
        icon: <IconX size="1rem" />,
      });
    }
  };

  const EmptyState = ({ icon, title, description }) => (
    <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
      <ThemeIcon size="xl" color="gray" variant="light" mx="auto" mb="md">
        {icon}
      </ThemeIcon>
      <Text size="lg" fw={500} mb="xs">
        {title}
      </Text>
      <Text c="dimmed">{description}</Text>
    </Paper>
  );


  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <IconMail size="1.2rem" />
            <Title order={3}>Invitation Manager</Title>
          </Group>
        }
        size="xl"
        centered
      >
        <Stack gap="md">
          {/* Quick Actions */}
          <Group justify="flex-end">
            <ActionIcon
              onClick={loadInvitations}
              loading={loading}
              variant="light"
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="sent_by_me"
                leftSection={<IconSend size="0.8rem" />}
                rightSection={
                  <Badge size="sm" color="blue" variant="filled">
                    {sentInvitations.length}
                  </Badge>
                }
              >
                Sent by Me
              </Tabs.Tab>
              <Tabs.Tab
                value="shared_with_me"
                leftSection={<IconUsers size="0.8rem" />}
                rightSection={
                  <Badge size="sm" color="green" variant="filled">
                    {sharedWithMe.length + receivedInvitations.length}
                  </Badge>
                }
              >
                Shared with Me
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="sent_by_me" pt="md">
              {loading ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">
                    Loading sent invitations...
                  </Text>
                </Group>
              ) : sentInvitations.length > 0 ? (
                <Stack gap="md">
                  <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                    <Text size="sm">
                      You have sent {sentInvitations.length} invitation(s).
                      {sentInvitations.filter(inv => inv.status === 'pending')
                        .length > 0 &&
                        ` ${sentInvitations.filter(inv => inv.status === 'pending').length} are still pending.`}
                    </Text>
                  </Alert>
                  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                    {sentInvitations.map(invitation => (
                      <InvitationCard
                        key={invitation.id}
                        invitation={invitation}
                        variant="sent"
                        onCancel={handleCancelInvitation}
                        showStatus={true}
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              ) : (
                <EmptyState
                  icon={<IconSend size="2rem" />}
                  title="No Sent Invitations"
                  description="You haven't sent any family history sharing invitations yet."
                />
              )}
            </Tabs.Panel>

            <Tabs.Panel value="shared_with_me" pt="md">
              {loading ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">
                    Loading shared family history...
                  </Text>
                </Group>
              ) : receivedInvitations.length > 0 || sharedWithMe.length > 0 ? (
                <Stack gap="lg">
                  {/* Pending Invitations Section */}
                  {receivedInvitations.length > 0 && (
                    <div>
                      <Title order={5} mb="md">
                        Pending Invitations ({receivedInvitations.length})
                      </Title>
                      <Alert
                        icon={<IconClock />}
                        color="orange"
                        variant="light"
                        mb="md"
                      >
                        <Text size="sm">
                          You have {receivedInvitations.length} pending
                          invitation(s) waiting for your response.
                        </Text>
                      </Alert>
                      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                        {receivedInvitations.map(invitation => (
                          <InvitationCard
                            key={invitation.id}
                            invitation={invitation}
                            variant="received"
                            onRespond={(inv, response) => {
                              if (response === 'accepted') {
                                handleDetailedResponse(inv);
                              } else {
                                handleQuickResponse(inv, response);
                              }
                            }}
                          />
                        ))}
                      </SimpleGrid>
                    </div>
                  )}

                  {/* Active Shares Section */}
                  {sharedWithMe.length > 0 && (
                    <div>
                      <Title order={5} mb="md">
                        Active Shares ({sharedWithMe.length})
                      </Title>
                      <Alert
                        icon={<IconUsers />}
                        color="green"
                        variant="light"
                        mb="md"
                      >
                        <Text size="sm">
                          {sharedWithMe.length} family member(s) shared with you
                          by others.
                        </Text>
                      </Alert>
                      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                        {sharedWithMe.map(shareItem => (
                          <Paper
                            key={`share-${shareItem.family_member.id}`}
                            p="md"
                            withBorder
                            radius="md"
                          >
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <div style={{ flex: 1 }}>
                                  <Text fw={500} size="md">
                                    {shareItem.family_member.name}
                                  </Text>
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    transform="capitalize"
                                  >
                                    {shareItem.family_member.relationship?.replace(
                                      '_',
                                      ' '
                                    )}
                                    {shareItem.family_member.birth_year &&
                                      ` • Born ${shareItem.family_member.birth_year}`}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Shared by{' '}
                                    {shareItem.share_details?.shared_by?.name}
                                  </Text>
                                  {shareItem.share_details?.shared_at && (
                                    <Text size="xs" c="dimmed">
                                      on{' '}
                                      {new Date(
                                        shareItem.share_details.shared_at
                                      ).toLocaleDateString()}
                                    </Text>
                                  )}
                                </div>
                                <Badge color="green" variant="light">
                                  {shareItem.share_details?.permission_level ||
                                    'view'}
                                </Badge>
                              </Group>

                              {shareItem.share_details?.sharing_note && (
                                <Text size="sm" fs="italic" c="dimmed">
                                  "{shareItem.share_details.sharing_note}"
                                </Text>
                              )}

                              <Group justify="space-between" mt="sm">
                                <Text size="xs" c="dimmed">
                                  {shareItem.family_member.family_conditions
                                    ?.length || 0}{' '}
                                  condition(s)
                                </Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  onClick={() => handleRevokeShare(shareItem)}
                                >
                                  Remove Access
                                </Button>
                              </Group>
                            </Stack>
                          </Paper>
                        ))}
                      </SimpleGrid>
                    </div>
                  )}
                </Stack>
              ) : (
                <EmptyState
                  icon={<IconUsers size="2rem" />}
                  title="No Shared Family History"
                  description="No family medical history has been shared with you yet."
                />
              )}
            </Tabs.Panel>
          </Tabs>

          <Divider />

          {/* Quick Actions */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {sentInvitations.length} sent • {receivedInvitations.length}{' '}
              pending • {sharedWithMe.length} active shares
            </Text>
            <Group gap="sm">
              <Button variant="subtle" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="light"
                onClick={loadInvitations}
                leftSection={<IconRefresh size="1rem" />}
              >
                Refresh
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Response Modal */}
      <InvitationResponseModal
        opened={responseModalOpened}
        onClose={closeResponseModal}
        invitation={selectedInvitation}
        onSuccess={handleResponseModalSuccess}
      />
    </>
  );
};

export default InvitationManager;
