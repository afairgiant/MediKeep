/**
 * StatusBadge component for medical entities
 * Provides consistent status display across all medical pages
 */

import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({
  status,
  size = 'normal',
  className = '',
  showIcon = false,
  color, // Legacy prop for backward compatibility
}) => {
  if (!status) return null;

  const getStatusConfig = status => {
    const configs = {
      // Common statuses
      active: { icon: '🟢', label: 'Active' },
      inactive: { icon: '⚪', label: 'Inactive' },
      completed: { icon: '✅', label: 'Completed' },
      cancelled: { icon: '❌', label: 'Cancelled' },
      pending: { icon: '⏳', label: 'Pending' },

      // Medical condition statuses
      resolved: { icon: '✅', label: 'Resolved' },
      chronic: { icon: '🔄', label: 'Chronic' },

      // Treatment statuses
      planned: { icon: '📋', label: 'Planned' },
      'on-hold': { icon: '⏸️', label: 'On Hold' },

      // Medication statuses
      stopped: { icon: '⏹️', label: 'Stopped' },

      // Allergy severity
      severe: { icon: '🔴', label: 'Severe' },
      moderate: { icon: '🟡', label: 'Moderate' },
      mild: { icon: '🟢', label: 'Mild' },

      // Lab result statuses
      normal: { icon: '✅', label: 'Normal' },
      abnormal: { icon: '⚠️', label: 'Abnormal' },
      critical: { icon: '🔴', label: 'Critical' },
    };

    return (
      configs[status?.toLowerCase()] || {
        icon: '❓',
        label: status,
      }
    );
  };

  const statusConfig = getStatusConfig(status);
  const sizeClass = size === 'small' ? 'status-badge-small' : 'status-badge';
  const statusClass = `status-${status?.toLowerCase().replace(/\s+/g, '-')}`;

  // Legacy color support for backward compatibility
  const colorClass = color ? `status-${color}` : '';

  return (
    <span className={`${sizeClass} ${statusClass} ${colorClass} ${className}`}>
      {showIcon && statusConfig.icon && (
        <span className="status-icon">{statusConfig.icon}</span>
      )}
      {statusConfig.label}
    </span>
  );
};

export default StatusBadge;
