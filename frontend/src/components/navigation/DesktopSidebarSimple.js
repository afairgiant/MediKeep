/**
 * DesktopSidebarSimple - Simplified desktop sidebar without ResponsiveComponentFactory
 * For debugging Firefox compatibility issues
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Stack, Group, Text, Divider, UnstyledButton, Button } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconLogout } from '@tabler/icons-react';
import './DesktopSidebar.css';

const DesktopSidebarSimple = ({
  isOpen = true,
  onToggle,
  currentPath,
  menuItems = [],
  userInfo,
  onLogout,
  className = ''
}) => {
  // Simple active path check
  const isActivePath = (itemPath) => {
    return currentPath && currentPath.includes(itemPath);
  };

  return (
    <Box
      component="nav"
      role="navigation"
      aria-label="Main navigation"
      className={`desktop-sidebar ${isOpen ? 'open' : 'collapsed'} ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: isOpen ? '280px' : '60px',
        borderRight: '1px solid #dee2e6',
        backgroundColor: 'white',
        transition: 'width 0.3s ease',
        zIndex: 100,
        padding: '16px',
        overflowY: 'auto',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <Stack h="100%" justify="space-between">
        {/* Header Section */}
        <Stack spacing="xs">
          <Group justify="space-between" align="center">
            {isOpen && (
              <Text size="lg" fw={700} c="blue">
                Admin Panel
              </Text>
            )}
            <UnstyledButton onClick={onToggle} title={isOpen ? 'Collapse' : 'Expand'}>
              {isOpen ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
            </UnstyledButton>
          </Group>

          <Divider my="sm" />

          {/* Navigation Menu */}
          <Stack spacing="xs">
            {/* If no menu items, show default items */}
            {menuItems.length === 0 ? (
              <>
                <Link 
                  to="/admin" 
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: isActivePath('/admin') ? '#228be6' : '#495057',
                    backgroundColor: isActivePath('/admin') ? '#e7f5ff' : 'transparent',
                    fontWeight: isActivePath('/admin') ? 600 : 400,
                    display: 'block'
                  }}
                >
                  {isOpen ? 'Dashboard' : 'D'}
                </Link>
                <Link 
                  to="/admin/data-models" 
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: isActivePath('/data-models') ? '#228be6' : '#495057',
                    backgroundColor: isActivePath('/data-models') ? '#e7f5ff' : 'transparent',
                    fontWeight: isActivePath('/data-models') ? 600 : 400,
                    display: 'block'
                  }}
                >
                  {isOpen ? 'Data Models' : 'M'}
                </Link>
                <Link 
                  to="/admin/create-user" 
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: isActivePath('/create-user') ? '#228be6' : '#495057',
                    backgroundColor: isActivePath('/create-user') ? '#e7f5ff' : 'transparent',
                    fontWeight: isActivePath('/create-user') ? 600 : 400,
                    display: 'block'
                  }}
                >
                  {isOpen ? 'Create User' : 'U'}
                </Link>
                <Link 
                  to="/admin/system-health" 
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: isActivePath('/system-health') ? '#228be6' : '#495057',
                    backgroundColor: isActivePath('/system-health') ? '#e7f5ff' : 'transparent',
                    fontWeight: isActivePath('/system-health') ? 600 : 400,
                    display: 'block'
                  }}
                >
                  {isOpen ? 'System Health' : 'H'}
                </Link>
              </>
            ) : (
              /* Render provided menu items */
              menuItems.map((section, idx) => (
                <Stack key={idx} spacing="xs">
                  {isOpen && section.section && (
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                      {section.section}
                    </Text>
                  )}
                  {section.items && section.items.map((item, itemIdx) => (
                    <Link
                      key={itemIdx}
                      to={item.path}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        color: isActivePath(item.path) ? '#228be6' : '#495057',
                        backgroundColor: isActivePath(item.path) ? '#e7f5ff' : 'transparent',
                        fontWeight: isActivePath(item.path) ? 600 : 400,
                        display: 'block'
                      }}
                    >
                      {isOpen ? item.label : item.label.charAt(0)}
                    </Link>
                  ))}
                </Stack>
              ))
            )}
          </Stack>
        </Stack>

        {/* Footer Section */}
        <Stack spacing="xs">
          <Divider />
          
          {/* User info */}
          {userInfo && (
            <Box px="xs" py="sm">
              {isOpen ? (
                <>
                  <Text size="sm" fw={500}>{userInfo.full_name || userInfo.username}</Text>
                  <Text size="xs" c="dimmed">@{userInfo.username}</Text>
                </>
              ) : (
                <Text size="lg" fw={500}>{(userInfo.full_name || userInfo.username).charAt(0).toUpperCase()}</Text>
              )}
            </Box>
          )}

          {/* Logout button */}
          {onLogout && (
            <Button
              onClick={onLogout}
              variant="subtle"
              color="red"
              fullWidth={isOpen}
              size="sm"
              leftSection={isOpen ? <IconLogout size={16} /> : null}
              style={{ justifyContent: isOpen ? 'flex-start' : 'center' }}
            >
              {isOpen ? 'Logout' : <IconLogout size={16} />}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default DesktopSidebarSimple;