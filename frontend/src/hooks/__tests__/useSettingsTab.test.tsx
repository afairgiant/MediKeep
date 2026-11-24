import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useSettingsTab } from '../useSettingsTab';

const renderAt = (url: string) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [tab, selectTab] = useSettingsTab();
      return { tab, selectTab, search: useLocation().search };
    },
    { wrapper }
  );
};

describe('useSettingsTab', () => {
  it('opens the tab named in the URL', () => {
    expect(renderAt('/settings?tab=notifications').result.current.tab).toBe(
      'notifications'
    );
  });

  it('falls back to general with no tab or an unknown one', () => {
    expect(renderAt('/settings').result.current.tab).toBe('general');
    expect(renderAt('/settings?tab=bogus').result.current.tab).toBe('general');
  });

  it('writes the selected tab to the URL and keeps other params', () => {
    const { result } = renderAt('/settings?tab=general&keep=1');
    act(() => result.current.selectTab('about'));
    expect(result.current.tab).toBe('about');
    const params = new URLSearchParams(result.current.search);
    expect(params.get('tab')).toBe('about');
    expect(params.get('keep')).toBe('1');
  });
});
