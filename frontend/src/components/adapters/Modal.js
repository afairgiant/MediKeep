import React from 'react';
import { Modal as MantineModal } from '@mantine/core';
import OldModal from '../ui/Modal';

export const Modal = ({
  useMantine = true,
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
  ...props
}) => {
  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldModal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size={size}
        showCloseButton={showCloseButton}
        closeOnOverlayClick={closeOnOverlayClick}
        className={className}
        {...props}
      >
        {children}
      </OldModal>
    );
  }

  // Map sizes to Mantine sizes
  const sizeMap = {
    small: 'sm',
    medium: 'md',
    large: 'lg',
    'extra-large': 'xl',
  };

  return (
    <MantineModal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size={sizeMap[size] || 'md'}
      closeOnClickOutside={closeOnOverlayClick}
      withCloseButton={showCloseButton}
      className={className}
      {...props}
    >
      {children}
    </MantineModal>
  );
};

export default Modal;
