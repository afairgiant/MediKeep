import React, { useMemo } from 'react';
import { Box, Text, Group, Badge, Stack } from '@mantine/core';
import { useResponsive } from '../hooks/useResponsive';

/**
 * ResponsiveTest Component
 * Simple test component to verify the responsive system is working
 * Shows current breakpoint, dimensions, and device type
 */
function ResponsiveTest() {
  const {
    breakpoint,
    width,
    height,
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isPortrait,
    isTouch,
    isAbove,
    isBelow,
    matches
  } = useResponsive();

  return (
    <Box
      p="md"
      style={{
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}
    >
      <Stack spacing="sm">
        <Text size="lg" weight={600}>
          📱 Responsive System Test
        </Text>
        
        <Group spacing="md">
          <Badge variant="filled" color="blue">
            {breakpoint}
          </Badge>
          <Badge variant="outline" color="gray">
            {deviceType}
          </Badge>
          <Text size="sm">
            {width} × {height}px
          </Text>
        </Group>

        <Group spacing="xs">
          {isMobile && <Badge color="green">Mobile</Badge>}
          {isTablet && <Badge color="orange">Tablet</Badge>}
          {isDesktop && <Badge color="blue">Desktop</Badge>}
          {isLandscape && <Badge variant="outline">Landscape</Badge>}
          {isPortrait && <Badge variant="outline">Portrait</Badge>}
          {isTouch && <Badge variant="outline">Touch</Badge>}
        </Group>

        <Stack spacing={4}>
          <Text size="sm" color="dimmed">Breakpoint Tests:</Text>
          <Group spacing="xs">
            <Text size="xs">
              Above sm: {isAbove('sm') ? '✅' : '❌'}
            </Text>
            <Text size="xs">
              Below lg: {isBelow('lg') ? '✅' : '❌'}
            </Text>
            <Text size="xs">
              Matches {breakpoint}: {matches(breakpoint) ? '✅' : '❌'}
            </Text>
          </Group>
        </Stack>

        {/* Visual breakpoint indicator */}
        <Box
          style={INDICATOR_STYLES}
        >
          <Text
            size="xs"
            style={useMemo(() => ({
              position: 'absolute',
              top: '-18px',
              left: `${((BREAKPOINT_POSITIONS[breakpoint] || 0) * 100)}%`,
              transform: 'translateX(-50%)',
              fontWeight: 600
            }), [breakpoint])}
          >
            ↓ {breakpoint}
          </Text>
        </Box>

        <Group spacing="xs">
          <Text size="xs" color="dimmed">xs</Text>
          <Text size="xs" color="dimmed">sm</Text>
          <Text size="xs" color="dimmed">md</Text>
          <Text size="xs" color="dimmed">lg</Text>
          <Text size="xs" color="dimmed">xl</Text>
          <Text size="xs" color="dimmed">xxl</Text>
        </Group>
      </Stack>
    </Box>
  );
}

// Static styles to prevent re-creation on every render
const INDICATOR_STYLES = {
  height: '20px',
  background: `linear-gradient(90deg, 
    #ff6b6b 0%, #ff6b6b 16.6%,
    #4ecdc4 16.6%, #4ecdc4 33.2%,
    #45b7d1 33.2%, #45b7d1 49.8%,
    #96ceb4 49.8%, #96ceb4 66.4%,
    #ffeaa7 66.6%, #ffeaa7 83%,
    #dda0dd 83%, #dda0dd 100%
  )`,
  borderRadius: '10px',
  position: 'relative'
};

// Breakpoint positions for visual indicator
const BREAKPOINT_POSITIONS = {
  xs: 0.083,  // 1/12
  sm: 0.25,   // 3/12
  md: 0.416,  // 5/12
  lg: 0.583,  // 7/12
  xl: 0.75,   // 9/12
  xxl: 0.916  // 11/12
};

export default ResponsiveTest;