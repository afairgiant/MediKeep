import React from 'react';
import './StatusBadge.css';

/**
 * Status badge component for displaying status with appropriate colors
 */
const StatusBadge = ({ status, type = 'general' }) => {
  const getStatusClass = (status, type) => {
    if (!status) return 'status-unknown';
    
    const statusLower = status.toLowerCase();
    
    // Medical-specific status classes
    if (type === 'medication') {
      switch (statusLower) {
        case 'active': return 'status-active';
        case 'stopped': return 'status-stopped';
        case 'on-hold': return 'status-on-hold';
        case 'completed': return 'status-completed';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-unknown';
      }
    }
    
    if (type === 'lab-result') {
      switch (statusLower) {
        case 'completed': return 'status-completed';
        case 'in-progress': return 'status-in-progress';
        case 'ordered': return 'status-ordered';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-unknown';
      }
    }
    
    // General status classes
    switch (statusLower) {
      case 'active':
      case 'completed':
      case 'success':
        return 'status-success';
      case 'pending':
      case 'in-progress':
      case 'processing':
        return 'status-warning';
      case 'cancelled':
      case 'failed':
      case 'error':
        return 'status-error';
      case 'inactive':
      case 'stopped':
        return 'status-inactive';
      default:
        return 'status-unknown';
    }
  };

  const statusClass = getStatusClass(status, type);

  return (
    <span className={`status-badge ${statusClass}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
