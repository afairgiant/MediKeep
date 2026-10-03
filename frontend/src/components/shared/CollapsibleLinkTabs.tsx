import { Tabs } from '@mantine/core';

import { useTabLabel } from '../../hooks/useTabLabel';
import {
  LinkTabMenu,
  useLinkTabVisibility,
  type LinkTabItem,
  type LinkTabMode,
} from './LinkTabMenu';

interface CollapsibleLinkTabsProps {
  /** One entry per linked type; `key` is also the tab's value */
  items: LinkTabItem[];
  mode: LinkTabMode;
  /** Called with the tab value when the "Link" menu reveals a type, to open its tab */
  onSelectTab?: (_tab: string) => void;
}

/**
 * Link tab buttons with a count each: "Medications (2)". Render inside <Tabs.List>.
 * View mode and a new record show only the types that have links (a new record also gets
 * a "Link" menu to reveal the others); editing a saved record shows every type.
 */
const CollapsibleLinkTabs = ({
  items,
  mode,
  onSelectTab,
}: CollapsibleLinkTabsProps) => {
  const tabLabel = useTabLabel();
  const { isShown, hidden, reveal } = useLinkTabVisibility(items, mode);

  return (
    <>
      {items.map(item =>
        isShown(item.key) ? (
          <Tabs.Tab
            key={item.key}
            value={item.key}
            leftSection={<item.icon size={16} />}
          >
            {tabLabel(item.label, item.count)}
          </Tabs.Tab>
        ) : null
      )}
      {mode === 'add' && (
        <LinkTabMenu
          hidden={hidden}
          onPick={key => {
            reveal(key);
            onSelectTab?.(key);
          }}
        />
      )}
    </>
  );
};

export default CollapsibleLinkTabs;
