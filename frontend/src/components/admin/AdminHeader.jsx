import { useState } from 'react';
import PropTypes from 'prop-types';
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
  const { t } = useTranslation(['admin', 'shared']);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/admin/data-models?q=${encodeURIComponent(trimmed)}`);
    setSearchQuery('');
  };

  const handleSearchKeyDown = e => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleLogout = () => onLogout?.();
  const handleToggleSidebar = () => onToggleSidebar?.();
  const goToDashboard = () => navigate('/dashboard');
  const returnLabel = t('header.returnToDashboard', 'Return to Dashboard');
  const logoutLabel = t('header.logout', 'Logout');

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
          <Text
            fw={600}
            size="xl"
            style={{ whiteSpace: 'nowrap' }}
            visibleFrom="sm"
          >
            {t('header.title', 'Medical Records Admin')}
          </Text>
          <Text
            fw={600}
            size="xl"
            style={{ whiteSpace: 'nowrap' }}
            hiddenFrom="sm"
          >
            {t('shared:labels.admin', 'Admin')}
          </Text>
        </Group>

        <Box style={{ flex: 1, maxWidth: 500 }} mx="md" visibleFrom="sm">
          <TextInput
            placeholder={t(
              'header.searchPlaceholder',
              'Search records, users, or data...'
            )}
            value={searchQuery}
            onChange={e => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label={t('header.searchAriaLabel', 'Search data models')}
            leftSection={<IconSearch size={16} />}
            rightSection={
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleSearch}
                aria-label={t('common:buttons.search', 'Search')}
              >
                <IconSearch size={14} />
              </ActionIcon>
            }
          />
        </Box>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label={returnLabel}>
            <Button
              variant="default"
              size="compact-sm"
              leftSection={<IconArrowLeft size={14} />}
              onClick={goToDashboard}
              title={returnLabel}
              visibleFrom="md"
            >
              {t('shared:labels.dashboard', 'Dashboard')}
            </Button>
          </Tooltip>

          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={goToDashboard}
            aria-label={returnLabel}
            hiddenFrom="md"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>

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
              {t('shared:labels.admin', 'Admin')}
            </Badge>
            <Text size="sm" fw={500}>
              {user?.username || t('header.administrator', 'Administrator')}
            </Text>
            <Avatar size="sm" radius="xl" color="blue">
              <IconUser size={14} />
            </Avatar>
          </Group>

          <Tooltip
            label={t('header.switchToMode', 'Switch to {{mode}} mode', {
              mode:
                theme === 'light'
                  ? t('shared.dark', 'dark')
                  : t('shared.light', 'light'),
            })}
          >
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={toggleTheme}
              title={t('header.switchToMode', 'Switch to {{mode}} mode', {
                mode:
                  theme === 'light'
                    ? t('shared.dark', 'dark')
                    : t('shared.light', 'light'),
              })}
            >
              {theme === 'light' ? (
                <IconMoon size={18} />
              ) : (
                <IconSun size={18} />
              )}
            </ActionIcon>
          </Tooltip>

          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconLogout size={14} />}
            onClick={handleLogout}
            title={logoutLabel}
            visibleFrom="sm"
          >
            {logoutLabel}
          </Button>

          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={handleLogout}
            aria-label={logoutLabel}
            hiddenFrom="sm"
          >
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
};

AdminHeader.propTypes = {
  user: PropTypes.shape({ username: PropTypes.string }),
  onLogout: PropTypes.func,
  onToggleSidebar: PropTypes.func,
};

export default AdminHeader;
