import { useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import './LinkTabMenu.css';

/**
 * How a dialog's linked-record tabs are shown:
 * - view:  only the types that have links, no way to add more; none until every count is
 *           known, so the tab bar changes once instead of tab by tab
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

/**
 * What an editable dialog passes so the "Link" menu can open the type it picks. The
 * read-only dialog has no menu, so only an editable one has to pass them.
 */
export type LinkTabNavigationProps =
  | {
      /** The read-only dialog: only the types that have links, and no Link menu */
      isViewMode: true;
      activeTab?: string | null;
      onSelectTab?: (_tab: string) => void;
    }
  | {
      isViewMode?: false;
      /** Value of the open tab: a type opened from the "Link" menu stays while it is open */
      activeTab: string | null;
      /** Called with the tab value when the "Link" menu picks a type, to open its tab */
      onSelectTab: (_tab: string) => void;
    };

export interface LinkTabItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
  /** Number of links, or undefined while it is not known (still loading, or it failed) */
  count: number | undefined;
  /** The count is on its way; false once it is known or its load failed */
  loading?: boolean;
  /** The tab's value when it differs from `key` */
  tabValue?: string;
}

interface UseLinkTabVisibilityResult {
  isShown: (_key: string) => boolean;
  hidden: LinkTabItem[];
}

/**
 * How long the read-only dialog waits for link counts before it shows the types whose
 * count it still does not know, so a request that never returns cannot hide links.
 */
export const LINK_TAB_LOADING_DEADLINE_MS = 3000;

/**
 * Decides which link tabs are shown. `activeTab` is the value of the open tab, which is
 * always shown.
 * - view: the types that have links, once every count has been loaded. Until then none
 *   is shown (a tab that appears and vanishes again is worse than one that appears
 *   late). A type whose count could not be loaded, or is still missing after the
 *   deadline, stays without a number, so links that exist are never hidden.
 * - add:  the types that have links, plus the open tab. A type picked from the "Link"
 *   menu is open, so it stays while the user adds links to it; once they leave it with
 *   no links it goes back into the menu instead of staying as an empty "(0)" tab.
 * - edit: every type
 * In add mode the caller must pass the open tab and, when the "Link" menu picks a type,
 * open that type's tab; otherwise the picked type never shows (LinkTabNavigationProps
 * makes the editable dialogs pass both).
 */
export const useLinkTabVisibility = (
  items: LinkTabItem[],
  mode: LinkTabMode,
  activeTab: string | null | undefined
): UseLinkTabVisibilityResult => {
  const loading = mode === 'view' && items.some(item => item.loading);
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDeadlinePassed(false);
      return undefined;
    }
    const timer = setTimeout(
      () => setDeadlinePassed(true),
      LINK_TAB_LOADING_DEADLINE_MS
    );
    return () => clearTimeout(timer);
  }, [loading]);

  const waiting = loading && !deadlinePassed;

  const isShown = (key: string) => {
    if (mode === 'edit') return true;
    const item = items.find(candidate => candidate.key === key);
    if (!item) return false;
    if ((item.tabValue ?? item.key) === activeTab) return true;
    if (mode === 'add') return (item.count ?? 0) > 0;
    if (waiting) return false;
    // Only a count known to be zero hides a tab
    return item.count !== 0;
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
