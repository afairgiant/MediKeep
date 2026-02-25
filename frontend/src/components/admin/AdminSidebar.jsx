import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  IconDatabase,
  IconUsers,
  IconDeviceFloppy,
  IconHeartRateMonitor,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import './AdminSidebar.css';

const NAV_SECTIONS = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Overview', icon: IconChartBar, path: '/admin', exact: true },
    ],
  },
  {
    label: 'Data Management',
    items: [
      { label: 'Data Models', icon: IconDatabase, path: '/admin/data-models' },
      { label: 'Manage Users', icon: IconUsers, path: '/admin/models/user' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Backup Management', icon: IconDeviceFloppy, path: '/admin/backup' },
      { label: 'System Health', icon: IconHeartRateMonitor, path: '/admin/system-health' },
      { label: 'Settings', icon: IconSettings, path: '/admin/settings' },
    ],
  },
];

const isActive = (currentPath, item) => {
  if (item.exact) return currentPath === item.path;
  return currentPath.includes(item.path);
};

const AdminSidebar = ({ isOpen, onToggle, currentPath }) => {
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
        aria-label="Admin navigation"
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
              <Text fw={600} size="lg">Admin</Text>
            </Group>
          )}
          <ActionIcon
            variant="subtle"
            onClick={() => onToggle?.()}
            aria-label="Toggle sidebar"
            size="lg"
          >
            {isOpen ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}
          </ActionIcon>
        </Group>

        <ScrollArea h="calc(100vh - 70px)" px={isOpen ? 'xs' : 0} py="md">
          <Stack gap="lg">
            {NAV_SECTIONS.map((section) => (
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
                    const active = isActive(currentPath, item);
                    const Icon = item.icon;

                    if (!isOpen) {
                      return (
                        <Tooltip
                          key={item.path}
                          label={item.label}
                          position="right"
                          withArrow
                        >
                          <ActionIcon
                            component={Link}
                            to={item.path}
                            onClick={closeSidebar}
                            variant={active ? 'light' : 'subtle'}
                            color={active ? 'blue' : 'gray'}
                            size="lg"
                            aria-current={active ? 'page' : undefined}
                            style={{ margin: '2px auto' }}
                          >
                            <Icon size={18} />
                          </ActionIcon>
                        </Tooltip>
                      );
                    }

                    return (
                      <NavLink
                        key={item.path}
                        component={Link}
                        to={item.path}
                        label={item.label}
                        leftSection={<Icon size={18} />}
                        active={active}
                        onClick={closeSidebar}
                        aria-current={active ? 'page' : undefined}
                        variant="light"
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
