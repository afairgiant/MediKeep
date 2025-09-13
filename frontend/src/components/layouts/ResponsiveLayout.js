/**
 * ResponsiveLayout - Main layout wrapper component
 * Provides consistent responsive layout structure for the entire application
 * 
 * Following PR #3: Navigation & Layout System specifications
 * File specified in RESPONSIVE_IMPLEMENTATION_PLAN.md line 256
 */

import React from 'react';
import { Container, Box } from '@mantine/core';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import { useResponsive } from '../../hooks/useResponsive';
import './ResponsiveLayout.css';

const ResponsiveLayout = ({
  children,
  withNavigation = true,
  navigation = null,
  maxWidth = 'xl',
  fluid = false,
  padding = 'md',
  className = ''
}) => {
  const responsive = useResponsive();

  // Create responsive Container with proper sizing
  const ResponsiveContainer = ResponsiveComponentFactory.createMantine(Container, {
    size: fluid ? undefined : {
      xs: 'xs',
      sm: 'sm', 
      md: 'md',
      lg: 'lg',
      xl: maxWidth,
      xxl: maxWidth
    },
    p: {
      xs: 'xs',
      sm: 'sm',
      md: padding,
      lg: padding,
      xl: padding
    }
  });

  // Create responsive content wrapper
  const ResponsiveContentWrapper = ResponsiveComponentFactory.createMantine(Box, {
    style: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }
  });

  return (
    <ResponsiveContentWrapper className={`responsive-layout ${className}`}>
      {/* Navigation Section */}
      {withNavigation && navigation && (
        <Box component="nav" className="responsive-layout-navigation">
          {navigation}
        </Box>
      )}

      {/* Main Content Section */}
      <Box
        component="main"
        className="responsive-layout-content"
        style={{
          flex: 1,
          marginLeft: withNavigation && (responsive.isAbove('md') || responsive.matches('lg')) 
            ? '280px' 
            : '0',
          transition: 'margin-left 0.3s ease',
          paddingTop: responsive.matches('xs') || responsive.matches('sm') 
            ? '60px' // Account for mobile navigation toggle
            : '0'
        }}
      >
        {fluid ? (
          <Box p={padding} style={{ width: '100%' }}>
            {children}
          </Box>
        ) : (
          <ResponsiveContainer>
            {children}
          </ResponsiveContainer>
        )}
      </Box>
    </ResponsiveContentWrapper>
  );
};

export default ResponsiveLayout;