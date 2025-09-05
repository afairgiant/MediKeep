/**
 * MobileDrawer - Full-screen drawer navigation for mobile (sm and xs breakpoints)
 * Full-screen overlay with hamburger menu trigger
 * 
 * Following PR #3: Navigation & Layout System specifications
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Drawer, Stack, Group, Text, Divider, UnstyledButton, ScrollArea, Button } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import { useResponsive } from '../../hooks/useResponsive';
import NavigationToggle from './NavigationToggle';
import './MobileDrawer.css';

const MobileDrawer = ({
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
  const responsive = useResponsive();

  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // Create responsive Mantine components
  const ResponsiveStack = ResponsiveComponentFactory.createMantine(Stack, {
    spacing: { xs: 'sm', sm: 'md' }
  });

  const ResponsiveText = ResponsiveComponentFactory.createMantine(Text, {
    size: { xs: 'md', sm: 'lg' }
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
      {/* Toggle Button - Fixed positioned */}
      <NavigationToggle 
        isOpen={isOpen} 
        onToggle={onToggle}
        className="mobile-navigation-toggle"
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1002,
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
        size="lg"
        variant="filled"
      />

      {/* Mobile Drawer */}
      <Drawer
        opened={isOpen}
        onClose={onClose}
        size="100%"
        position="left"
        withCloseButton={false}
        className={`mobile-drawer ${className}`}
        styles={{
          content: {
            display: 'flex',
            flexDirection: 'column'
          },
          body: {
            padding: responsive.breakpoint === 'xs' ? '16px' : '24px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        transitionProps={{ duration: 300 }}
      >
        <ResponsiveStack h="100%" justify="space-between">
          {/* Header Section */}
          <ScrollArea flex={1}>
            <ResponsiveStack spacing="lg">
              {/* App Title */}
              <Group justify="center" align="center" mt="xl">
                <ResponsiveText fw={700} c="blue" ta="center">
                  🔧 Admin Panel
                </ResponsiveText>
              </Group>
              
              <Divider />

              {/* Navigation Menu */}
              <ResponsiveStack spacing="xl">
                {menuItems.map((section, sectionIndex) => (
                  <ResponsiveStack key={sectionIndex} spacing="md">
                    <ResponsiveText 
                      size="sm" 
                      fw={600} 
                      c="dimmed" 
                      tt="uppercase" 
                      ta="center"
                      px="xs"
                    >
                      {section.section}
                    </ResponsiveText>
                    
                    <ResponsiveStack spacing="sm">
                      {section.items.map((item, itemIndex) => (
                        <UnstyledButton
                          key={itemIndex}
                          component={Link}
                          to={item.path}
                          onClick={() => handleLinkClickInternal(item.path)}
                          className={`mobile-nav-item ${
                            isActivePath(item.path, item.exact) ? 'active' : ''
                          }`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: responsive.breakpoint === 'xs' ? '16px 12px' : '20px 16px',
                            borderRadius: '8px',
                            color: isActivePath(item.path, item.exact) 
                              ? 'var(--mantine-color-blue-6)' 
                              : 'var(--mantine-color-gray-7)',
                            backgroundColor: isActivePath(item.path, item.exact)
                              ? 'var(--mantine-color-blue-0)'
                              : 'transparent',
                            border: isActivePath(item.path, item.exact)
                              ? '2px solid var(--mantine-color-blue-3)'
                              : '2px solid transparent',
                            '&:hover': {
                              backgroundColor: isActivePath(item.path, item.exact)
                                ? 'var(--mantine-color-blue-1)'
                                : 'var(--mantine-color-gray-1)'
                            },
                            transition: 'all 0.2s ease',
                            minHeight: '64px'
                          }}
                        >
                          <span style={{ fontSize: responsive.breakpoint === 'xs' ? '24px' : '28px' }}>
                            {item.icon}
                          </span>
                          <ResponsiveText 
                            size={responsive.breakpoint === 'xs' ? 'sm' : 'md'} 
                            fw={500}
                            ta="center"
                          >
                            {item.label}
                          </ResponsiveText>
                        </UnstyledButton>
                      ))}
                    </ResponsiveStack>
                  </ResponsiveStack>
                ))}
              </ResponsiveStack>
            </ResponsiveStack>
          </ScrollArea>

          {/* Footer Section */}
          <ResponsiveStack spacing="md" mt="md">
            <Divider />
            
            {/* User Info */}
            {userInfo && (
              <Group justify="center" align="center">
                <ResponsiveStack spacing={0} align="center">
                  <ResponsiveText fw={500} ta="center">
                    {userInfo.fullName || userInfo.username}
                  </ResponsiveText>
                  <Text size="sm" c="dimmed" ta="center">
                    {userInfo.role}
                  </Text>
                </ResponsiveStack>
              </Group>
            )}

            {/* Logout Button */}
            {onLogout && (
              <Button
                onClick={onLogout}
                leftSection={<IconLogout size={18} />}
                variant="light"
                color="red"
                size={responsive.breakpoint === 'xs' ? 'md' : 'lg'}
                fullWidth
                style={{ marginBottom: '16px' }}
              >
                Logout
              </Button>
            )}
          </ResponsiveStack>
        </ResponsiveStack>
      </Drawer>
    </>
  );
};

export default MobileDrawer;