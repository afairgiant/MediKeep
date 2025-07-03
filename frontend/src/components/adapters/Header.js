import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Group,
  Button,
  Title,
  ActionIcon,
  Text,
  Flex,
  Box,
  Stack,
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconSettings,
  IconSun,
  IconMoon,
  IconLogout,
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import OldHeader from '../layout/Header';

const Header = ({
  useMantine = true,
  title,
  showBackButton = false,
  backPath = '/dashboard',
  actions = null,
  subtitle = null,
  showThemeToggle = true,
  ...props
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldHeader
        title={title}
        showBackButton={showBackButton}
        backPath={backPath}
        actions={actions}
        subtitle={subtitle}
        showThemeToggle={showThemeToggle}
        {...props}
      />
    );
  }

  const handleBack = () => {
    navigate(backPath);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    // Clear welcome box dismissal so it reappears on next login
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('welcomeBox_dismissed_')) {
        localStorage.removeItem(key);
      }
    });
    window.location.href = '/login';
  };

  return (
    <Box
      style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--mantine-color-gray-3)',
      }}
    >
      {/* Container to match page content width */}
      <Box
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 2rem',
        }}
      >
        {/* Compact Row Layout */}
        <Group justify="space-between" align="center" wrap="nowrap" gap="md">
          {/* Left Section - Back Button */}
          <Group gap="xs" align="center" style={{ minWidth: 'fit-content' }}>
            {showBackButton && (
              <Button
                variant="subtle"
                color="blue"
                size="sm"
                leftSection={<IconArrowLeft size="1rem" />}
                onClick={handleBack}
              >
                Back to Dashboard
              </Button>
            )}
          </Group>

          {/* Center - Title and Subtitle */}
          <Stack gap="xs" align="center" style={{ flex: 1 }}>
            <Title order={1} size="h1" ta="center" style={{ margin: 0 }}>
              {title}
            </Title>
            {subtitle && (
              <Text size="lg" c="dimmed" ta="center">
                {subtitle}
              </Text>
            )}
          </Stack>

          {/* Right Section - Actions */}
          <Group
            gap="xs"
            align="center"
            wrap="nowrap"
            style={{ minWidth: 'fit-content' }}
          >
            {actions}

            {(actions || showBackButton) && <Divider orientation="vertical" />}

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => navigate('/settings')}
              title="Settings"
              size="lg"
            >
              <IconSettings size="1.1rem" />
            </ActionIcon>

            {showThemeToggle && (
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                size="lg"
              >
                {theme === 'dark' ? (
                  <IconSun size="1.1rem" />
                ) : (
                  <IconMoon size="1.1rem" />
                )}
              </ActionIcon>
            )}

            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconLogout size="1rem" />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </Box>
    </Box>
  );
};

export default Header;
