/**
 * DesktopSidebar - Full sidebar for desktop screens (lg+ breakpoints)
 * Persistent sidebar with all menu items visible
 * 
 * Following PR #3: Navigation & Layout System specifications
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Stack, Group, Text, Divider, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconLogout } from '@tabler/icons-react';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import './DesktopSidebar.css';

const DesktopSidebar = ({
  isOpen,
  onToggle,
  currentPath,
  menuItems = [],
  userInfo,
  onLogout,
  className = ''
}) => {
  // Create responsive Mantine components
  const ResponsiveBox = ResponsiveComponentFactory.createMantine(Box, {
    w: isOpen ? { lg: 280, xl: 300 } : { lg: 60, xl: 60 },
    miw: isOpen ? { lg: 280, xl: 300 } : { lg: 60, xl: 60 },
    h: '100vh',
    p: isOpen ? { lg: 'md', xl: 'lg' } : { lg: 'xs', xl: 'sm' }
  });

  const ResponsiveStack = ResponsiveComponentFactory.createMantine(Stack, {
    spacing: { lg: 'sm', xl: 'md' }
  });

  // Check if current path matches menu item
  const isActivePath = (itemPath, exact = false) => {
    if (exact) {
      return currentPath === itemPath;
    }
    return currentPath.includes(itemPath);
  };

  return (
    <ResponsiveBox
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
        borderRight: '1px solid var(--mantine-color-gray-3)',
        backgroundColor: 'white',
        transition: 'all 0.3s ease',
        zIndex: 100
      }}
    >
      <ResponsiveStack h="100%" justify="space-between">
        {/* Header Section */}
        <Stack spacing="xs">
          <Group justify="space-between" align="center">
            {isOpen && (
              <Text size="lg" fw={700} c="blue">
                🔧 Admin
              </Text>
            )}
            <UnstyledButton 
              onClick={onToggle}
              style={{
                padding: '8px',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-gray-2)'
                }
              }}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isOpen ? 
                <IconChevronLeft size={16} /> : 
                <IconChevronRight size={16} />
              }
            </UnstyledButton>
          </Group>
          
          {isOpen && <Divider />}

          {/* Navigation Menu */}
          <Stack spacing="lg">
            {menuItems.map((section, sectionIndex) => (
              <Stack key={sectionIndex} spacing="xs">
                {isOpen && (
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="xs">
                    {section.section}
                  </Text>
                )}
                
                <Stack spacing="xs">
                  {section.items.map((item, itemIndex) => (
                    <UnstyledButton
                      key={itemIndex}
                      component={Link}
                      to={item.path}
                      className={`nav-item ${
                        isActivePath(item.path, item.exact) ? 'active' : ''
                      }`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isOpen ? '12px' : '0',
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        padding: isOpen ? '12px 16px' : '12px 8px',
                        borderRadius: '6px',
                        color: isActivePath(item.path, item.exact) 
                          ? 'var(--mantine-color-blue-6)' 
                          : 'var(--mantine-color-gray-7)',
                        backgroundColor: isActivePath(item.path, item.exact)
                          ? 'var(--mantine-color-blue-0)'
                          : 'transparent',
                        '&:hover': {
                          backgroundColor: isActivePath(item.path, item.exact)
                            ? 'var(--mantine-color-blue-1)'
                            : 'var(--mantine-color-gray-1)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                      title={!isOpen ? item.label : undefined}
                    >
                      <span style={{ fontSize: '16px' }}>{item.icon}</span>
                      {isOpen && (
                        <Text size="sm" fw={500}>
                          {item.label}
                        </Text>
                      )}
                    </UnstyledButton>
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>

        {/* Footer Section */}
        <Stack spacing="xs">
          {isOpen && <Divider />}
          
          {/* User Info */}
          {userInfo && (
            <Group justify={isOpen ? 'space-between' : 'center'} align="center">
              {isOpen && (
                <Stack spacing={0}>
                  <Text size="sm" fw={500}>
                    {userInfo.fullName || userInfo.username}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {userInfo.role}
                  </Text>
                </Stack>
              )}
            </Group>
          )}

          {/* Logout Button */}
          {onLogout && (
            <UnstyledButton
              onClick={onLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isOpen ? '12px' : '0',
                justifyContent: isOpen ? 'flex-start' : 'center',
                padding: isOpen ? '12px 16px' : '12px 8px',
                borderRadius: '6px',
                color: 'var(--mantine-color-red-6)',
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-red-0)'
                },
                transition: 'all 0.2s ease'
              }}
              title={!isOpen ? 'Logout' : undefined}
              aria-label="Logout"
            >
              <IconLogout size={16} />
              {isOpen && (
                <Text size="sm" fw={500}>
                  Logout
                </Text>
              )}
            </UnstyledButton>
          )}
        </Stack>
      </ResponsiveStack>
    </ResponsiveBox>
  );
};

export default DesktopSidebar;