import React, { useState } from 'react';
import { Button, Modal, Group, Text, Stack, Card, Badge, Alert } from '@mantine/core';
import { IconInfoCircle, IconLink, IconUserPlus, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatDateWithPreference } from '../../utils/dateFormatUtils';
import { timezoneService } from '../../services/timezoneService';

const SSOConflictModal = ({ 
  conflictData, 
  isOpen, 
  onResolve, 
  isLoading = false 
}) => {
  const { t } = useTranslation(['auth', 'shared']);
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
      title={t('sso.accountExists')}
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack spacing="md">
        <Alert icon={<IconInfoCircle size="1rem" />} title={t('sso.accountExists')}>
          <span dangerouslySetInnerHTML={{ __html: t('sso.accountExistsDescription', { email: existing_user_info?.email }) }} />
        </Alert>

        {/* Existing Account Info */}
        <Card withBorder padding="md">
          <Text size="sm" weight={500} mb="xs">{t('sso.existingAccount')}</Text>
          <Stack spacing="xs">
            <Group>
              <Text size="sm" color="dimmed">{t('shared:labels.email')}:</Text>
              <Text size="sm">{existing_user_info?.email}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">{t('shared:labels.username')}:</Text>
              <Text size="sm">{existing_user_info?.username}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">{t('shared:fields.fullName')}:</Text>
              <Text size="sm">{existing_user_info?.full_name}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">{t('sso.currentLogin')}:</Text>
              <Badge variant="light" color="blue">
                {existing_user_info?.auth_method === 'local' ? t('sso.passwordOnly') :
                 existing_user_info?.auth_method === 'hybrid' ? t('sso.passwordPlusSso') :
                 existing_user_info?.auth_method}
              </Badge>
            </Group>
            {existing_user_info?.created_at && (
              <Group>
                <Text size="sm" color="dimmed">{t('shared:labels.created')}:</Text>
                <Text size="sm">{formatDateWithPreference(existing_user_info.created_at, timezoneService.dateFormatCode)}</Text>
              </Group>
            )}
          </Stack>
        </Card>

        {/* SSO Account Info */}
        <Card withBorder padding="md">
          <Text size="sm" weight={500} mb="xs">{t('sso.ssoAccount')}</Text>
          <Stack spacing="xs">
            <Group>
              <Text size="sm" color="dimmed">{t('shared:labels.provider')}:</Text>
              <Badge variant="light" color="green">
                {sso_user_info?.provider?.toUpperCase()}
              </Badge>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">{t('shared:labels.email')}:</Text>
              <Text size="sm">{sso_user_info?.email}</Text>
            </Group>
            <Group>
              <Text size="sm" color="dimmed">{t('shared:labels.name')}:</Text>
              <Text size="sm">{sso_user_info?.name}</Text>
            </Group>
          </Stack>
        </Card>

        {/* Action Selection */}
        <Stack spacing="sm">
          <Text weight={500} size="sm">{t('sso.chooseAction')}</Text>
          
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
                <Text weight={500}>{t('sso.linkAccounts')}</Text>
                <Text size="sm" color="dimmed">
                  <span dangerouslySetInnerHTML={{ __html: t('sso.linkAccountsDescription', { provider: sso_user_info?.provider }) }} />
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
                <Text weight={500}>{t('sso.createSeparate')}</Text>
                <Text size="sm" color="dimmed">
                  {t('sso.createSeparateDescription')}
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
                <Text weight={500}>{t('sso.askMeEachTime')}</Text>
                <Text size="sm" color="dimmed">
                  {t('sso.askMeEachTimeDescription')}
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
                <span dangerouslySetInnerHTML={{ __html: t('sso.futureLoginLink', { provider: sso_user_info?.provider }) }} />
              )}
              {selectedAction === 'never_link' && (
                <span dangerouslySetInnerHTML={{ __html: t('sso.resultCreateSeparate', { provider: sso_user_info?.provider }) }} />
              )}
              {selectedAction === 'ask_again' && (
                <span dangerouslySetInnerHTML={{ __html: t('sso.futureLoginAskAgain', { provider: sso_user_info?.provider }) }} />
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
            {selectedAction === 'link' ? t('sso.permanentlyLinkAccounts') :
             selectedAction === 'never_link' ? t('sso.createSeparate') :
             selectedAction === 'ask_again' ? t('sso.keepSeparate') : t('sso.continue')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default SSOConflictModal;