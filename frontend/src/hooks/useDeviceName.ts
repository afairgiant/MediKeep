import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { describeUserAgent } from '../utils/describeUserAgent';

/** A function naming the browser and system in a user agent, such as "Firefox on Windows". */
export function useDeviceName() {
  const { t } = useTranslation('common');
  return useCallback(
    (userAgent: string | null | undefined) => {
      const { browser, os } = describeUserAgent(userAgent);
      if (browser && os) return t('device.name', { browser, os });
      return browser || os || t('device.unknown');
    },
    [t]
  );
}
