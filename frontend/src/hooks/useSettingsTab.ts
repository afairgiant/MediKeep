import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SETTINGS_TABS, type SettingsTab } from '../constants/settingsTabs';

const isSettingsTab = (value: string | null): value is SettingsTab =>
  SETTINGS_TABS.includes(value as SettingsTab);

/** Active Settings tab, kept in the `?tab=` query so reloads and links open the same tab. */
export function useSettingsTab(): [SettingsTab, (_tab: SettingsTab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab: SettingsTab = isSettingsTab(requested)
    ? requested
    : 'general';

  const selectTab = useCallback(
    (tab: SettingsTab) => {
      setSearchParams(
        params => {
          const next = new URLSearchParams(params);
          next.set('tab', tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [activeTab, selectTab];
}
