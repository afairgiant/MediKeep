import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';
import ChannelFormModal from './ChannelFormModal';
import { notificationApi } from '../../services/api/notificationApi';
import frontendLogger from '../../services/frontendLogger';
import { notifySuccess, notifyError } from '../../utils/notifyTranslated';
import '../../styles/components/NotificationChannels.css';

/**
 * Channel type display names and icons
 */
const CHANNEL_TYPE_INFO = {
  discord: { label: 'Discord', icon: 'D' },
  email: { label: 'Email', icon: 'E' },
  gotify: { label: 'Gotify', icon: 'G' },
  webhook: { label: 'Webhook', icon: 'W' },
};

/**
 * NotificationChannels Component
 *
 * Manages notification channels - list, add, edit, delete, test
 */
const NotificationChannels = ({ channels, onChannelsChange, onTestSuccess }) => {
  const { t } = useTranslation(['notifications', 'common']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [testingChannelId, setTestingChannelId] = useState(null);
  const [deletingChannelId, setDeletingChannelId] = useState(null);

  const handleAddChannel = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };

  const handleEditChannel = async channel => {
    try {
      // Fetch channel with masked config for editing
      const channelWithConfig = await notificationApi.getChannel(channel.id);
      setEditingChannel(channelWithConfig);
      setIsModalOpen(true);
    } catch (err) {
      notifyError(t('channels.loadError', 'Failed to load channel details'));
      frontendLogger.logError('Failed to load channel for editing', {
        component: 'NotificationChannels',
        channelId: channel.id,
        error: err.message,
      });
    }
  };

  const handleDeleteChannel = async channelId => {
    if (!window.confirm(t('channels.deleteConfirm', 'Are you sure you want to delete this channel?'))) {
      return;
    }

    try {
      setDeletingChannelId(channelId);
      await notificationApi.deleteChannel(channelId);
      onChannelsChange(channels.filter(c => c.id !== channelId));
      notifySuccess(t('channels.deleteSuccess', 'Channel deleted successfully'));
    } catch (err) {
      notifyError(t('channels.deleteError', 'Failed to delete channel'));
      frontendLogger.logError('Failed to delete channel', {
        component: 'NotificationChannels',
        channelId,
        error: err.message,
      });
    } finally {
      setDeletingChannelId(null);
    }
  };

  const handleTestChannel = async channelId => {
    try {
      setTestingChannelId(channelId);
      const result = await notificationApi.testChannel(channelId);

      if (result.success) {
        notifySuccess(t('channels.testSuccess', 'Test notification sent!'));
        // Refresh channels to get updated verification status
        const updatedChannels = await notificationApi.getChannels();
        onChannelsChange(updatedChannels);
        // Notify parent to refresh history
        if (onTestSuccess) {
          onTestSuccess();
        }
      } else {
        notifyError(result.message || t('channels.testFailed', 'Test notification failed'));
      }
    } catch (err) {
      notifyError(t('channels.testError', 'Failed to send test notification'));
      frontendLogger.logError('Failed to test channel', {
        component: 'NotificationChannels',
        channelId,
        error: err.message,
      });
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingChannel(null);
  };

  const handleModalSave = async (channelData, isEditing) => {
    try {
      let updatedChannel;

      if (isEditing && editingChannel) {
        updatedChannel = await notificationApi.updateChannel(editingChannel.id, channelData);
        onChannelsChange(channels.map(c => (c.id === editingChannel.id ? updatedChannel : c)));
        notifySuccess(t('channels.updateSuccess', 'Channel updated successfully'));
      } else {
        updatedChannel = await notificationApi.createChannel(channelData);
        onChannelsChange([...channels, updatedChannel]);
        notifySuccess(t('channels.createSuccess', 'Channel created successfully'));
      }

      handleModalClose();
    } catch (err) {
      const errorMsg = err.message || (isEditing ? t('channels.updateError', 'Failed to update channel') : t('channels.createError', 'Failed to create channel'));
      notifyError(errorMsg);
      frontendLogger.logError('Failed to save channel', {
        component: 'NotificationChannels',
        isEditing,
        error: err.message,
      });
      throw err; // Re-throw to keep modal open
    }
  };

  return (
    <Card className="notification-channels-card">
      <div className="notification-channels">
        <div className="notification-channels-header">
          <h3>{t('channels.title', 'Notification Channels')}</h3>
          <Button variant="primary" onClick={handleAddChannel}>
            {t('channels.add', 'Add Channel')}
          </Button>
        </div>

        {channels.length === 0 ? (
          <div className="notification-channels-empty">
            <p>{t('channels.empty', 'No notification channels configured.')}</p>
            <p className="notification-channels-empty-hint">
              {t('channels.emptyHint', 'Add a channel to start receiving notifications via Discord, Email, Gotify, or Webhook.')}
            </p>
          </div>
        ) : (
          <div className="notification-channels-list">
            {channels.map(channel => {
              const typeInfo = CHANNEL_TYPE_INFO[channel.channel_type] || {
                label: channel.channel_type,
                icon: '?',
              };

              return (
                <div key={channel.id} className={`notification-channel-item ${!channel.is_enabled ? 'disabled' : ''}`}>
                  <div className="channel-icon" data-type={channel.channel_type}>
                    {typeInfo.icon}
                  </div>

                  <div className="channel-info">
                    <div className="channel-name">
                      {channel.name}
                      {channel.is_verified && <span className="verified-badge" title={t('channels.verified', 'Verified')}>V</span>}
                    </div>
                    <div className="channel-type">{typeInfo.label}</div>
                    <div className="channel-stats">
                      {t('channels.sentCount', '{{count}} sent', {
                        count: channel.total_notifications_sent,
                      })}
                    </div>
                  </div>

                  <div className="channel-status">
                    {channel.is_enabled ? (
                      <span className="status-enabled">{t('channels.enabled', 'Enabled')}</span>
                    ) : (
                      <span className="status-disabled">{t('channels.disabled', 'Disabled')}</span>
                    )}
                  </div>

                  <div className="channel-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleTestChannel(channel.id)}
                      disabled={testingChannelId === channel.id || !channel.is_enabled}
                      loading={testingChannelId === channel.id}
                    >
                      {t('channels.test', 'Test')}
                    </Button>
                    <Button variant="secondary" size="small" onClick={() => handleEditChannel(channel)}>
                      {t('common:buttons.edit', 'Edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteChannel(channel.id)}
                      disabled={deletingChannelId === channel.id}
                      loading={deletingChannelId === channel.id}
                    >
                      {t('common:buttons.delete', 'Delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ChannelFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        channel={editingChannel}
      />
    </Card>
  );
};

NotificationChannels.propTypes = {
  channels: PropTypes.array.isRequired,
  onChannelsChange: PropTypes.func.isRequired,
  onTestSuccess: PropTypes.func,
};

export default NotificationChannels;
