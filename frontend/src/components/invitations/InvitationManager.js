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
    Divider
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
    IconClock
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import invitationApi from '../../services/api/invitationApi';
import familyHistoryApi from '../../services/api/familyHistoryApi';
import InvitationCard from './InvitationCard';
import InvitationResponseModal from './InvitationResponseModal';

const InvitationManager = ({ opened, onClose, onUpdate }) => {
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [sentInvitations, setSentInvitations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('pending_sent');
    const [selectedInvitation, setSelectedInvitation] = useState(null);
    const [responseModalOpened, { open: openResponseModal, close: closeResponseModal }] = useDisclosure(false);

    useEffect(() => {
        if (opened) {
            loadInvitations();
        }
    }, [opened]);

    const loadInvitations = async () => {
        try {
            setLoading(true);
            const [pending, sent] = await Promise.all([
                invitationApi.getPendingInvitations(),
                invitationApi.getSentInvitations()
            ]);
            // Filter out revoked and canceled invitations
            const filteredPending = pending.filter(inv => !['revoked', 'cancelled', 'expired'].includes(inv.status));
            const filteredSent = sent.filter(inv => !['revoked', 'cancelled', 'expired'].includes(inv.status));
            
            console.log('DEBUG: Loaded invitations', { 
                pending: filteredPending, 
                sent: filteredSent,
                filtered_out: {
                    pending: pending.length - filteredPending.length,
                    sent: sent.length - filteredSent.length
                }
            });
            setPendingInvitations(filteredPending);
            setSentInvitations(filteredSent);
        } catch (error) {
            notifications.show({
                title: 'Error',
                message: 'Failed to load invitations',
                color: 'red',
                icon: <IconX size="1rem" />
            });
            console.error('Error loading invitations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickResponse = async (invitation, response) => {
        try {
            await invitationApi.respondToInvitation(invitation.id, response);
            
            notifications.show({
                title: `Invitation ${response}`,
                message: `Successfully ${response} the invitation`,
                color: response === 'accepted' ? 'green' : 'orange',
                icon: response === 'accepted' ? <IconCheck size="1rem" /> : <IconX size="1rem" />
            });
            
            loadInvitations();
            if (onUpdate) onUpdate();
        } catch (error) {
            notifications.show({
                title: 'Error',
                message: `Failed to ${response} invitation`,
                color: 'red',
                icon: <IconX size="1rem" />
            });
        }
    };

    const handleDetailedResponse = (invitation) => {
        setSelectedInvitation(invitation);
        openResponseModal();
    };

    const handleCancelInvitation = async (invitation) => {
        try {
            if (invitation.status === 'pending') {
                // Cancel pending invitation
                await invitationApi.cancelInvitation(invitation.id);
                
                notifications.show({
                    title: 'Invitation Cancelled',
                    message: 'The invitation has been cancelled',
                    color: 'orange',
                    icon: <IconTrash size="1rem" />
                });
            } else if (invitation.status === 'accepted' && invitation.invitation_type === 'family_history_share') {
                // Revoke accepted family history share using invitation ID
                await invitationApi.revokeInvitation(invitation.id);
                
                notifications.show({
                    title: 'Access Revoked',
                    message: 'Family history sharing has been revoked',
                    color: 'orange',
                    icon: <IconTrash size="1rem" />
                });
            } else if (invitation.status === 'revoked') {
                // Already revoked - just show a message
                notifications.show({
                    title: 'Already Revoked',
                    message: 'This invitation has already been revoked',
                    color: 'gray',
                    icon: <IconTrash size="1rem" />
                });
            }
            
            loadInvitations();
            if (onUpdate) onUpdate();
        } catch (error) {
            notifications.show({
                title: 'Error',
                message: invitation.status === 'pending' ? 'Failed to cancel invitation' : 'Failed to revoke access',
                color: 'red',
                icon: <IconX size="1rem" />
            });
            console.error('Error handling invitation action:', error);
        }
    };

    const handleResponseModalSuccess = () => {
        closeResponseModal();
        setSelectedInvitation(null);
        loadInvitations();
        if (onUpdate) onUpdate();
    };


    // Organize invitations by status for tabs
    const getAllInvitations = () => {
        return [...pendingInvitations, ...sentInvitations];
    };

    const getPendingSentInvitations = () => {
        const allInvitations = getAllInvitations();
        return allInvitations.filter(inv => ['pending'].includes(inv.status));
    };

    const getAcceptedInvitations = () => {
        const allInvitations = getAllInvitations();
        return allInvitations.filter(inv => ['accepted'].includes(inv.status));
    };


    const EmptyState = ({ icon, title, description }) => (
        <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
            <ThemeIcon size="xl" color="gray" variant="light" mx="auto" mb="md">
                {icon}
            </ThemeIcon>
            <Text size="lg" fw={500} mb="xs">{title}</Text>
            <Text c="dimmed">{description}</Text>
        </Paper>
    );

    const pendingSentInvitations = getPendingSentInvitations();
    const acceptedInvitations = getAcceptedInvitations();
    
    console.log('DEBUG: Rendering invitations', { 
        pendingCount: pendingInvitations.length, 
        sentCount: sentInvitations.length,
        pendingSentCount: pendingSentInvitations.length,
        acceptedCount: acceptedInvitations.length,
        activeTab
    });

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
                        <ActionIcon onClick={loadInvitations} loading={loading} variant="light">
                            <IconRefresh size="1rem" />
                        </ActionIcon>
                    </Group>

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab 
                                value="pending_sent" 
                                leftSection={<IconMail size="0.8rem" />}
                                rightSection={
                                    <Badge size="sm" color="orange" variant="filled">
                                        {pendingSentInvitations.length}
                                    </Badge>
                                }
                            >
                                Pending
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="accepted" 
                                leftSection={<IconCheck size="0.8rem" />}
                                rightSection={
                                    <Badge size="sm" color="green" variant="filled">
                                        {acceptedInvitations.length}
                                    </Badge>
                                }
                            >
                                Accepted
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="pending_sent" pt="md">
                            {loading ? (
                                <Group justify="center" py="xl">
                                    <Loader size="sm" />
                                    <Text size="sm" c="dimmed">Loading invitations...</Text>
                                </Group>
                            ) : pendingSentInvitations.length > 0 ? (
                                <Stack gap="md">
                                    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                                        <Text size="sm">
                                            You have {pendingSentInvitations.length} pending invitation(s) waiting for response.
                                        </Text>
                                    </Alert>
                                    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                                        {pendingSentInvitations.map((invitation) => {
                                            // Determine if this is received or sent based on current user
                                            const isReceived = invitation.sent_to_user_id === undefined; // This will need to be fixed with actual user context
                                            return (
                                                <InvitationCard
                                                    key={invitation.id}
                                                    invitation={invitation}
                                                    variant={invitation.sent_by ? "received" : "sent"}
                                                    onRespond={(inv, response) => {
                                                        if (response === 'accepted') {
                                                            handleDetailedResponse(inv);
                                                        } else {
                                                            handleQuickResponse(inv, response);
                                                        }
                                                    }}
                                                    onCancel={handleCancelInvitation}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>
                                </Stack>
                            ) : (
                                <EmptyState
                                    icon={<IconMail size="2rem" />}
                                    title="No Pending Invitations"
                                    description="You're all caught up! New invitations will appear here."
                                />
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="accepted" pt="md">
                            {loading ? (
                                <Group justify="center" py="xl">
                                    <Loader size="sm" />
                                    <Text size="sm" c="dimmed">Loading accepted invitations...</Text>
                                </Group>
                            ) : acceptedInvitations.length > 0 ? (
                                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                                    {acceptedInvitations.map((invitation) => (
                                        <InvitationCard
                                            key={invitation.id}
                                            invitation={invitation}
                                            variant={invitation.sent_by ? "received" : "sent"}
                                            onCancel={handleCancelInvitation}
                                        />
                                    ))}
                                </SimpleGrid>
                            ) : (
                                <EmptyState
                                    icon={<IconCheck size="2rem" />}
                                    title="No Accepted Invitations"
                                    description="Accepted invitations will appear here."
                                />
                            )}
                        </Tabs.Panel>
                    </Tabs>

                    <Divider />

                    {/* Quick Actions */}
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                            {pendingSentInvitations.length} pending • {acceptedInvitations.length} accepted
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