/**
 * StatusBadge component for medical entities
 * Provides consistent status display across all medical pages using Mantine Badge
 */

import React from 'react';
import { Badge } from '@mantine/core';

const StatusBadge = ({
  status,
  size = 'md',
  className = '',
  showIcon = false,
  color, // Legacy prop for backward compatibility
  variant = 'light',
  ...props
}) => {
  if (!status) return null;

  const getStatusConfig = status => {
    const configs = {
      // Common statuses
      active: { icon: '🟢', label: 'Active', color: 'green' },
      inactive: { icon: '⚪', label: 'Inactive', color: 'gray' },
      completed: { icon: '✅', label: 'Completed', color: 'blue' },
      cancelled: { icon: '❌', label: 'Cancelled', color: 'red' },
      pending: { icon: '⏳', label: 'Pending', color: 'yellow' },

      // Medical condition statuses
      resolved: { icon: '✅', label: 'Resolved', color: 'green' },
      chronic: { icon: '🔄', label: 'Chronic', color: 'orange' },

      // Treatment statuses
      planned: { icon: '📋', label: 'Planned', color: 'blue' },
      'on-hold': { icon: '⏸️', label: 'On Hold', color: 'yellow' },

      // Medication statuses
      stopped: { icon: '⏹️', label: 'Stopped', color: 'red' },

      // Allergy severity
      severe: { icon: '🔴', label: 'Severe', color: 'red' },
      moderate: { icon: '🟡', label: 'Moderate', color: 'yellow' },
      mild: { icon: '🟢', label: 'Mild', color: 'green' },

      // Lab result statuses
      normal: { icon: '✅', label: 'Normal', color: 'green' },
      abnormal: { icon: '⚠️', label: 'Abnormal', color: 'yellow' },
      critical: { icon: '🔴', label: 'Critical', color: 'red' },

      // Procedure outcome statuses (abnormal and pending reuse existing configs above)
      successful: { icon: '✅', label: 'Successful', color: 'green' },
      complications: { icon: '⚠️', label: 'Complications', color: 'red' },
      inconclusive: { icon: '❓', label: 'Inconclusive', color: 'yellow' },

      // General statuses
      scheduled: { icon: '📅', label: 'Scheduled', color: 'blue' },
      in_progress: { icon: '🔄', label: 'In Progress', color: 'blue' },
      'in-progress': { icon: '🔄', label: 'In Progress', color: 'blue' },
      ordered: { icon: '📋', label: 'Ordered', color: 'cyan' },
    };

    return (
      configs[status?.toLowerCase()] || {
        icon: '❓',
        label: status,
        color: 'gray',
      }
    );
  };

  const statusConfig = getStatusConfig(status);

  // Use legacy color prop if provided, otherwise use status-based color
  const badgeColor = color || statusConfig.color;

  return (
    <Badge
      variant={variant}
      color={badgeColor}
      size={size}
      className={className}
      {...props}
    >
      {showIcon && statusConfig.icon && (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <span>{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </span>
      )}
      {!showIcon && statusConfig.label}
    </Badge>
  );
};

export default StatusBadge;
