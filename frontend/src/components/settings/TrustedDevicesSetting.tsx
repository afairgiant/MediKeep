import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button as MantineButton,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { Button } from '../ui';
import { ResponsiveModal } from '../adapters/ResponsiveModal';
import {
  forgetAllTrustedDevices,
  forgetTrustedDevice,
  getTrustedDevices,
  type TrustedDevice,
} from '../../services/api/securityApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useDeviceName } from '../../hooks/useDeviceName';
import { notifyError, notifySuccess } from '../../utils/notifyTranslated';
import logger from '../../services/logger';

interface TrustedDevicesSettingProps {
  /** Reloads the list when it changes. */
  sessionsRevision?: number;
}

/** The "remembered devices" row of the Settings Security card; shown while two-factor is on. */
const TrustedDevicesSetting = ({
  sessionsRevision = 0,
}: TrustedDevicesSettingProps) => {
  const { t } = useTranslation('settings');
  const { formatDateTime } = useDateFormat();
  const deviceName = useDeviceName();
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null);
  const [error, setError] = useState(false);
  const [managing, setManaging] = useState(false);
  // The device being forgotten, or 'all'
  const [forgetting, setForgetting] = useState<number | 'all' | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(false);
    try {
      setDevices(await getTrustedDevices(signal));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      logger.error('trusted_devices_load_failed', {
        component: 'TrustedDevicesSetting',
        error: (e as Error)?.message,
      });
      setDevices(null);
      setError(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, sessionsRevision]);

  const forget = async (target: number | 'all') => {
    setForgetting(target);
    try {
      if (target === 'all') {
        await forgetAllTrustedDevices();
        setDevices([]);
        setManaging(false);
        notifySuccess('notifications:toasts.security.trustedDevicesForgotten');
      } else {
        await forgetTrustedDevice(target);
        const remaining = (devices ?? []).filter(d => d.id !== target);
        setDevices(remaining);
        if (remaining.length === 0) setManaging(false);
        notifySuccess('notifications:toasts.security.trustedDeviceForgotten');
      }
    } catch (e) {
      logger.error('trusted_device_forget_failed', {
        component: 'TrustedDevicesSetting',
        error: (e as Error)?.message,
      });
      notifyError('notifications:toasts.security.trustedDeviceForgetFailed');
    } finally {
      setForgetting(null);
    }
  };

  const description = () => {
    if (error) {
      return (
        <Group gap="xs">
          <Text size="sm" c="red">
            {t('security.trustedDevices.loadFailed')}
          </Text>
          <Button variant="ghost" size="small" onClick={() => void load()}>
            {t('security.twoFactor.retry')}
          </Button>
        </Group>
      );
    }
    if (devices === null) return <Skeleton height={14} width="60%" />;
    if (devices.length === 0) return t('security.trustedDevices.none');
    return t('security.trustedDevices.count', { count: devices.length });
  };

  return (
    <>
      <div className="settings-option">
        <div className="settings-option-info">
          <div className="settings-option-title">
            {t('security.trustedDevices.title')}
          </div>
          <div className="settings-option-description">{description()}</div>
        </div>
        <div className="settings-option-control">
          {devices && devices.length > 0 && (
            <Button variant="secondary" onClick={() => setManaging(true)}>
              {t('security.trustedDevices.manage')}
            </Button>
          )}
        </div>
      </div>

      <ResponsiveModal
        opened={managing}
        onClose={() => forgetting === null && setManaging(false)}
        title={t('security.trustedDevices.title')}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">{t('security.trustedDevices.intro')}</Text>
          {devices?.map(device => {
            const name = deviceName(device.user_agent);
            return (
              <Paper key={device.id} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div>
                    <Text size="sm" fw={600}>
                      {name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {device.last_used_at
                        ? t('security.trustedDevices.lastUsed', {
                            date: formatDateTime(device.last_used_at),
                          })
                        : t('security.trustedDevices.added', {
                            date: formatDateTime(device.created_at),
                          })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('security.trustedDevices.expires', {
                        date: formatDateTime(device.expires_at),
                      })}
                    </Text>
                  </div>
                  <MantineButton
                    variant="default"
                    size="xs"
                    loading={forgetting === device.id}
                    disabled={forgetting !== null && forgetting !== device.id}
                    onClick={() => void forget(device.id)}
                    aria-label={t('security.trustedDevices.forgetLabel', {
                      name,
                    })}
                  >
                    {t('security.trustedDevices.forget')}
                  </MantineButton>
                </Group>
              </Paper>
            );
          })}
          <Group justify="flex-end">
            <MantineButton
              color="red"
              loading={forgetting === 'all'}
              disabled={forgetting !== null && forgetting !== 'all'}
              onClick={() => void forget('all')}
            >
              {t('security.trustedDevices.forgetAll')}
            </MantineButton>
          </Group>
        </Stack>
      </ResponsiveModal>
    </>
  );
};

export default TrustedDevicesSetting;
