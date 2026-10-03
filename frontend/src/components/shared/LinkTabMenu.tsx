import { useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

/**
 * How a dialog's linked-record tabs are shown:
 * - view:  only the types that have links, no way to add more
 * - add:   the same, plus a "Link" menu that reveals the others (a new record has no links yet)
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
}

interface UseLinkTabVisibilityResult {
  isShown: (_key: string) => boolean;
  hidden: LinkTabItem[];
  reveal: (_key: string) => void;
}

/**
 * Decides which link tabs are shown. A type that has been shown stays shown while the
 * dialog is open, so removing its last link never drops the tab from under the user.
 */
export const useLinkTabVisibility = (
  items: LinkTabItem[],
  mode: LinkTabMode
): UseLinkTabVisibilityResult => {
  const [shown, setShown] = useState<string[]>([]);
  const withLinks = items
    .filter(item => (item.count ?? 0) > 0)
    .map(item => item.key);
  const withLinksSignature = withLinks.join('|');

  useEffect(() => {
    setShown(prev => {
      const missing = withLinks.filter(key => !prev.includes(key));
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
    // withLinks is rebuilt every render; its content is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withLinksSignature]);

  const collapse = mode !== 'edit';
  const isShown = (key: string) =>
    !collapse || withLinks.includes(key) || shown.includes(key);

  return {
    isShown,
    hidden: items.filter(item => !isShown(item.key)),
    reveal: (key: string) =>
      setShown(prev => (prev.includes(key) ? prev : [...prev, key])),
  };
};

interface LinkTabMenuProps {
  /** The types that are not shown as tabs */
  hidden: LinkTabItem[];
  onPick: (_key: string) => void;
}

/** The "Link" menu of the tab bar: lists the hidden types; picking one shows its tab. */
export const LinkTabMenu = ({ hidden, onPick }: LinkTabMenuProps) => {
  const { t } = useTranslation(['common']);
  if (hidden.length === 0) return null;
  return (
    <Menu position="bottom-start" withinPortal zIndex={4000}>
      <Menu.Target>
        <Button
          variant="subtle"
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
