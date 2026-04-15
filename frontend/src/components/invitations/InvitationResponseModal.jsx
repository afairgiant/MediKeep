import { useState } from 'react';
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
  LoadingOverlay,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconUsers,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconMessageCircle,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import invitationApi from '../../services/api/invitationApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import { renderFamilyHistoryContextDetails } from '../../utils/invitationUtils';

const InvitationResponseModal = ({
  opened,
  onClose,
  invitation,
  onSuccess,
}) => {
  const { t } = useTranslation(['invitations', 'shared']);
  const { formatDateTime } = useDateFormat();
  const [loading, setLoading] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [selectedResponse, setSelectedResponse] = useState(null);

  const handleResponse = async response => {
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
        icon:
          response === 'accepted' ? (
            <IconCheck size="1rem" />
          ) : (
            <IconX size="1rem" />
          ),
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
        icon: <IconX size="1rem" />,
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

  const getInvitationTypeDisplay = type => {
    switch (type) {
      case 'family_history_share':
        return t('response.familyHistoryShare');
      case 'patient_share':
        return t('response.patientRecordShare');
      case 'family_join':
        return t('response.familyGroupInvitation');
      default:
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getInvitationIcon = type => {
    switch (type) {
      case 'family_history_share':
        return <IconUsers size="1.2rem" />;
      case 'patient_share':
        return <IconUsers size="1.2rem" />;
      default:
        return <IconUsers size="1.2rem" />;
    }
  };

  const getContextDetails = invitation => {
    // Use utility function for family history invitations
    const familyHistoryDetails = renderFamilyHistoryContextDetails(invitation);
    if (familyHistoryDetails) {
      return familyHistoryDetails;
    }

    // Default fallback for other invitation types
    return (
      <Text size="sm" c="dimmed">
        {t('response.additionalDetails')}
      </Text>
    );
  };

  if (!invitation) return null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t('response.title')}
      size="md"
      centered
    >
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        {/* Invitation Header */}
        <Paper p="md" bg="var(--color-bg-secondary)" radius="md">
          <Group gap="sm" mb="sm">
            <ThemeIcon color="blue" variant="light" size="lg">
              {getInvitationIcon(invitation.invitation_type)}
            </ThemeIcon>
            <div style={{ flex: 1 }}>
              <Text fw={500} size="lg">
                {invitation.title}
              </Text>
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
            {t('response.from', {
              name: invitation.sent_by?.name,
              email: invitation.sent_by?.email,
            })}
          </Text>

          <Text size="sm" c="dimmed">
            <IconCalendarEvent size="0.9rem" style={{ marginRight: 4 }} />
            {t('response.sent', {
              date: formatDateTime(invitation.created_at),
            })}
          </Text>

          {invitation.expires_at && (
            <Text size="sm" c="dimmed">
              <IconAlertTriangle size="0.9rem" style={{ marginRight: 4 }} />
              {t('manager.expires', {
                date: formatDateTime(invitation.expires_at),
              })}
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
          label={t('response.responseNote')}
          placeholder={t('response.notePlaceholder')}
          value={responseNote}
          onChange={e => setResponseNote(e.target.value)}
          rows={3}
          description={t('response.noteVisible')}
        />

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            {t('shared:fields.cancel')}
          </Button>

          <Button
            color="red"
            variant="outline"
            onClick={() => handleResponse('rejected')}
            disabled={loading}
            leftSection={<IconX size="1rem" />}
          >
            {t('response.reject')}
          </Button>

          <Button
            color="green"
            onClick={() => handleResponse('accepted')}
            disabled={loading}
            leftSection={<IconCheck size="1rem" />}
          >
            {t('response.accept')}
          </Button>
        </Group>

        {/* Additional Info */}
        <Alert icon={<IconInfoCircle />} color="blue" variant="light">
          <Text size="xs">{t('response.responseInfo')}</Text>
        </Alert>
      </Stack>
    </Modal>
  );
};

export default InvitationResponseModal;
