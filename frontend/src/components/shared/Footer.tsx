/**
 * Footer - Shared footer component
 * Displays copyright and GitHub link across all pages
 */

import React from 'react';
import { Box, Text, Anchor, Group } from '@mantine/core';
import { IconBrandGithub } from '@tabler/icons-react';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      className={`app-footer ${className}`}
      px="md"
      py="sm"
    >
      <Group justify="center" gap="xs">
        <Text size="sm" c="dimmed">
          © {currentYear} MediKeep
        </Text>
        <Text size="sm" c="dimmed">•</Text>
        <Anchor
          href="https://github.com/afairgiant/MediKeep"
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          c="dimmed"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <IconBrandGithub size={16} />
          GitHub
        </Anchor>
      </Group>
    </Box>
  );
};

export default Footer;
