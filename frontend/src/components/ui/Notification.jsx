/**
 * Notification Toast component
 */

import React, { useEffect, useState, useCallback } from 'react';
import './Notification.css';

const Notification = ({
  message,
  type = 'info',
  duration = 5000,
  onClose,
  position = 'top-right',
  showIcon = true,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`notification notification-${type} notification-${position} ${isExiting ? 'notification-exit' : ''}`}
    >
      <div className="notification-content">
        {showIcon && <span className="notification-icon">{getIcon()}</span>}
        <span className="notification-message">{message}</span>
        <button
          className="notification-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Notification container for managing multiple notifications
export const NotificationContainer = ({ notifications = [], onRemove }) => {
  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          {...notification}
          onClose={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
};

export default Notification;
