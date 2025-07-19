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
    TextInput,
    Select
} from '@mantine/core';
import {
    IconMail,
    IconSend,
    IconCheck,
    IconX,
    IconUsers,
    IconInfoCircle,
    IconRefresh,
    IconFilter,
    IconSearch,
    IconTrash,
    IconClock
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import invitationApi from '../../services/api/invitationApi';
import InvitationCard from './InvitationCard';
import InvitationResponseModal from './InvitationResponseModal';

const InvitationManager = ({ opened, onClose, onUpdate }) => {
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [sentInvitations, setSentInvitations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedInvitation, setSelectedInvitation] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
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
            console.log('DEBUG: Loaded invitations', { pending, sent });
            setPendingInvitations(pending);
            setSentInvitations(sent);
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
            await invitationApi.cancelInvitation(invitation.id);
            
            notifications.show({
                title: 'Invitation Cancelled',
                message: 'The invitation has been cancelled',
                color: 'orange',
                icon: <IconTrash size="1rem" />
            });
            
            loadInvitations();
            if (onUpdate) onUpdate();
        } catch (error) {
            notifications.show({
                title: 'Error',
                message: 'Failed to cancel invitation',
                color: 'red',
                icon: <IconX size="1rem" />
            });
        }
    };

    const handleResponseModalSuccess = () => {
        closeResponseModal();
        setSelectedInvitation(null);
        loadInvitations();
        if (onUpdate) onUpdate();
    };

    const filterInvitations = (invitations) => {
        let filtered = invitations;

        // Filter by type
        if (filterType) {
            filtered = filtered.filter(inv => inv.invitation_type === filterType);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(inv => 
                inv.title.toLowerCase().includes(term) ||
                inv.message?.toLowerCase().includes(term) ||
                (activeTab === 'pending' ? inv.sent_by?.name : inv.sent_to?.name)?.toLowerCase().includes(term)
            );
        }

        return filtered;
    };

    const getInvitationTypeOptions = () => {
        const allInvitations = [...pendingInvitations, ...sentInvitations];
        const types = [...new Set(allInvitations.map(inv => inv.invitation_type))];
        
        return types.map(type => ({
            value: type,
            label: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        }));
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

    const filteredPending = filterInvitations(pendingInvitations);
    const filteredSent = filterInvitations(sentInvitations);
    
    console.log('DEBUG: Rendering invitations', { 
        pendingCount: pendingInvitations.length, 
        sentCount: sentInvitations.length,
        filteredPendingCount: filteredPending.length,
        filteredSentCount: filteredSent.length,
        filterType,
        searchTerm,
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
                    {/* Filters */}
                    <Group justify="space-between">
                        <Group gap="sm">
                            <TextInput
                                placeholder="Search invitations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftSection={<IconSearch size="1rem" />}
                                style={{ minWidth: 200 }}
                            />
                            <Select
                                placeholder="Filter by type"
                                value={filterType}
                                onChange={setFilterType}
                                data={[
                                    { value: '', label: 'All Types' },
                                    ...getInvitationTypeOptions()
                                ]}
                                leftSection={<IconFilter size="1rem" />}
                                clearable
                            />
                        </Group>
                        <ActionIcon onClick={loadInvitations} loading={loading}>
                            <IconRefresh size="1rem" />
                        </ActionIcon>
                    </Group>

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab 
                                value="pending" 
                                leftSection={<IconMail size="0.8rem" />}
                                rightSection={
                                    <Badge size="sm" color="orange" variant="filled">
                                        {filteredPending.length}
                                    </Badge>
                                }
                            >
                                Pending
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="sent" 
                                leftSection={<IconSend size="0.8rem" />}
                                rightSection={
                                    <Badge size="sm" color="blue" variant="filled">
                                        {filteredSent.length}
                                    </Badge>
                                }
                            >
                                Sent
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="pending" pt="md">
                            {loading ? (
                                <Group justify="center" py="xl">
                                    <Loader size="sm" />
                                    <Text size="sm" c="dimmed">Loading invitations...</Text>
                                </Group>
                            ) : filteredPending.length > 0 ? (
                                <Stack gap="md">
                                    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                                        <Text size="sm">
                                            You have {filteredPending.length} pending invitation(s) waiting for your response.
                                        </Text>
                                    </Alert>
                                    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                                        {filteredPending.map((invitation) => (
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
                                </Stack>
                            ) : (
                                <EmptyState
                                    icon={<IconMail size="2rem" />}
                                    title="No Pending Invitations"
                                    description="You're all caught up! New invitations will appear here."
                                />
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="sent" pt="md">
                            {loading ? (
                                <Group justify="center" py="xl">
                                    <Loader size="sm" />
                                    <Text size="sm" c="dimmed">Loading sent invitations...</Text>
                                </Group>
                            ) : filteredSent.length > 0 ? (
                                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                                    {filteredSent.map((invitation) => (
                                        <InvitationCard
                                            key={invitation.id}
                                            invitation={invitation}
                                            variant="sent"
                                            onCancel={handleCancelInvitation}
                                        />
                                    ))}
                                </SimpleGrid>
                            ) : (
                                <EmptyState
                                    icon={<IconClock size="2rem" />}
                                    title="No Sent Invitations"
                                    description="Invitations you send will appear here."
                                />
                            )}
                        </Tabs.Panel>
                    </Tabs>

                    <Divider />

                    {/* Quick Actions */}
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                            {pendingInvitations.length} pending • {sentInvitations.length} sent
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