/**
 * TabletSidebar - Collapsible sidebar for tablet screens (md breakpoint)
 * Shows with overlay when expanded, collapsible with toggle button
 * 
 * Following PR #3: Navigation & Layout System specifications
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Stack, Group, Text, Divider, UnstyledButton, Overlay } from '@mantine/core';
import { IconX, IconLogout } from '@tabler/icons-react';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import NavigationToggle from './NavigationToggle';
import './TabletSidebar.css';

const TabletSidebar = ({
  isOpen,
  onToggle,
  onClose,
  onLinkClick,
  currentPath,
  menuItems = [],
  userInfo,
  onLogout,
  className = ''
}) => {
  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Create responsive Mantine components
  const ResponsiveBox = ResponsiveComponentFactory.createMantine(Box, {
    w: { md: 280 },
    h: '100vh',
    p: { md: 'md' }
  });

  const ResponsiveStack = ResponsiveComponentFactory.createMantine(Stack, {
    spacing: { md: 'sm' }
  });

  // Check if current path matches menu item
  const isActivePath = (itemPath, exact = false) => {
    if (exact) {
      return currentPath === itemPath;
    }
    return currentPath.includes(itemPath);
  };

  // Handle link click with navigation callback
  const handleLinkClickInternal = (path) => {
    if (onLinkClick) {
      onLinkClick(path);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <NavigationToggle 
        isOpen={isOpen} 
        onToggle={onToggle}
        className="tablet-navigation-toggle"
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1001,
          backgroundColor: 'white',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: '6px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      />

      {/* Overlay */}
      {isOpen && (
        <Overlay 
          opacity={0.6} 
          color="black" 
          onClick={onClose}
          style={{ zIndex: 999 }}
        />
      )}

      {/* Sidebar */}
      <ResponsiveBox
        className={`tablet-sidebar ${isOpen ? 'open' : 'closed'} ${className}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000,
          backgroundColor: 'white',
          borderRight: '1px solid var(--mantine-color-gray-3)',
          boxShadow: '4px 0 12px rgba(0, 0, 0, 0.15)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        <ResponsiveStack h="100%" justify="space-between">
          {/* Header Section */}
          <Stack spacing="sm">
            <Group justify="space-between" align="center">
              <Text size="lg" fw={700} c="blue">
                🔧 Admin
              </Text>
              <UnstyledButton 
                onClick={onClose}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-gray-2)'
                  }
                }}
                aria-label="Close navigation"
              >
                <IconX size={20} />
              </UnstyledButton>
            </Group>
            
            <Divider />

            {/* Navigation Menu */}
            <Stack spacing="lg">
              {menuItems.map((section, sectionIndex) => (
                <Stack key={sectionIndex} spacing="xs">
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="xs">
                    {section.section}
                  </Text>
                  
                  <Stack spacing="xs">
                    {section.items.map((item, itemIndex) => (
                      <UnstyledButton
                        key={itemIndex}
                        component={Link}
                        to={item.path}
                        onClick={() => handleLinkClickInternal(item.path)}
                        className={`nav-item ${
                          isActivePath(item.path, item.exact) ? 'active' : ''
                        }`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px',
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
                      >
                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                        <Text size="sm" fw={500}>
                          {item.label}
                        </Text>
                      </UnstyledButton>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Stack>

          {/* Footer Section */}
          <Stack spacing="sm">
            <Divider />
            
            {/* User Info */}
            {userInfo && (
              <Group justify="space-between" align="center">
                <Stack spacing={0}>
                  <Text size="sm" fw={500}>
                    {userInfo.fullName || userInfo.username}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {userInfo.role}
                  </Text>
                </Stack>
              </Group>
            )}

            {/* Logout Button */}
            {onLogout && (
              <UnstyledButton
                onClick={onLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  color: 'var(--mantine-color-red-6)',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-red-0)'
                  },
                  transition: 'all 0.2s ease'
                }}
                aria-label="Logout"
              >
                <IconLogout size={16} />
                <Text size="sm" fw={500}>
                  Logout
                </Text>
              </UnstyledButton>
            )}
          </Stack>
        </ResponsiveStack>
      </ResponsiveBox>
    </>
  );
};

export default TabletSidebar;