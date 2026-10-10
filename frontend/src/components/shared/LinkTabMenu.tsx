import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import './LinkTabMenu.css';

/**
 * How a dialog's linked-record tabs are shown:
 * - view:  only the types that have links, no way to add more
 * - add:   the same, plus a "Link" menu that reveals the others (a new record has no links yet);
 *           a revealed type is a tab only while it is open or has links
 * - edit:  every type (editing a saved record), no menu
 */
export type LinkTabMode = 'view' | 'add' | 'edit';

export const linkTabMode = (
  isViewMode: boolean | undefined,
  isSaved: boolean
): LinkTabMode => {
  if (isViewMode) return 'view';
  return isSaved ? 'edit' : 'add';
};

export interface LinkTabItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
  /** Number of links, or undefined while it is not known yet */
  count: number | undefined;
  /** The tab's value when it differs from `key` */
  tabValue?: string;
}

interface UseLinkTabVisibilityResult {
  isShown: (_key: string) => boolean;
  hidden: LinkTabItem[];
}

/**
 * Decides which link tabs are shown. `activeTab` is the value of the open tab.
 * - view: only the types that have links
 * - add:  the types that have links, plus the open tab. A type picked from the "Link"
 *   menu is open, so it stays while the user adds links to it; once they leave it with
 *   no links it goes back into the menu instead of staying as an empty "(0)" tab.
 * - edit: every type
 */
export const useLinkTabVisibility = (
  items: LinkTabItem[],
  mode: LinkTabMode,
  activeTab?: string | null
): UseLinkTabVisibilityResult => {
  const collapse = mode !== 'edit';

  const isShown = (key: string) => {
    if (!collapse) return true;
    const item = items.find(candidate => candidate.key === key);
    if (!item) return false;
    if ((item.count ?? 0) > 0) return true;
    return mode === 'add' && (item.tabValue ?? item.key) === activeTab;
  };

  return { isShown, hidden: items.filter(item => !isShown(item.key)) };
};

interface LinkTabMenuProps {
  /** The types that are not shown as tabs */
  hidden: LinkTabItem[];
  onPick: (_key: string) => void;
}

/** The "Link" menu of the tab bar: lists the hidden types; picking one opens its tab. */
export const LinkTabMenu = ({ hidden, onPick }: LinkTabMenuProps) => {
  const { t } = useTranslation(['common']);
  if (hidden.length === 0) return null;
  return (
    <Menu position="bottom-start" withinPortal zIndex={4000}>
      <Menu.Target>
        <Button
          variant="transparent"
          color="var(--mantine-color-text)"
          className="link-tab-menu-button"
          size="compact-sm"
          leftSection={<IconPlus size={14} />}
          style={{ alignSelf: 'center' }}
        >
          {t('common:buttons.link')}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {hidden.map(item => (
          <Menu.Item
            key={item.key}
            leftSection={<item.icon size={14} />}
            onClick={() => onPick(item.key)}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};
