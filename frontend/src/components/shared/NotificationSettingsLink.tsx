import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Anchor, VisuallyHidden } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { settingsTabPath } from '../../constants/settingsTabs';

interface NotificationSettingsLinkProps {
  children: ReactNode;
}

/** Opens the notification settings in a new tab, so an unsaved form on this page survives. */
const NotificationSettingsLink = ({
  children,
}: NotificationSettingsLinkProps) => {
  const { t } = useTranslation('common');

  return (
    <Anchor
      href={settingsTabPath('notifications')}
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      inline
    >
      {children}{' '}
      <IconExternalLink
        size={14}
        aria-hidden="true"
        style={{ verticalAlign: 'middle' }}
      />
      <VisuallyHidden>
        {t('labels.opensInNewTab', '(opens in new tab)')}
      </VisuallyHidden>
    </Anchor>
  );
};

export default NotificationSettingsLink;
