import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';
import { notificationApi } from '../../services/api/notificationApi';
import frontendLogger from '../../services/frontendLogger';
import { formatDateWithPreference } from '../../utils/dateFormatUtils';
import { timezoneService } from '../../services/timezoneService';
import '../../styles/components/NotificationHistory.css';

/**
 * Status badge colors
 */
const STATUS_COLORS = {
  sent: 'success',
  failed: 'error',
  pending: 'warning',
};

/**
 * Format relative time
 * Handles UTC timestamps from the backend (with or without 'Z' suffix)
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';

  // Ensure UTC parsing - append 'Z' if no timezone info present
  // Regex matches: trailing Z/z, or timezone offset like +05:00, -0530, +00
  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateString);
  const normalizedDate = hasTimezone ? dateString : dateString + 'Z';

  const date = new Date(normalizedDate);
  if (isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateWithPreference(date, timezoneService.dateFormatCode);
}

/**
 * NotificationHistory Component
 *
 * Displays recent notification history with pagination
 *
 * @param {number} refreshKey - Change this value to trigger a refresh of the history
 */
const NotificationHistory = ({ refreshKey = 0 }) => {
  const { t } = useTranslation(['notifications', 'common']);
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const PAGE_SIZE = 10;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await notificationApi.getHistory({
          page,
          page_size: PAGE_SIZE,
        });
        setHistory(response.items || []);
        setTotal(response.total || 0);
      } catch (err) {
        frontendLogger.logError('Failed to load notification history', {
          component: 'NotificationHistory',
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [page, refreshKey]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card className="notification-history-card">
      <div className="notification-history">
        <div className="notification-history-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
          <h3>
            {t('history.title', 'Notification History')}
            <span className="expand-icon">{expanded ? '-' : '+'}</span>
          </h3>
        </div>

        {expanded && (
          <>
            {loading && history.length === 0 && (
              <div className="notification-history-loading">{t('common:labels.loading', 'Loading...')}</div>
            )}
            {!loading && history.length === 0 && (
              <div className="notification-history-empty">{t('history.noHistory', 'No notifications sent yet.')}</div>
            )}
            {history.length > 0 && (
              <>
                <div className="history-list">
                  {history.map(item => (
                    <div key={item.id} className={`history-item status-${item.status}`}>
                      <div className="history-item-main">
                        <div className="history-item-title">
                          <span className="history-title">{item.title}</span>
                          <span className={`history-status ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                        </div>
                        <div className="history-item-details">
                          <span className="history-event">
                            {t(`events.${item.event_type}.name`, item.event_type.replace(/_/g, ' '))}
                          </span>
                          {item.channel_name && (
                            <span className="history-channel">
                              {item.channel_name}
                              {item.channel_type && <span className="channel-type">({item.channel_type})</span>}
                            </span>
                          )}
                          <span className="history-time">{formatRelativeTime(item.sent_at || item.created_at)}</span>
                        </div>
                        {item.message_preview && <div className="history-item-preview">{item.message_preview}</div>}
                        {item.status === 'failed' && item.error_message && <div className="history-item-error">{item.error_message}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="history-pagination">
                    <Button variant="secondary" size="small" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                      {t('common:pagination.previous', 'Previous')}
                    </Button>
                    <span className="pagination-info">
                      {t('common:pagination.pageOf', 'Page {{page}} of {{total}}', {
                        page,
                        total: totalPages,
                      })}
                    </span>
                    <Button variant="secondary" size="small" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
                      {t('common:pagination.next', 'Next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

NotificationHistory.propTypes = {
  refreshKey: PropTypes.number,
};

export default NotificationHistory;
