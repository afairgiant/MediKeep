import logger from '../../services/logger';

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
  IconLanguage,
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import LayoutPageHeader from '../layout/PageHeader';
import LanguageSwitcher from '../shared/LanguageSwitcher';

const PageHeader = ({
  useMantine = false,
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
  const { user, logout } = useAuth();
  const [navOpened, setNavOpened] = useState(false);

  // Check if user is admin
  const isAdmin = () => {
    // Removed frequent admin check logging for performance
    return user?.isAdmin || false;
  };

  // Navigation items organized by category
  const navigationSections = [
    {
      title: 'Medical Records',
      items: [
        { name: 'Patient Info', path: '/patients/me', icon: '👤' },
        { name: 'Allergies', path: '/allergies', icon: '⚠️' },
        { name: 'Conditions', path: '/conditions', icon: '🏥' },
        { name: 'Lab Results', path: '/lab-results', icon: '🧪' },
        { name: 'Medications', path: '/medications', icon: '💊' },
        { name: 'Procedures', path: '/procedures', icon: '⚕️' },
        { name: 'Treatments', path: '/treatments', icon: '🩺' },
        { name: 'Vital Signs', path: '/vitals', icon: '❤️' },
      ],
    },
    {
      title: 'Prevention & History',
      items: [
        { name: 'Family History', path: '/family-history', icon: '👪' },
        { name: 'Immunizations', path: '/immunizations', icon: '💉' },
        { name: 'Visit History', path: '/visits', icon: '📅' },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Emergency Contacts', path: '/emergency-contacts', icon: '🆘' },
        { name: 'Insurance', path: '/insurance', icon: '💳' },
        { name: 'Pharmacies', path: '/pharmacies', icon: '🏪' },
        { name: 'Practitioners', path: '/practitioners', icon: '👨‍⚕️' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { name: 'Tag Management', path: '/tools/tags', icon: '🏷️' },
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
      <LayoutPageHeader
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

  const handleLogout = async () => {
    logger.info('🚪 PAGEHEADER_LOGOUT: Logout button clicked, starting logout process');
    try {
      logger.info('🚪 PAGEHEADER_LOGOUT: Calling AuthContext logout function');
      // Use AuthContext logout for proper state management
      await logout();
      logger.info('🚪 PAGEHEADER_LOGOUT: AuthContext logout completed successfully');
      // Navigation will be handled by AuthContext/ProtectedRoute
    } catch (error) {
      logger.info('🚪 PAGEHEADER_LOGOUT: Logout failed with error', error.message);
      // Fallback navigation if logout fails
      window.location.href = '/login';
    }
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

                  {/* Account Actions Dropdown */}
                  <Menu position="bottom-end" offset={5}>
                    <Menu.Target>
                      <Button
                        variant="subtle"
                        color="blue"
                        rightSection={<IconChevronDown size={14} />}
                        size="sm"
                      >
                        Account
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>User Actions</Menu.Label>
                      <Menu.Item
                        leftSection={<IconSettings size="1rem" />}
                        onClick={() => navigate('/settings')}
                      >
                        Settings
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconLanguage size="1rem" />}
                        closeMenuOnClick={false}
                      >
                        <Group gap="xs">
                          <Text size="sm">Language:</Text>
                          <LanguageSwitcher size="xs" />
                        </Group>
                      </Menu.Item>
                      <Menu.Item
                        leftSection={
                          theme === 'dark' ? (
                            <IconSun size="1rem" />
                          ) : (
                            <IconMoon size="1rem" />
                          )
                        }
                        onClick={toggleTheme}
                      >
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconLogout size="1rem" />}
                        onClick={handleLogout}
                        color="red"
                      >
                        Logout
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
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
