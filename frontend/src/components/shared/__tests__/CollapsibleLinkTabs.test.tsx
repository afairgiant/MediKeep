import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs } from '@mantine/core';
import { IconPill, IconScissors } from '@tabler/icons-react';

import render, { screen } from '../../../test-utils/render';
import CollapsibleLinkTabs from '../CollapsibleLinkTabs';
import { linkTabMode, type LinkTabItem } from '../LinkTabMenu';

const items = (counts: Array<number | undefined>): LinkTabItem[] => [
  {
    key: 'procedures',
    label: 'Procedures',
    icon: IconScissors,
    count: counts[0],
  },
  {
    key: 'medications',
    label: 'Medications',
    icon: IconPill,
    count: counts[1],
  },
];

const renderTabs = (
  counts: Array<number | undefined>,
  mode: 'view' | 'add' | 'edit',
  onSelectTab?: (_tab: string) => void,
  activeTab?: string
) => {
  const tree = (c: Array<number | undefined>, active = activeTab) => (
    <Tabs value="procedures">
      <Tabs.List>
        <CollapsibleLinkTabs
          items={items(c)}
          mode={mode}
          activeTab={active}
          onSelectTab={onSelectTab}
        />
      </Tabs.List>
    </Tabs>
  );
  const result = render(tree(counts));
  return {
    ...result,
    rerenderWith: (c: Array<number | undefined>, active = activeTab) =>
      result.rerender(tree(c, active)),
  };
};

const menuButton = () =>
  screen
    .getAllByRole('button', { name: 'common:buttons.link' })
    .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;

describe('linkTabMode', () => {
  it('is view in a read-only dialog, edit for a saved record, add for a new one', () => {
    expect(linkTabMode(true, true)).toBe('view');
    expect(linkTabMode(true, false)).toBe('view');
    expect(linkTabMode(false, true)).toBe('edit');
    expect(linkTabMode(undefined, false)).toBe('add');
  });
});

describe('CollapsibleLinkTabs', () => {
  it('view: shows only types with links, with their counts, and no Link menu', () => {
    renderTabs([2, 0], 'view');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (2)',
    ]);
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('view: a type whose count is not known yet has no tab', () => {
    renderTabs([undefined, 1], 'view');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Medications (1)',
    ]);
  });

  it('edit: shows every type, zero included, and no Link menu', () => {
    renderTabs([0, 0], 'edit');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (0)',
      'Medications (0)',
    ]);
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('add: lists the types without links in the Link menu, and picking one asks to open it', async () => {
    const onSelectTab = vi.fn();
    renderTabs([1, 0], 'add', onSelectTab);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
    ]);

    await userEvent.click(menuButton());
    const items = await screen.findAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(['Medications']);
    await userEvent.click(items[0]);

    expect(onSelectTab).toHaveBeenCalledWith('medications');
  });

  it('add: a type opened from the Link menu is a tab only while it is open', async () => {
    const { rerenderWith } = renderTabs(
      [1, 0],
      'add',
      undefined,
      'medications'
    );
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
      'Medications (0)',
    ]);

    // Left without linking anything: back into the Link menu, not an empty (0) tab
    rerenderWith([1, 0], 'procedures');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
    ]);
    await userEvent.click(menuButton());
    expect(
      (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    ).toEqual(['Medications']);
  });

  it('add: an opened type that gets a link stays a tab after the user leaves it', () => {
    const { rerenderWith } = renderTabs(
      [1, 0],
      'add',
      undefined,
      'medications'
    );
    rerenderWith([1, 2], 'procedures');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
      'Medications (2)',
    ]);
  });

  it('view and edit are not affected by the open tab', () => {
    renderTabs([0, 0], 'view', undefined, 'medications');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('add: the Link button is styled like the tabs, not as a primary-color button', () => {
    renderTabs([1, 0], 'add');
    const button = menuButton();
    // The class gives it the tabs' text color and hover background in both color schemes
    expect(button).toHaveClass('link-tab-menu-button');
    expect(button).toHaveAttribute('data-variant', 'transparent');
  });

  it('add: no Link menu once every type is shown', () => {
    renderTabs([1, 3], 'add');
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('view: a type whose last link is removed is no longer a tab', () => {
    const { rerenderWith } = renderTabs([1, 0], 'view');
    expect(
      screen.getByRole('tab', { name: 'Procedures (1)' })
    ).toBeInTheDocument();
    rerenderWith([0, 0]);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
