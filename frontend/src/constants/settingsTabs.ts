export const SETTINGS_TABS = [
  'general',
  'documents',
  'notifications',
  'about',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Path that opens the Settings page on the given tab. */
export const settingsTabPath = (tab: SettingsTab): string =>
  `/settings?tab=${tab}`;
