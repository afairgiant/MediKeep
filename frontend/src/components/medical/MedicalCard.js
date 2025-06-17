import React from 'react';
import { formatDate, formatDateTime } from '../../utils/helpers';
import './MedicalCard.css';

/**
 * Reusable card component for medical records
 */
const MedicalCard = ({
  title,
  subtitle,
  status,
  statusType = 'general',
  children,
  actions,
  dateInfo,
  className = '',
  onClick,
  onEdit,
  onDelete,
  ...props
}) => {
  const cardClass = [
    'medical-card',
    onClick && 'medical-card-clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass} onClick={onClick} {...props}>
      <div className="medical-card-header">
        <div className="card-title-section">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>

        {status && (
          <span
            className={`status-badge status-${getStatusClass(status, statusType)}`}
          >
            {status}
          </span>
        )}
      </div>

      {children && <div className="medical-card-body">{children}</div>}

      {dateInfo && (
        <div className="medical-card-dates">
          {dateInfo.created && (
            <span className="date-item">
              Created: {formatDate(dateInfo.created)}
            </span>
          )}
          {dateInfo.updated && (
            <span className="date-item">
              Updated: {formatDateTime(dateInfo.updated)}
            </span>
          )}
          {dateInfo.custom && (
            <span className="date-item">
              {dateInfo.custom.label}: {formatDate(dateInfo.custom.date)}
            </span>
          )}
        </div>
      )}

      {(onEdit || onDelete || actions) && (
        <div className="medical-card-actions">
          {onEdit && (
            <button
              className="edit-button"
              onClick={e => {
                e.stopPropagation();
                onEdit();
              }}
            >
              ✏️ Edit
            </button>
          )}
          {onDelete && (
            <button
              className="delete-button"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
            >
              🗑️ Delete
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};

// Helper function to get status class
const getStatusClass = (status, type) => {
  if (!status) return 'unknown';

  const statusLower = status.toLowerCase();

  if (type === 'medication') {
    switch (statusLower) {
      case 'active':
        return 'active';
      case 'stopped':
        return 'stopped';
      case 'on-hold':
        return 'on-hold';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  if (type === 'lab-result') {
    switch (statusLower) {
      case 'completed':
        return 'completed';
      case 'in-progress':
        return 'in-progress';
      case 'ordered':
        return 'ordered';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  return statusLower;
};

export default MedicalCard;
