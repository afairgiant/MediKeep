import React from 'react';
import './AdminCard.css';

const AdminCard = ({
  children,
  className = '',
  title,
  subtitle,
  icon,
  status,
  actions,
  loading = false,
  error = null,
  ...props
}) => {
  const cardClasses = [
    'admin-card',
    className,
    loading ? 'loading' : '',
    error ? 'error' : '',
    status ? `status-${status}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses} {...props}>
      {(title || icon || actions) && (
        <div className="admin-card-header">
          <div className="admin-card-title-section">
            {icon && <span className="admin-card-icon">{icon}</span>}
            <div className="admin-card-title-content">
              {title && <h3 className="admin-card-title">{title}</h3>}
              {subtitle && <p className="admin-card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="admin-card-actions">{actions}</div>}
        </div>
      )}

      <div className="admin-card-content">
        {loading ? (
          <div className="admin-card-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="admin-card-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default AdminCard;
