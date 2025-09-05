/**
 * ResponsiveNavigation Test Page
 * For manually testing navigation behavior across different breakpoints
 */

import React, { useState } from 'react';
import { Container, Title, Text, Group, Button, Paper, Stack, Code, Badge } from '@mantine/core';
import ResponsiveNavigation from '../../components/navigation/ResponsiveNavigation';
import { useResponsive } from '../../hooks/useResponsive';
import { createMockUser } from '../../test-utils/test-data';

const ResponsiveNavigationTest = () => {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const responsive = useResponsive();
  const mockUser = createMockUser();

  // Mock navigation items for testing
  const navigationItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/patients', label: 'Patients', icon: 'users' },
    { to: '/medications', label: 'Medications', icon: 'pill' },
    { to: '/lab-results', label: 'Lab Results', icon: 'flask' },
    { to: '/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/practitioners', label: 'Practitioners', icon: 'user-md' },
    { to: '/settings', label: 'Settings', icon: 'cog' },
    { to: '/help', label: 'Help', icon: 'question-circle' }
  ];

  const handleNavigationToggle = () => {
    setIsNavigationOpen(!isNavigationOpen);
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navigation Component */}
      <ResponsiveNavigation
        user={mockUser}
        navigationItems={navigationItems}
        isOpen={isNavigationOpen}
        onToggle={handleNavigationToggle}
        currentPath="/test"
      />

      {/* Main Content */}
      <div
        style={{
          marginLeft: responsive.isAbove('md') || responsive.matches('lg') ? '280px' : '0',
          transition: 'margin-left 0.3s ease',
          padding: responsive.isMobile ? '60px 16px 16px' : '16px',
          minHeight: '100vh'
        }}
      >
        <Container size="lg">
          <Stack spacing="md">
            <Title order={1}>ResponsiveNavigation Test Page</Title>
            
            <Text>
              This page allows you to test the ResponsiveNavigation component across different breakpoints.
              Resize your browser window or use browser developer tools to simulate different screen sizes.
            </Text>

            {/* Current Responsive State */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">Current Responsive State</Title>
              <Group spacing="sm">
                <Badge color="blue">Breakpoint: {responsive.breakpoint}</Badge>
                <Badge color="green">Width: {responsive.width}px</Badge>
                <Badge color="orange">Device: {responsive.deviceType}</Badge>
                <Badge color={responsive.isMobile ? 'red' : 'gray'}>
                  Mobile: {responsive.isMobile ? 'Yes' : 'No'}
                </Badge>
                <Badge color={responsive.isTablet ? 'yellow' : 'gray'}>
                  Tablet: {responsive.isTablet ? 'Yes' : 'No'}
                </Badge>
                <Badge color={responsive.isDesktop ? 'teal' : 'gray'}>
                  Desktop: {responsive.isDesktop ? 'Yes' : 'No'}
                </Badge>
              </Group>
            </Paper>

            {/* Navigation Control */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">Navigation Control</Title>
              <Group spacing="md">
                <Button 
                  onClick={handleNavigationToggle}
                  variant={isNavigationOpen ? "filled" : "outline"}
                >
                  {isNavigationOpen ? 'Close Navigation' : 'Open Navigation'}
                </Button>
                <Badge color={isNavigationOpen ? 'green' : 'red'}>
                  Navigation: {isNavigationOpen ? 'Open' : 'Closed'}
                </Badge>
              </Group>
            </Paper>

            {/* Test Instructions */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">Test Instructions</Title>
              <Stack spacing="sm">
                <Text>1. <strong>Mobile (xs, sm):</strong> Should show hamburger menu and drawer navigation</Text>
                <Text>2. <strong>Tablet (md):</strong> Should show collapsible sidebar with overlay</Text>
                <Text>3. <strong>Desktop (lg+):</strong> Should show fixed sidebar with collapse button</Text>
                <Text>4. Test the toggle button to open/close navigation at each breakpoint</Text>
                <Text>5. Verify smooth transitions between different screen sizes</Text>
              </Stack>
            </Paper>

            {/* Responsive Breakpoints Reference */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">Responsive Breakpoints Reference</Title>
              <Stack spacing="xs">
                <Code>xs: 0-575px (Extra Small - Mobile Portrait)</Code>
                <Code>sm: 576-767px (Small - Mobile Landscape)</Code>
                <Code>md: 768-1023px (Medium - Tablet)</Code>
                <Code>lg: 1024-1279px (Large - Desktop)</Code>
                <Code>xl: 1280px+ (Extra Large - Wide Desktop)</Code>
              </Stack>
            </Paper>

            {/* Navigation Items Debug */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">Navigation Items</Title>
              <Text size="sm">Testing with {navigationItems.length} navigation items:</Text>
              <Stack spacing="xs" mt="sm">
                {navigationItems.map((item, index) => (
                  <Code key={index} size="sm">
                    {item.to} - {item.label} ({item.icon})
                  </Code>
                ))}
              </Stack>
            </Paper>

            {/* User Info Debug */}
            <Paper p="md" withBorder>
              <Title order={3} mb="sm">User Information</Title>
              <Code>
                {JSON.stringify(mockUser, null, 2)}
              </Code>
            </Paper>
          </Stack>
        </Container>
      </div>
    </div>
  );
};

export default ResponsiveNavigationTest;