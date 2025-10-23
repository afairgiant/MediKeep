/**
 * Medical Form Modal Component
 * Provides consistent modal structure for all medical form interactions
 * Enhanced with responsive behavior for different screen sizes
 */

import React from 'react';
import { Modal, Stack, ScrollArea } from '@mantine/core';
// Temporarily disable responsive features to fix dropdown hanging
// import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
// import MantineResponsiveAdapter from '../../adapters/MantineResponsiveAdapter';
// import { useResponsive } from '../../hooks/useResponsive';

const MedicalFormModal = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'lg'
}) => {
  // Temporarily disable responsive features to fix dropdown hanging
  // const responsive = useResponsive();

  if (!isOpen) return null;

  // Use simple modal without responsive enhancements
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      className={className}
      size={size}
      closeOnClickOutside={true}
      closeOnEscape={true}
      trapFocus
      returnFocus
    >
      <Stack spacing="md">
        {children}
      </Stack>
    </Modal>
  );
};

export default MedicalFormModal;
