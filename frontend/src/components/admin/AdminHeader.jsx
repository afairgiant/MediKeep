import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Group,
  TextInput,
  ActionIcon,
  Button,
  Badge,
  Avatar,
  Tooltip,
  Box,
  Text,
} from '@mantine/core';
import {
  IconMenu2,
  IconSearch,
  IconArrowLeft,
  IconUser,
  IconMoon,
  IconSun,
  IconLogout,
} from '@tabler/icons-react';
import './AdminHeader.css';

const AdminHeader = ({ user, onLogout, onToggleSidebar }) => {
  const { t } = useTranslation('admin');
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/admin/data-models?q=${encodeURIComponent(trimmed)}`);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleLogout = () => onLogout?.();
  const handleToggleSidebar = () => onToggleSidebar?.();

  return (
    <Box
      component="header"
      className="admin-header"
      px="md"
      style={{
        height: 70,
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group h="100%" justify="space-between" wrap="nowrap" gap="md">
        <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
          <ActionIcon
            className="sidebar-toggle-btn"
            variant="filled"
            size="lg"
            onClick={handleToggleSidebar}
            aria-label={t('sidebar.toggleSidebar', 'Toggle sidebar')}
          >
            <IconMenu2 size={20} />
          </ActionIcon>
          <Text fw={600} size="xl" style={{ whiteSpace: 'nowrap' }}>
            {t('header.title', 'Medical Records Admin')}
          </Text>
        </Group>

        <Box style={{ flex: 1, maxWidth: 500 }} mx="md" visibleFrom="sm">
          <TextInput
            placeholder={t('header.searchPlaceholder', 'Search records, users, or data...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label={t('header.searchAriaLabel', 'Search data models')}
            leftSection={<IconSearch size={16} />}
            rightSection={
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleSearch}
                aria-label="Search"
              >
                <IconSearch size={14} />
              </ActionIcon>
            }
          />
        </Box>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label={t('header.returnToDashboard', 'Return to Dashboard')}>
            <Button
              variant="default"
              size="compact-sm"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate('/dashboard')}
              title={t('header.returnToDashboard', 'Return to Dashboard')}
              visibleFrom="md"
            >
              {t('header.dashboard', 'Dashboard')}
            </Button>
          </Tooltip>

          <Group
            gap="xs"
            px="sm"
            py={4}
            wrap="nowrap"
            visibleFrom="lg"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <Badge size="sm" variant="light" color="green">
              {t('header.adminBadge', 'Admin')}
            </Badge>
            <Text size="sm" fw={500}>
              {user?.username || t('header.administrator', 'Administrator')}
            </Text>
            <Avatar size="sm" radius="xl" color="blue">
              <IconUser size={14} />
            </Avatar>
          </Group>

          <Tooltip label={t('header.switchToMode', 'Switch to {{mode}} mode', { mode: theme === 'light' ? t('shared.dark', 'dark') : t('shared.light', 'light') })}>
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={toggleTheme}
              title={t('header.switchToMode', 'Switch to {{mode}} mode', { mode: theme === 'light' ? t('shared.dark', 'dark') : t('shared.light', 'light') })}
            >
              {theme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </ActionIcon>
          </Tooltip>

          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconLogout size={14} />}
            onClick={handleLogout}
            title={t('header.logout', 'Logout')}
          >
            {t('header.logout', 'Logout')}
          </Button>
        </Group>
      </Group>
    </Box>
  );
};

export default AdminHeader;
