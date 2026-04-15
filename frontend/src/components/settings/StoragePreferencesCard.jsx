import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { getStorageUsageStats } from '../../services/api/paperlessApi.jsx';
import frontendLogger from '../../services/frontendLogger';
import '../../styles/components/PaperlessSettings.css';

/**
 * StoragePreferencesCard Component
 *
 * Handles storage backend preferences, including default storage selection,
 * sync options, and storage usage statistics.
 */
const StoragePreferencesCard = ({
  preferences,
  onUpdate,
  connectionEnabled = false,
  papraConnectionEnabled = false,
}) => {
  const { t } = useTranslation('settings');
  const [storageStats, setStorageStats] = useState({
    local: null,
    paperless: null,
    papra: null,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  /**
   * Load storage usage statistics
   */
  useEffect(() => {
    const loadStorageStats = async () => {
      try {
        setLoadingStats(true);
        const stats = await getStorageUsageStats();
        setStorageStats(stats);

        frontendLogger.logInfo('Storage usage stats loaded', {
          component: 'StoragePreferencesCard',
          localFiles: stats.local?.count || 0,
          paperlessFiles: stats.paperless?.count || 0,
        });
      } catch (error) {
        frontendLogger.logError('Failed to load storage usage stats', {
          component: 'StoragePreferencesCard',
          error: error.message,
        });
        // Fail silently - stats are not critical
      } finally {
        setLoadingStats(false);
      }
    };

    loadStorageStats();
  }, []);

  /**
   * Handle storage backend selection
   */
  const handleStorageBackendChange = backend => {
    const updates = {
      default_storage_backend: backend,
    };

    onUpdate(updates);

    frontendLogger.logInfo('Storage backend preference changed', {
      component: 'StoragePreferencesCard',
      newBackend: backend,
      paperlessEnabled: updates.paperless_enabled,
    });
  };

  /**
   * Format file size for display
   */
  const formatBytes = bytes => {
    if (!bytes || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <div className="paperless-storage-preferences">
        <div className="paperless-section-header">
          <div className="paperless-section-title">
            <span className="paperless-section-icon">💾</span>
            <h3>{t('storage.title')}</h3>
          </div>
        </div>

        {/* Default Storage Location */}
        <div className="paperless-form-section">
          <div className="paperless-form-group">
            <label className="paperless-form-label">
              {t('storage.defaultLocation')}
            </label>

            <div className="paperless-storage-options">
              {/* Local Storage Option */}
              <div className="paperless-storage-option">
                <label className="paperless-storage-option-label">
                  <input
                    type="radio"
                    name="storage-backend"
                    value="local"
                    checked={preferences.default_storage_backend === 'local'}
                    onChange={e => handleStorageBackendChange(e.target.value)}
                    className="paperless-storage-radio"
                  />
                  <div className="paperless-storage-option-content">
                    <div className="paperless-storage-option-header">
                      {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                      <span className="paperless-storage-icon">{'🖥️'}</span>
                      <span className="paperless-storage-title">
                        {t('storage.localStorage')}
                      </span>
                    </div>
                    <div className="paperless-storage-description">
                      {t('storage.localDescription')}
                    </div>
                  </div>
                </label>
              </div>

              {/* Paperless Storage Option */}
              <div
                className={`paperless-storage-option ${!connectionEnabled ? 'disabled' : ''}`}
              >
                <label className="paperless-storage-option-label">
                  <input
                    type="radio"
                    name="storage-backend"
                    value="paperless"
                    checked={
                      preferences.default_storage_backend === 'paperless'
                    }
                    onChange={e => handleStorageBackendChange(e.target.value)}
                    disabled={!connectionEnabled}
                    className="paperless-storage-radio"
                  />
                  <div className="paperless-storage-option-content">
                    <div className="paperless-storage-option-header">
                      {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                      <span className="paperless-storage-icon">{'☁️'}</span>
                      <span className="paperless-storage-title">
                        {t('storage.paperless')}
                      </span>
                      {!connectionEnabled && (
                        <span className="paperless-storage-badge">
                          {t('storage.connectionRequired')}
                        </span>
                      )}
                    </div>
                    <div className="paperless-storage-description">
                      {t('storage.paperlessDescription')}
                    </div>
                  </div>
                </label>
              </div>

              {/* Papra Storage Option */}
              <div
                className={`paperless-storage-option ${!papraConnectionEnabled ? 'disabled' : ''}`}
              >
                <label className="paperless-storage-option-label">
                  <input
                    type="radio"
                    name="storage-backend"
                    value="papra"
                    checked={preferences.default_storage_backend === 'papra'}
                    onChange={e => handleStorageBackendChange(e.target.value)}
                    disabled={!papraConnectionEnabled}
                    className="paperless-storage-radio"
                  />
                  <div className="paperless-storage-option-content">
                    <div className="paperless-storage-option-header">
                      {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                      <span className="paperless-storage-icon">
                        {'\uD83D\uDCC4'}
                      </span>
                      <span className="paperless-storage-title">
                        {t('storage.papra')}
                      </span>
                      {!papraConnectionEnabled && (
                        <span className="paperless-storage-badge">
                          {t('storage.connectionRequired')}
                        </span>
                      )}
                    </div>
                    <div className="paperless-storage-description">
                      {t('storage.papraDescription')}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage Statistics */}
        <div className="paperless-form-section">
          <div className="paperless-form-group">
            <label className="paperless-form-label">
              {t('storage.usageLabel')}
            </label>

            {loadingStats ? (
              <div className="paperless-storage-stats-loading">
                Loading storage statistics...
              </div>
            ) : (
              <div className="paperless-storage-stats">
                {storageStats.local && (
                  <div className="paperless-storage-stat">
                    {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                    <div className="storage-stat-icon">{'🖥️'}</div>
                    <div className="storage-stat-content">
                      <div className="storage-stat-label">
                        {t('storage.localStorage')}
                      </div>
                      <div className="storage-stat-value">
                        {t('storage.filesCount', {
                          count: storageStats.local.count,
                        })}{' '}
                        ({formatBytes(storageStats.local.size)})
                      </div>
                    </div>
                  </div>
                )}

                {storageStats.paperless && (
                  <div className="paperless-storage-stat">
                    {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                    <div className="storage-stat-icon">{'☁️'}</div>
                    <div className="storage-stat-content">
                      <div className="storage-stat-label">
                        {t('storage.paperless')}
                      </div>
                      <div className="storage-stat-value">
                        {t('storage.filesCount', {
                          count: storageStats.paperless.count,
                        })}{' '}
                        ({formatBytes(storageStats.paperless.size)})
                      </div>
                    </div>
                  </div>
                )}

                {storageStats.papra && (
                  <div className="paperless-storage-stat">
                    {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                    <div className="storage-stat-icon">{'\uD83D\uDCC4'}</div>
                    <div className="storage-stat-content">
                      <div className="storage-stat-label">
                        {t('storage.papra')}
                      </div>
                      <div className="storage-stat-value">
                        {t('storage.filesCount', {
                          count: storageStats.papra.count,
                        })}{' '}
                        ({formatBytes(storageStats.papra.size)})
                      </div>
                    </div>
                  </div>
                )}

                {!storageStats.local &&
                  !storageStats.paperless &&
                  !storageStats.papra && (
                    <div className="paperless-storage-stats-empty">
                      {t('storage.noUsageData')}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StoragePreferencesCard;
