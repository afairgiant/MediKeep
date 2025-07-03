import React from 'react';
import { Button as MantineButton } from '@mantine/core';
import OldButton from '../ui/Button';

export const Button = ({
  useMantine = true,
  variant,
  size,
  loading,
  children,
  ...props
}) => {
  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldButton variant={variant} size={size} loading={loading} {...props}>
        {children}
      </OldButton>
    );
  }

  // Map your old variants to Mantine
  const variantMap = {
    primary: 'filled',
    secondary: 'outline',
    danger: 'filled',
    success: 'filled',
    ghost: 'subtle',
  };

  const colorMap = {
    primary: 'primary',
    secondary: 'gray',
    danger: 'red',
    success: 'green',
    ghost: 'gray',
  };

  // Map sizes
  const sizeMap = {
    small: 'sm',
    medium: 'md',
    large: 'lg',
  };

  return (
    <MantineButton
      variant={variantMap[variant] || 'filled'}
      color={colorMap[variant] || 'primary'}
      size={sizeMap[size] || 'md'}
      loading={loading}
      {...props}
    >
      {children}
    </MantineButton>
  );
};

export default Button;
