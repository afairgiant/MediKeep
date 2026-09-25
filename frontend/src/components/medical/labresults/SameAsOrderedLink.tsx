import React from 'react';
import { ActionIcon, Group, Text } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SameAsOrderedLinkProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Small "Same as ordered date" action shown under a Completed Date input.
 * Styled to match the "New practitioner" link on the same forms.
 */
const SameAsOrderedLink: React.FC<SameAsOrderedLinkProps> = ({
  onClick,
  disabled = false,
}) => {
  const { t } = useTranslation(['labresults']);
  const label = t('labresults:completedDate.sameAsOrdered');

  return (
    <Group gap={4} mt={2}>
      <ActionIcon
        size="xs"
        variant="subtle"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
      >
        <IconCopy size={14} />
      </ActionIcon>
      <Text
        size="xs"
        c="dimmed"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={disabled ? undefined : onClick}
      >
        {label}
      </Text>
    </Group>
  );
};

export default SameAsOrderedLink;
