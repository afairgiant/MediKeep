import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  NavLink,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Group,
  Overlay,
  ThemeIcon,
} from '@mantine/core';
import {
  IconTool,
  IconChartBar,
  IconTrendingUp,
  IconDatabase,
  IconUsers,
  IconTrash,
  IconFileText,
  IconDeviceFloppy,
  IconHeartRateMonitor,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import './AdminSidebar.css';

const getNavSections = (t) => [
  {
    label: t('sidebar.sections.dashboard', 'Dashboard'),
    items: [
      { label: t('sidebar.items.overview', 'Overview'), icon: IconChartBar, path: '/admin', exact: true },
      { label: t('sidebar.items.analytics', 'Analytics'), icon: IconTrendingUp, path: '/admin/analytics' },
    ],
  },
  {
    label: t('sidebar.sections.dataManagement', 'Data Management'),
    items: [
      { label: t('sidebar.items.dataModels', 'Data Models'), icon: IconDatabase, path: '/admin/data-models' },
      { label: t('sidebar.items.userManagement', 'User Management'), icon: IconUsers, path: '/admin/users' },
      { label: t('sidebar.items.trash', 'Trash'), icon: IconTrash, path: '/admin/trash' },
    ],
  },
  {
    label: t('sidebar.sections.monitoring', 'Monitoring'),
    items: [
      { label: t('sidebar.items.auditLog', 'Audit Log'), icon: IconFileText, path: '/admin/audit-log' },
      { label: t('sidebar.items.systemHealth', 'System Health'), icon: IconHeartRateMonitor, path: '/admin/system-health' },
    ],
  },
  {
    label: t('sidebar.sections.tools', 'Tools'),
    items: [
      { label: t('sidebar.items.backupManagement', 'Backup Management'), icon: IconDeviceFloppy, path: '/admin/backup' },
      { label: t('sidebar.items.maintenance', 'Maintenance'), icon: IconTool, path: '/admin/tools' },
      { label: t('sidebar.items.settings', 'Settings'), icon: IconSettings, path: '/admin/settings' },
    ],
  },
];

const isActive = (currentPath, item) => {
  if (item.exact) return currentPath === item.path;
  return currentPath.includes(item.path);
};

const AdminSidebar = ({ isOpen, onToggle, currentPath }) => {
  const { t } = useTranslation('admin');
  const sections = useMemo(() => getNavSections(t), [t]);

  const closeSidebar = () => {
    if (isOpen) onToggle?.();
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isOpen) onToggle?.();
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onToggle]);

  return (
    <>
      {isOpen && (
        <Overlay
          className="mobile-sidebar-backdrop"
          onClick={closeSidebar}
          backgroundOpacity={0.5}
          zIndex={999}
        />
      )}

      <Box
        component="nav"
        aria-label={t('sidebar.adminNavigation', 'Admin navigation')}
        className={`admin-sidebar ${isOpen ? 'open' : 'closed'}`}
      >
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ minHeight: 70, borderBottom: '1px solid var(--mantine-color-default-border)' }}
          wrap="nowrap"
        >
          {isOpen && (
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon variant="light" size="md" color="blue">
                <IconTool size={16} />
              </ThemeIcon>
              <Text fw={600} size="lg">{t('sidebar.title', 'Admin')}</Text>
            </Group>
          )}
          <ActionIcon
            variant="subtle"
            onClick={() => onToggle?.()}
            aria-label={t('sidebar.toggleSidebar', 'Toggle sidebar')}
            size="lg"
          >
            {isOpen ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}
          </ActionIcon>
        </Group>

        <ScrollArea h="calc(100vh - 70px)" px={isOpen ? 'xs' : 0} py="md">
          <Stack gap="lg">
            {sections.map((section) => (
              <Box key={section.label}>
                {isOpen && (
                  <Text
                    size="xs"
                    tt="uppercase"
                    fw={500}
                    c="dimmed"
                    px="sm"
                    mb="xs"
                    style={{ letterSpacing: '1px' }}
                  >
                    {section.label}
                  </Text>
                )}
                <Stack gap={2}>
                  {section.items.map((item) => {
                    const active = !item.disabled && isActive(currentPath, item);
                    const Icon = item.icon;

                    if (!isOpen) {
                      return (
                        <Tooltip
                          key={item.path}
                          label={item.disabled ? t('sidebar.comingSoon', '{{label}} (Coming Soon)', { label: item.label }) : item.label}
                          position="right"
                          withArrow
                        >
                          <ActionIcon
                            component={item.disabled ? 'button' : Link}
                            to={item.disabled ? undefined : item.path}
                            onClick={item.disabled ? undefined : closeSidebar}
                            variant={active ? 'light' : 'subtle'}
                            color={active ? 'blue' : 'gray'}
                            size="lg"
                            aria-current={active ? 'page' : undefined}
                            disabled={item.disabled}
                            style={{ margin: '2px auto', opacity: item.disabled ? 0.5 : 1 }}
                          >
                            <Icon size={18} />
                          </ActionIcon>
                        </Tooltip>
                      );
                    }

                    return (
                      <NavLink
                        key={item.path}
                        component={item.disabled ? 'button' : Link}
                        to={item.disabled ? undefined : item.path}
                        label={item.label}
                        leftSection={<Icon size={18} />}
                        active={active}
                        disabled={item.disabled}
                        onClick={item.disabled ? undefined : closeSidebar}
                        aria-current={active ? 'page' : undefined}
                        variant="light"
                        style={item.disabled ? { opacity: 0.5 } : undefined}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Box>
    </>
  );
};

export default AdminSidebar;
