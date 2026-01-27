import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';
import NotificationChannels from './NotificationChannels';
import NotificationPreferences from './NotificationPreferences';
import NotificationHistory from './NotificationHistory';
import { notificationApi } from '../../services/api/notificationApi';
import frontendLogger from '../../services/frontendLogger';
import '../../styles/components/NotificationSettings.css';

/**
 * NotificationSettings Component
 *
 * Main component for managing notification settings including:
 * - Notification channels (Discord, Email, Gotify, Webhook)
 * - Event preferences per channel
 * - Notification history
 */
const NotificationSettings = ({ className = '' }) => {
  const { t } = useTranslation(['notifications', 'common']);
  const [channels, setChannels] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [channelsData, eventTypesData] = await Promise.all([
          notificationApi.getChannels(),
          notificationApi.getEventTypes(),
        ]);

        setChannels(channelsData || []);
        setEventTypes(eventTypesData?.event_types || []);

        frontendLogger.logInfo('Notification settings loaded', {
          component: 'NotificationSettings',
          channelCount: channelsData?.length || 0,
          eventTypeCount: eventTypesData?.event_types?.length || 0,
        });
      } catch (err) {
        setError(err.message || 'Failed to load notification settings');
        frontendLogger.logError('Failed to load notification settings', {
          component: 'NotificationSettings',
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleChannelsChange = newChannels => {
    setChannels(newChannels);
  };

  const handleTestSuccess = () => {
    setHistoryRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className={`notification-settings ${className}`}>
        <div className="notification-settings-loading">
          {t('common:labels.loading', 'Loading...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`notification-settings ${className}`}>
        <Card>
          <div className="notification-settings-error">
            <p>{error}</p>
            <Button onClick={() => window.location.reload()}>
              {t('common:buttons.retry', 'Retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`notification-settings ${className}`}>
      {/* Channels Section */}
      <NotificationChannels
        channels={channels}
        onChannelsChange={handleChannelsChange}
        onTestSuccess={handleTestSuccess}
      />

      {/* Preferences Section - Only show if there are channels */}
      {channels.length > 0 && (
        <NotificationPreferences channels={channels} eventTypes={eventTypes} />
      )}

      {/* History Section */}
      <NotificationHistory refreshKey={historyRefreshKey} />
    </div>
  );
};

export default NotificationSettings;
