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
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import OldPageHeader from '../layout/PageHeader';

const PageHeader = ({
  useMantine = true,
  title,
  icon,
  showBackButton = true,
  backButtonText = '← Back to Dashboard',
  backButtonPath = '/dashboard',
  onBackClick,
  actions,
  className = '',
  variant = 'medical',
  showGlobalActions = true,
  ...props
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldPageHeader
        title={title}
        icon={icon}
        showBackButton={showBackButton}
        backButtonText={backButtonText}
        backButtonPath={backButtonPath}
        onBackClick={onBackClick}
        actions={actions}
        className={className}
        variant={variant}
        showGlobalActions={showGlobalActions}
        {...props}
      />
    );
  }

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
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

  const isDashboard = variant === 'dashboard';

  return (
    <Box
      className={className}
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
                onClick={handleBackClick}
              >
                {backButtonText.replace('← ', '')}
              </Button>
            )}
          </Group>

          {/* Center - Title */}
          <Group
            gap="xs"
            align="center"
            wrap="nowrap"
            justify="center"
            style={{ flex: 1 }}
          >
            {icon && (
              <Text size="xl" style={{ lineHeight: 1 }}>
                {icon}
              </Text>
            )}
            <Title
              order={2}
              size="h2"
              ta="center"
              style={{
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </Title>
          </Group>

          {/* Right Section - Actions and Global Nav */}
          <Group
            gap="xs"
            align="center"
            wrap="nowrap"
            style={{ minWidth: 'fit-content' }}
          >
            {/* Page-specific actions */}
            {actions}

            {/* Global navigation actions */}
            {showGlobalActions && (
              <Group gap="xs" align="center" wrap="nowrap">
                {(actions || showBackButton) && (
                  <Divider orientation="vertical" />
                )}

                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => navigate('/settings')}
                  title="Settings"
                  size="lg"
                >
                  <IconSettings size="1.1rem" />
                </ActionIcon>

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
            )}
          </Group>
        </Group>
      </Box>
    </Box>
  );
};

export default PageHeader;
