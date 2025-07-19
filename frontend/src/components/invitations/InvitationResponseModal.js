import React, { useState } from 'react';
import {
    Modal,
    Stack,
    Group,
    Text,
    Textarea,
    Button,
    Alert,
    ThemeIcon,
    Badge,
    Divider,
    Paper,
    Title,
    List,
    LoadingOverlay
} from '@mantine/core';
import {
    IconInfoCircle,
    IconUsers,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconMessageCircle,
    IconCalendarEvent
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import invitationApi from '../../services/api/invitationApi';
import { formatDateTime } from '../../utils/helpers';

const InvitationResponseModal = ({ 
    opened, 
    onClose, 
    invitation, 
    onSuccess 
}) => {
    const [loading, setLoading] = useState(false);
    const [responseNote, setResponseNote] = useState('');
    const [selectedResponse, setSelectedResponse] = useState(null);

    const handleResponse = async (response) => {
        if (!invitation) return;
        
        try {
            setLoading(true);
            const result = await invitationApi.respondToInvitation(
                invitation.id, 
                response, 
                responseNote.trim() || null
            );
            
            notifications.show({
                title: `Invitation ${response}`,
                message: result.message,
                color: response === 'accepted' ? 'green' : 'orange',
                icon: response === 'accepted' ? <IconCheck size="1rem" /> : <IconX size="1rem" />
            });
            
            // Clear form
            setResponseNote('');
            setSelectedResponse(null);
            
            // Callback for parent to refresh data
            if (onSuccess) {
                onSuccess();
            }
            
            onClose();
        } catch (error) {
            notifications.show({
                title: `Failed to ${response} invitation`,
                message: error.response?.data?.detail || error.message,
                color: 'red',
                icon: <IconX size="1rem" />
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setResponseNote('');
        setSelectedResponse(null);
        onClose();
    };

    const getInvitationTypeDisplay = (type) => {
        switch (type) {
            case 'family_history_share':
                return 'Family History Share';
            case 'patient_share':
                return 'Patient Record Share';
            case 'family_join':
                return 'Family Group Invitation';
            default:
                return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const getInvitationIcon = (type) => {
        switch (type) {
            case 'family_history_share':
                return <IconUsers size="1.2rem" />;
            case 'patient_share':
                return <IconUsers size="1.2rem" />;
            default:
                return <IconUsers size="1.2rem" />;
        }
    };

    const getContextDetails = (invitation) => {
        if (!invitation?.context_data) return null;
        
        const { context_data } = invitation;
        
        switch (invitation.invitation_type) {
            case 'family_history_share':
                return (
                    <Stack gap="xs">
                        <Text size="sm" fw={500}>Sharing Details:</Text>
                        <List size="sm" spacing="xs">
                            <List.Item>
                                <Text span fw={500}>Family Member:</Text> {context_data.family_member_name}
                            </List.Item>
                            <List.Item>
                                <Text span fw={500}>Relationship:</Text> {context_data.family_member_relationship}
                            </List.Item>
                            <List.Item>
                                <Text span fw={500}>Access Level:</Text> {context_data.permission_level}
                            </List.Item>
                            {context_data.sharing_note && (
                                <List.Item>
                                    <Text span fw={500}>Note:</Text> {context_data.sharing_note}
                                </List.Item>
                            )}
                        </List>
                    </Stack>
                );
            default:
                return (
                    <Text size="sm" c="dimmed">
                        Additional details available after acceptance
                    </Text>
                );
        }
    };

    if (!invitation) return null;

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title="Invitation Response"
            size="md"
            centered
        >
            <LoadingOverlay visible={loading} />
            
            <Stack gap="md">
                {/* Invitation Header */}
                <Paper p="md" bg="gray.0" radius="md">
                    <Group gap="sm" mb="sm">
                        <ThemeIcon color="blue" variant="light" size="lg">
                            {getInvitationIcon(invitation.invitation_type)}
                        </ThemeIcon>
                        <div style={{ flex: 1 }}>
                            <Text fw={500} size="lg">{invitation.title}</Text>
                            <Group gap="xs" mt="xs">
                                <Badge variant="light" color="blue">
                                    {getInvitationTypeDisplay(invitation.invitation_type)}
                                </Badge>
                                <Badge variant="light" color="orange">
                                    {invitation.status}
                                </Badge>
                            </Group>
                        </div>
                    </Group>
                    
                    <Text size="sm" c="dimmed" mb="sm">
                        From: {invitation.sent_by?.name} ({invitation.sent_by?.email})
                    </Text>
                    
                    <Text size="sm" c="dimmed">
                        <IconCalendarEvent size="0.9rem" style={{ marginRight: 4 }} />
                        Sent: {formatDateTime(invitation.created_at)}
                    </Text>
                    
                    {invitation.expires_at && (
                        <Text size="sm" c="dimmed">
                            <IconAlertTriangle size="0.9rem" style={{ marginRight: 4 }} />
                            Expires: {formatDateTime(invitation.expires_at)}
                        </Text>
                    )}
                </Paper>

                {/* Invitation Message */}
                {invitation.message && (
                    <Alert icon={<IconMessageCircle />} color="blue" variant="light">
                        <Text size="sm" style={{ fontStyle: 'italic' }}>
                            "{invitation.message}"
                        </Text>
                    </Alert>
                )}

                {/* Context Details */}
                {getContextDetails(invitation) && (
                    <Paper p="md" withBorder>
                        {getContextDetails(invitation)}
                    </Paper>
                )}

                <Divider />

                {/* Response Note */}
                <Textarea
                    label="Response Note (Optional)"
                    placeholder="Add a note with your response..."
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    rows={3}
                    description="This note will be visible to the sender"
                />

                {/* Action Buttons */}
                <Group justify="flex-end" gap="sm">
                    <Button 
                        variant="subtle" 
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    
                    <Button 
                        color="red" 
                        variant="outline"
                        onClick={() => handleResponse('rejected')}
                        disabled={loading}
                        leftSection={<IconX size="1rem" />}
                    >
                        Reject
                    </Button>
                    
                    <Button 
                        color="green" 
                        onClick={() => handleResponse('accepted')}
                        disabled={loading}
                        leftSection={<IconCheck size="1rem" />}
                    >
                        Accept
                    </Button>
                </Group>

                {/* Additional Info */}
                <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                    <Text size="xs">
                        Once you respond, the sender will be notified and this invitation will be marked as {selectedResponse || 'responded to'}.
                    </Text>
                </Alert>
            </Stack>
        </Modal>
    );
};

export default InvitationResponseModal;