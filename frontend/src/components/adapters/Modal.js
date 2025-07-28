import React from 'react';
import { Modal as MantineModal } from '@mantine/core';

export const Modal = ({
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
