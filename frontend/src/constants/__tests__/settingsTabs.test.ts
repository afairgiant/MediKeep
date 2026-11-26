import { SETTINGS_TABS, settingsTabPath } from '../settingsTabs';

describe('settingsTabPath', () => {
  it.each(SETTINGS_TABS)('builds the Settings path that opens %s', tab => {
    const url = new URL(settingsTabPath(tab), 'http://localhost');
    expect(url.pathname).toBe('/settings');
    expect(url.searchParams.get('tab')).toBe(tab);
  });
});
