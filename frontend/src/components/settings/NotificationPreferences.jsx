import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { notificationApi } from '../../services/api/notificationApi';
import frontendLogger from '../../services/frontendLogger';
import { toast } from 'react-toastify';
import '../../styles/components/NotificationPreferences.css';

/**
 * Event type categories for grouping
 */
const EVENT_CATEGORIES = {
  system: 'System',
  medical: 'Medical',
  collaboration: 'Collaboration',
  security: 'Security',
};

/**
 * NotificationPreferences Component
 *
 * Displays and manages the preference matrix (events x channels) with collapsible categories
 */
const NotificationPreferences = ({ channels, eventTypes }) => {
  const { t } = useTranslation(['notifications', 'common']);
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Fetch preference matrix
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const matrix = await notificationApi.getPreferenceMatrix();
        setPreferences(matrix.preferences || {});
      } catch (err) {
        frontendLogger.logError('Failed to load preferences', {
          component: 'NotificationPreferences',
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    if (channels.length > 0) {
      fetchPreferences();
    }
  }, [channels]);

  // Group events by category
  const groupedEvents = eventTypes.reduce((acc, event) => {
    const category = event.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(event);
    return acc;
  }, {});

  const toggleCategory = category => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handlePreferenceToggle = useCallback(
    async (eventType, channelId, currentValue) => {
      const cellKey = `${eventType}-${channelId}`;
      setSavingCell(cellKey);

      const newValue = !currentValue;

      // Optimistic update
      setPreferences(prev => ({
        ...prev,
        [eventType]: {
          ...prev[eventType],
          [channelId]: newValue,
        },
      }));

      try {
        await notificationApi.setPreference({
          channel_id: channelId,
          event_type: eventType,
          is_enabled: newValue,
        });
      } catch (err) {
        // Revert on error
        setPreferences(prev => ({
          ...prev,
          [eventType]: {
            ...prev[eventType],
            [channelId]: currentValue,
          },
        }));
        toast.error(t('preferences.updateError', 'Failed to update preference'));
        frontendLogger.logError('Failed to update preference', {
          component: 'NotificationPreferences',
          eventType,
          channelId,
          error: err.message,
        });
      } finally {
        setSavingCell(null);
      }
    },
    [t]
  );

  if (loading) {
    return (
      <Card className="notification-preferences-card">
        <div className="notification-preferences-loading">{t('common:labels.loading', 'Loading...')}</div>
      </Card>
    );
  }

  if (channels.length === 0) {
    return null;
  }

  return (
    <Card className="notification-preferences-card">
      <div className="notification-preferences">
        <div className="notification-preferences-header">
          <h3>{t('preferences.title', 'Event Notifications')}</h3>
          <p className="notification-preferences-description">{t('preferences.description', 'Choose which events trigger notifications on each channel.')}</p>
        </div>

        <div className="preferences-matrix-container">
          <table className="preferences-matrix">
            <thead>
              <tr>
                <th className="event-header">{t('preferences.event', 'Event')}</th>
                {channels.map(channel => (
                  <th key={channel.id} className="channel-header">
                    <span className="channel-name">{channel.name}</span>
                    <span className={`channel-type ${channel.channel_type}`}>{channel.channel_type}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedEvents).map(([category, events]) => {
                const isExpanded = expandedCategories[category] !== false; // Default to expanded
                const categoryLabel = EVENT_CATEGORIES[category] || category;

                return (
                  <React.Fragment key={category}>
                    <tr
                      className={`category-row ${isExpanded ? 'expanded' : 'collapsed'}`}
                      onClick={() => toggleCategory(category)}
                    >
                      <td colSpan={channels.length + 1} className="category-cell">
                        <span className="category-expand-icon">{isExpanded ? '−' : '+'}</span>
                        {categoryLabel}
                        <span className="category-count">({events.length})</span>
                      </td>
                    </tr>
                    {isExpanded &&
                      events.map(event => {
                        const isImplemented = event.is_implemented !== false;

                        return (
                          <tr key={event.value} className={`event-row ${!isImplemented ? 'not-implemented' : ''}`}>
                            <td className="event-cell">
                              <div className="event-name">
                                {event.label}
                                {!isImplemented && (
                                  <span className="coming-soon-badge">{t('preferences.comingSoon', 'Coming Soon')}</span>
                                )}
                              </div>
                              <div className="event-description">{event.description}</div>
                            </td>
                            {channels.map(channel => {
                              const isEnabled = preferences[event.value]?.[channel.id] ?? false;
                              const cellKey = `${event.value}-${channel.id}`;
                              const isSaving = savingCell === cellKey;
                              const isDisabled = isSaving || !channel.is_enabled || !isImplemented;

                              return (
                                <td key={channel.id} className="preference-cell">
                                  <label className={`preference-toggle ${isSaving ? 'saving' : ''} ${!isImplemented ? 'not-implemented' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handlePreferenceToggle(event.value, channel.id, isEnabled)}
                                      disabled={isDisabled}
                                    />
                                    <span className="toggle-slider"></span>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

NotificationPreferences.propTypes = {
  channels: PropTypes.array.isRequired,
  eventTypes: PropTypes.array.isRequired,
};

export default NotificationPreferences;
