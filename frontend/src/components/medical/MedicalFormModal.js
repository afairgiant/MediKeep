/**
 * Medical Form Modal Component
 * Provides consistent modal structure for all medical form interactions
 * Enhanced with responsive behavior for different screen sizes
 */

import React from 'react';
import { Modal, Stack, ScrollArea } from '@mantine/core';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import MantineResponsiveAdapter from '../../adapters/MantineResponsiveAdapter';
import { useResponsive } from '../../hooks/useResponsive';

const MedicalFormModal = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'lg'
}) => {
  const responsive = useResponsive();

  if (!isOpen) return null;

  // Get responsive modal configuration
  const modalConfig = MantineResponsiveAdapter.createModalProps(responsive.breakpoint, {
    enableFullScreen: true, // Enable fullscreen for small screens
    centerOnDesktop: true,
    customSize: {
      xs: 'full',
      sm: 'xl', 
      md: size,
      lg: size,
      xl: size
    }
  });

  // Create responsive modal with our factory
  const ResponsiveModal = ResponsiveComponentFactory.createAdvanced(
    Modal,
    (props, responsiveState) => {
      const { isMobile, isTablet, breakpoint } = responsiveState;
      
      return {
        ...props,
        ...modalConfig,
        // Enhanced responsive behavior
        padding: isMobile ? 'xs' : isTablet ? 'sm' : 'md',
        overlayProps: {
          opacity: isMobile ? 0.4 : 0.55,
          blur: isMobile ? 2 : 3
        },
        radius: isMobile ? 0 : 'md',
        // Ensure proper mobile spacing
        styles: {
          content: {
            height: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '90vh'
          },
          header: {
            padding: isMobile ? 'var(--mantine-spacing-sm)' : 'var(--mantine-spacing-md)'
          },
          body: {
            padding: isMobile ? 'var(--mantine-spacing-sm)' : 'var(--mantine-spacing-md)',
            height: isMobile ? 'calc(100vh - 60px)' : 'auto'
          }
        }
      };
    }
  );

  return (
    <ResponsiveModal
      opened={isOpen}
      onClose={onClose}
      title={title}
      className={className}
      closeOnClickOutside={!responsive.isMobile} // Prevent accidental close on mobile
      closeOnEscape={!responsive.isMobile}
      trapFocus
      returnFocus
    >
      <Stack spacing={responsive.isMobile ? 'sm' : 'md'}>
        {responsive.isMobile ? (
          // Mobile: Use ScrollArea for better performance
          <ScrollArea 
            style={{ height: 'calc(100vh - 120px)' }}
            scrollbarSize={8}
            offsetScrollbars
          >
            {children}
          </ScrollArea>
        ) : (
          // Desktop: Normal content flow
          children
        )}
      </Stack>
    </ResponsiveModal>
  );
};

export default MedicalFormModal;
