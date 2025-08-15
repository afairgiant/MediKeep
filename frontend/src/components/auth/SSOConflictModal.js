import React, { useState } from 'react';
import { Button, Modal, Group, Text, Stack, Card, Badge, Alert } from '@mantine/core';
import { IconInfoCircle, IconLink, IconUserPlus, IconX } from '@tabler/icons-react';

const SSOConflictModal = ({ 
  conflictData, 
  isOpen, 
  onResolve, 
  isLoading = false 
}) => {
  const [selectedAction, setSelectedAction] = useState(null);

  const handleResolve = () => {
    if (selectedAction && onResolve) {
      // Set preference based on action
      let preference;
      if (selectedAction === 'link') {
        preference = 'auto_link';
      } else if (selectedAction === 'never_link') {
        preference = 'create_separate';
      } else if (selectedAction === 'ask_again') {
        preference = 'always_ask';
      }
      
      onResolve({
        action: selectedAction === 'link' ? 'link' : 'create_separate',
        preference: preference,
        tempToken: conflictData?.temp_token
      });
    }
  };

  if (!conflictData) return null;

  const { existing_user_info, sso_user_info } = conflictData;

  return (
    <Modal
      opened={isOpen}
      onClose={() => {}} // Prevent closing - user must make a choice
      title="Account Already Exists"
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack spacing="md">
        <Alert icon={<IconInfoCircle size="1rem" />} title="Account Already Exists">
          We found an existing account with the email address <strong>{existing_user_info?.email}</strong>.
          Please choose how you want to handle this. <strong>This choice is permanent.</strong>
        </Alert>

        {/* Existing Account Info */}
        <Card withBorder padding="md">
          <Text size="sm" weight={500} mb="xs">Existing Account</Text>
          <Stack spacing="xs">
            <Group>
              <Text size="sm" color="dimmed">Email:</Text>
              <Text size="sm">{existing_user_info?.email}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">Username:</Text>
              <Text size="sm">{existing_user_info?.username}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">Full Name:</Text>
              <Text size="sm">{existing_user_info?.full_name}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">Current Login:</Text>
              <Badge variant="light" color="blue">
                {existing_user_info?.auth_method === 'local' ? 'Password Only' : 
                 existing_user_info?.auth_method === 'hybrid' ? 'Password + SSO' : 
                 existing_user_info?.auth_method}
              </Badge>
            </Group>
            {existing_user_info?.created_at && (
              <Group>
                <Text size="sm" color="dimmed">Created:</Text>
                <Text size="sm">{new Date(existing_user_info.created_at).toLocaleDateString()}</Text>
              </Group>
            )}
          </Stack>
        </Card>

        {/* SSO Account Info */}
        <Card withBorder padding="md">
          <Text size="sm" weight={500} mb="xs">SSO Account</Text>
          <Stack spacing="xs">
            <Group>
              <Text size="sm" color="dimmed">Provider:</Text>
              <Badge variant="light" color="green">
                {sso_user_info?.provider?.toUpperCase()}
              </Badge>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">Email:</Text>
              <Text size="sm">{sso_user_info?.email}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">Name:</Text>
              <Text size="sm">{sso_user_info?.name}</Text>
            </Group>
          </Stack>
        </Card>

        {/* Action Selection */}
        <Stack spacing="sm">
          <Text weight={500} size="sm">Choose what to do:</Text>
          
          <Card 
            withBorder 
            padding="md" 
            style={{ 
              cursor: 'pointer',
              border: selectedAction === 'link' ? '2px solid #228be6' : undefined 
            }}
            onClick={() => setSelectedAction('link')}
          >
            <Group>
              <IconLink size="1.5rem" color="#228be6" />
              <div>
                <Text weight={500}>Link Accounts (Permanent)</Text>
                <Text size="sm" color="dimmed">
                  <strong>Permanently</strong> connect your {sso_user_info?.provider} account to your existing account. 
                  You'll be able to log in using either your password or {sso_user_info?.provider}. 
                  This action cannot be undone.
                </Text>
              </div>
            </Group>
          </Card>

          <Card 
            withBorder 
            padding="md" 
            style={{ 
              cursor: 'pointer',
              border: selectedAction === 'never_link' ? '2px solid #228be6' : undefined 
            }}
            onClick={() => setSelectedAction('never_link')}
          >
            <Group>
              <IconX size="1.5rem" color="#fa5252" />
              <div>
                <Text weight={500}>Create New Separate Account</Text>
                <Text size="sm" color="dimmed">
                  Create a brand new account and patient record for your SSO login. 
                  Your existing account will remain completely separate.
                </Text>
              </div>
            </Group>
          </Card>

          <Card 
            withBorder 
            padding="md" 
            style={{ 
              cursor: 'pointer',
              border: selectedAction === 'ask_again' ? '2px solid #228be6' : undefined 
            }}
            onClick={() => setSelectedAction('ask_again')}
          >
            <Group>
              <IconUserPlus size="1.5rem" color="#228be6" />
              <div>
                <Text weight={500}>Ask Me Each Time</Text>
                <Text size="sm" color="dimmed">
                  Keep accounts separate for now, but show me this choice again 
                  if I try to use SSO with this email in the future.
                </Text>
              </div>
            </Group>
          </Card>
        </Stack>

        {/* Future Behavior Info */}
        {selectedAction && (
          <Alert color="blue" variant="light">
            <Text size="sm">
              {selectedAction === 'link' && (
                <>
                  <strong>Future logins:</strong> With linked accounts, you'll be able to log in using either your password or {sso_user_info?.provider} without seeing this prompt again.
                </>
              )}
              {selectedAction === 'never_link' && (
                <>
                  <strong>Result:</strong> A new account and patient record will be created for your {sso_user_info?.provider} login. You'll have two completely separate accounts with the same email address.
                </>
              )}
              {selectedAction === 'ask_again' && (
                <>
                  <strong>Future logins:</strong> If you try to sign in with {sso_user_info?.provider} using this email again, you'll see this choice dialog again.
                </>
              )}
            </Text>
          </Alert>
        )}

        {/* Action Buttons */}
        <Group position="right" mt="md">
          <Button 
            onClick={handleResolve}
            disabled={!selectedAction}
            loading={isLoading}
            color={selectedAction === 'link' ? 'orange' : selectedAction === 'never_link' ? 'red' : undefined}
          >
            {selectedAction === 'link' ? 'Permanently Link Accounts' : 
             selectedAction === 'never_link' ? 'Create New Separate Account' :
             selectedAction === 'ask_again' ? 'Keep Separate - Ask Again Later' : 'Continue'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default SSOConflictModal;