import React from 'react';
import {
    Card,
    Group,
    Text,
    Badge,
    Stack,
    Button,
    ActionIcon,
    Alert,
    ThemeIcon,
    Menu,
    Tooltip,
    Paper
} from '@mantine/core';
import {
    IconUsers,
    IconCheck,
    IconX,
    IconTrash,
    IconDots,
    IconMessageCircle,
    IconCalendarEvent,
    IconAlertTriangle,
    IconClock,
    IconChevronRight
} from '@tabler/icons-react';
import { formatDateTime } from '../../utils/helpers';

const InvitationCard = ({ 
    invitation, 
    variant = 'received', // 'received' or 'sent'
    onRespond,
    onCancel,
    onView,
    compact = false
}) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'orange';
            case 'accepted': return 'green';
            case 'rejected': return 'red';
            case 'expired': return 'gray';
            case 'cancelled': return 'gray';
            default: return 'blue';
        }
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
                return <IconUsers size="1rem" />;
            case 'patient_share':
                return <IconUsers size="1rem" />;
            default:
                return <IconUsers size="1rem" />;
        }
    };

    const isExpired = invitation.expires_at && new Date(invitation.expires_at) < new Date();
    const isPending = invitation.status === 'pending' && !isExpired;

    if (compact) {
        return (
            <Paper 
                p="sm" 
                withBorder 
                style={{ 
                    cursor: onView ? 'pointer' : 'default',
                    opacity: isExpired ? 0.6 : 1
                }}
                onClick={onView}
            >
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                        <ThemeIcon color="blue" variant="light" size="sm">
                            {getInvitationIcon(invitation.invitation_type)}
                        </ThemeIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={500} size="sm" truncate>
                                {invitation.title}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                                {variant === 'received' ? 'From' : 'To'}: {
                                    variant === 'received' 
                                        ? invitation.sent_by?.name 
                                        : invitation.sent_to?.name
                                }
                            </Text>
                        </div>
                    </Group>
                    <Group gap="xs">
                        <Badge size="xs" color={getStatusColor(invitation.status)}>
                            {invitation.status}
                        </Badge>
                        {onView && <IconChevronRight size="0.8rem" color="var(--mantine-color-dimmed)" />}
                    </Group>
                </Group>
            </Paper>
        );
    }

    return (
        <Card shadow="sm" padding="md" radius="md" withBorder style={{ opacity: isExpired ? 0.6 : 1 }}>
            <Stack gap="sm">
                {/* Header */}
                <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                        <ThemeIcon color="blue" variant="light">
                            {getInvitationIcon(invitation.invitation_type)}
                        </ThemeIcon>
                        <div>
                            <Text fw={500} size="sm">
                                {invitation.title}
                            </Text>
                            <Text size="xs" c="dimmed">
                                {getInvitationTypeDisplay(invitation.invitation_type)}
                            </Text>
                        </div>
                    </Group>
                    <Group gap="xs">
                        <Badge color={getStatusColor(invitation.status)} variant="light">
                            {invitation.status}
                        </Badge>
                        {variant === 'sent' && invitation.status === 'pending' && (
                            <Menu shadow="md" width={150} position="bottom-end">
                                <Menu.Target>
                                    <ActionIcon variant="subtle" color="gray">
                                        <IconDots size="1rem" />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item 
                                        leftSection={<IconTrash size="0.9rem" />}
                                        color="red"
                                        onClick={() => onCancel && onCancel(invitation)}
                                    >
                                        Cancel
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        )}
                    </Group>
                </Group>

                {/* Message */}
                {invitation.message && (
                    <Alert icon={<IconMessageCircle />} color="blue" variant="light" p="sm">
                        <Text size="xs" style={{ fontStyle: 'italic' }}>
                            "{invitation.message}"
                        </Text>
                    </Alert>
                )}

                {/* Context Info */}
                {invitation.context_data && invitation.invitation_type === 'family_history_share' && (
                    <Group gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed">
                            Sharing: {invitation.context_data.family_member_name} ({invitation.context_data.family_member_relationship})
                        </Text>
                    </Group>
                )}

                {/* Timestamps */}
                <Group justify="space-between" align="center">
                    <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                            {variant === 'received' ? 'From' : 'To'}: {
                                variant === 'received' 
                                    ? invitation.sent_by?.name 
                                    : invitation.sent_to?.name
                            }
                        </Text>
                        <Group gap="xs">
                            <IconCalendarEvent size="0.7rem" />
                            <Text size="xs" c="dimmed">
                                {formatDateTime(invitation.created_at)}
                            </Text>
                        </Group>
                        {invitation.expires_at && (
                            <Group gap="xs">
                                <IconAlertTriangle size="0.7rem" />
                                <Text size="xs" c={isExpired ? 'red' : 'dimmed'}>
                                    {isExpired ? 'Expired' : 'Expires'}: {formatDateTime(invitation.expires_at)}
                                </Text>
                            </Group>
                        )}
                    </Stack>

                    {/* Action Buttons */}
                    {variant === 'received' && isPending && (
                        <Group gap="xs">
                            <Button
                                size="xs"
                                color="red"
                                variant="outline"
                                leftSection={<IconX size="0.8rem" />}
                                onClick={() => onRespond && onRespond(invitation, 'rejected')}
                            >
                                Reject
                            </Button>
                            <Button
                                size="xs"
                                color="green"
                                leftSection={<IconCheck size="0.8rem" />}
                                onClick={() => onRespond && onRespond(invitation, 'accepted')}
                            >
                                Accept
                            </Button>
                        </Group>
                    )}
                </Group>

                {/* Expired Warning */}
                {isExpired && (
                    <Alert icon={<IconClock />} color="red" variant="light">
                        <Text size="xs">
                            This invitation has expired and can no longer be responded to.
                        </Text>
                    </Alert>
                )}
            </Stack>
        </Card>
    );
};

export default InvitationCard;