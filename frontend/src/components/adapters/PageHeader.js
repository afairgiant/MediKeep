import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Group,
  Button,
  Title,
  ActionIcon,
  Text,
  Flex,
  Box,
  Divider,
  Menu,
  Burger,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconMenu2,
  IconChevronDown,
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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
  showNavigation = true,
  ...props
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [navOpened, setNavOpened] = useState(false);

  // Check if user is admin
  const isAdmin = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || '';
        return (
          userRole.toLowerCase() === 'admin' ||
          userRole.toLowerCase() === 'administrator'
        );
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
    return false;
  };

  // Navigation items organized by category
  const navigationSections = [
    {
      title: 'Core',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: '🏥' },
        { name: 'Patient Info', path: '/patients/me', icon: '👤' },
      ],
    },
    {
      title: 'Medical Records',
      items: [
        { name: 'Medications', path: '/medications', icon: '💊' },
        { name: 'Lab Results', path: '/lab-results', icon: '🧪' },
        { name: 'Conditions', path: '/conditions', icon: '🏥' },
        { name: 'Allergies', path: '/allergies', icon: '⚠️' },
        { name: 'Vital Signs', path: '/vitals', icon: '❤️' },
      ],
    },
    {
      title: 'Care & Treatment',
      items: [
        { name: 'Treatments', path: '/treatments', icon: '🩺' },
        { name: 'Procedures', path: '/procedures', icon: '⚕️' },
        { name: 'Immunizations', path: '/immunizations', icon: '💉' },
        { name: 'Visit History', path: '/visits', icon: '📅' },
      ],
    },
    {
      title: 'Providers',
      items: [
        { name: 'Practitioners', path: '/practitioners', icon: '👨‍⚕️' },
        { name: 'Pharmacies', path: '/pharmacies', icon: '🏪' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { name: 'Export Records', path: '/export', icon: '📤' },
        { name: 'Settings', path: '/settings', icon: '⚙️' },
      ],
    },
  ];

  // Add admin section if user is admin
  if (isAdmin()) {
    navigationSections.push({
      title: 'Administration',
      items: [
        { name: 'Admin Dashboard', path: '/admin', icon: '🔧' },
        { name: 'Data Models', path: '/admin/data-models', icon: '🗄️' },
        { name: 'Backup Management', path: '/admin/backup', icon: '💾' },
        { name: 'System Health', path: '/admin/system-health', icon: '🔍' },
      ],
    });
  }

  const isCurrentPath = path => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  const handleNavigation = path => {
    navigate(path);
    setNavOpened(false);
  };

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
        showNavigation={showNavigation}
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
    <>
      <Box
        className={className}
        style={{
          marginBottom: '1rem',
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
                <Text size="xl" style={{ lineHeight: 1, flexShrink: 0 }}>
                  {icon}
                </Text>
              )}
              <Title
                order={2}
                size="h2"
                ta="center"
                style={{
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 1,
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

                  {/* Navigation Dropdowns */}
                  {showNavigation && (
                    <Group gap="xs">
                      {navigationSections
                        .filter(section => section.title !== 'Administration') // Exclude admin section
                        .map((section, sectionIndex) => (
                          <Menu
                            key={sectionIndex}
                            position="bottom-start"
                            offset={5}
                          >
                            <Menu.Target>
                              <Button
                                variant="subtle"
                                color="gray"
                                rightSection={<IconChevronDown size={14} />}
                                size="sm"
                              >
                                {section.title}
                              </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Label>{section.title}</Menu.Label>
                              {section.items.map((item, itemIndex) => (
                                <Menu.Item
                                  key={itemIndex}
                                  leftSection={
                                    <Text size="sm">{item.icon}</Text>
                                  }
                                  onClick={() => handleNavigation(item.path)}
                                  style={{
                                    backgroundColor: isCurrentPath(item.path)
                                      ? 'var(--mantine-color-blue-light)'
                                      : undefined,
                                    fontWeight: isCurrentPath(item.path)
                                      ? 600
                                      : 400,
                                  }}
                                >
                                  {item.name}
                                </Menu.Item>
                              ))}
                            </Menu.Dropdown>
                          </Menu>
                        ))}
                    </Group>
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
    </>
  );
};

export default PageHeader;
