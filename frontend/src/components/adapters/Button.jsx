import React from 'react';
import { Button as MantineButton } from '@mantine/core';

export const Button = ({
  variant,
  size,
  loading,
  children,
  ...props
}) => {
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