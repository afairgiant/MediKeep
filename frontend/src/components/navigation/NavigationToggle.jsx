/**
 * NavigationToggle - Hamburger menu toggle button
 * Used by mobile and tablet navigation components
 * 
 * Following PR #3: Navigation & Layout System specifications
 */

import React from 'react';
import { ActionIcon } from '@mantine/core';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import './NavigationToggle.css';

const NavigationToggle = ({
  isOpen,
  onToggle,
  className = '',
  style = {},
  size = 'md',
  variant = 'default',
  ariaLabel
}) => {
  // Create responsive ActionIcon
  const ResponsiveActionIcon = ResponsiveComponentFactory.createMantine(ActionIcon, {
    size: { xs: 'lg', sm: 'lg', md: size },
    variant: { xs: 'filled', sm: 'light', md: variant }
  });

  const defaultAriaLabel = isOpen ? 'Close navigation menu' : 'Open navigation menu';

  return (
    <ResponsiveActionIcon
      onClick={onToggle}
      className={`navigation-toggle ${isOpen ? 'open' : 'closed'} ${className}`}
      style={style}
      aria-label={ariaLabel || defaultAriaLabel}
      aria-expanded={isOpen}
      aria-controls="navigation-menu"
    >
      {isOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
    </ResponsiveActionIcon>
  );
};

export default NavigationToggle;